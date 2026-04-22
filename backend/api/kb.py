from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
import uuid
import json

from backend.models.database import get_db, User, Category, Document, DocumentChunk, SystemConfig, UserAPIConfig
from backend.models.schemas import (
    CategoryCreate, CategoryResponse, DocumentResponse, DocumentWithChunks,
    SearchResponse, SearchResult, MessageResponse
)
from backend.services.auth import get_user_for_token
from backend.services.parser import extract_text, chunk_text, get_file_extension
from backend.services.embedding import EmbeddingService, vector_to_string
from backend.services.retriever import RetrievalService, RetrievalWithConfig

router = APIRouter(prefix="/kb", tags=["知识库"])
security = HTTPBearer()


async def get_current_user(credentials = Depends(security), db: AsyncSession = Depends(get_db)):
    """Get current user（支持演示 token）"""
    return await get_user_for_token(credentials.credentials, db)


async def get_current_user_id(credentials = Depends(security), db: AsyncSession = Depends(get_db)):
    """Get current user ID from token"""
    user = await get_current_user(credentials, db)
    return user.id


async def require_admin(credentials = Depends(security), db: AsyncSession = Depends(get_db)):
    """Require admin role"""
    user = await get_current_user(credentials, db)
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user


async def get_embedding_config(db: AsyncSession, user_id: uuid.UUID) -> dict:
    """获取 Embedding 配置（优先用户配置，其次系统配置）"""
    # 优先使用用户配置
    result = await db.execute(
        select(UserAPIConfig).where(UserAPIConfig.user_id == user_id, UserAPIConfig.is_active == True)
    )
    user_config = result.scalar_one_or_none()
    if user_config and user_config.embedding_api_key:
        return {
            "api_key": user_config.embedding_api_key,
            "base_url": user_config.embedding_base_url,
            "model": user_config.embedding_model,
            "dimension": user_config.embedding_dim
        }

    # 回退到系统配置
    config_result = await db.execute(select(SystemConfig))
    configs = {c.config_key: c.config_value for c in config_result.scalars().all()}
    return {
        "api_key": configs.get("embedding_api_key", "") or configs.get("llm_api_key", ""),
        "base_url": configs.get("embedding_base_url", "") or configs.get("llm_base_url", ""),
        "model": configs.get("embedding_model", ""),
        "dimension": int(configs.get("embedding_dim", 1536))
    }


# ========== 分类管理 ==========

@router.get("/categories", response_model=List[CategoryResponse])
async def get_categories(
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id)
):
    """获取所有分类"""
    result = await db.execute(select(Category))
    categories = result.scalars().all()

    # 获取每个分类的文档数量
    category_list = []
    for cat in categories:
        count_result = await db.execute(
            select(func.count(Document.id)).where(Document.category_id == cat.id)
        )
        doc_count = count_result.scalar() or 0
        cat_dict = CategoryResponse.model_validate(cat)
        cat_dict.document_count = doc_count
        category_list.append(cat_dict)

    return category_list


@router.post("/categories", response_model=CategoryResponse)
async def create_category(
    category: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id)
):
    """创建分类"""
    new_category = Category(
        name=category.name,
        type=category.type,
        description=category.description,
        created_by=user_id
    )
    db.add(new_category)
    await db.commit()
    await db.refresh(new_category)
    return CategoryResponse.model_validate(new_category)


@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user = Depends(require_admin)
):
    """删除分类（仅管理员）"""
    result = await db.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="分类不存在")

    await db.delete(category)
    await db.commit()
    return {"success": True, "message": "分类已删除"}


# ========== 文档管理 ==========

@router.get("/documents", response_model=List[DocumentResponse])
async def get_documents(
    page: int = 1,
    page_size: int = 20,
    category_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id)
):
    """获取文档列表"""
    query = select(Document)

    if category_id:
        query = query.where(Document.category_id == category_id)
    if status_filter:
        query = query.where(Document.status == status_filter)

    query = query.order_by(Document.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    documents = result.scalars().all()

    return [DocumentResponse.model_validate(doc) for doc in documents]


@router.get("/documents/{doc_id}", response_model=DocumentWithChunks)
async def get_document(
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id)
):
    """获取文档详情"""
    result = await db.execute(select(Document).where(Document.id == doc_id))
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")

    # 获取 chunks
    chunks_result = await db.execute(
        select(DocumentChunk)
        .where(DocumentChunk.document_id == doc_id)
        .order_by(DocumentChunk.chunk_index)
    )
    chunks = chunks_result.scalars().all()

    doc_dict = DocumentWithChunks.model_validate(document)
    doc_dict.chunks = [{"index": c.chunk_index, "text": c.chunk_text} for c in chunks]

    return doc_dict


@router.post("/documents/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    category_id: Optional[uuid.UUID] = None,
    document_type: Optional[str] = None,
    tags: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id)
):
    """上传文档"""
    # 读取文件
    content = await file.read()
    file_size = len(content)
    file_ext = get_file_extension(file.filename)

    # 解析文本
    try:
        text_content = extract_text(content, file_ext)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"文件解析失败: {str(e)}")

    # 创建文档记录
    document = Document(
        title=file.filename,
        original_filename=file.filename,
        file_path=f"documents/{uuid.uuid4()}.{file_ext}",
        file_size=file_size,
        file_type=file_ext,
        category_id=category_id,
        content=text_content,
        status="pending",
        document_type=document_type,
        tags=tags.split(",") if tags else [],
        uploaded_by=user_id
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    return DocumentResponse.model_validate(document)


@router.delete("/documents/{doc_id}")
async def delete_document(
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user = Depends(require_admin)
):
    """删除文档（仅管理员）"""
    result = await db.execute(select(Document).where(Document.id == doc_id))
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")

    # 删除关联的 chunks
    await db.execute(
        DocumentChunk.__table__.delete().where(DocumentChunk.document_id == doc_id)
    )

    await db.delete(document)
    await db.commit()

    return {"success": True, "message": "文档已删除"}


# ========== 文档处理 ==========

@router.post("/documents/{doc_id}/process")
async def process_document(
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id)
):
    """处理文档（分块 + 向量化）"""
    result = await db.execute(select(Document).where(Document.id == doc_id))
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")

    if not document.content:
        raise HTTPException(status_code=400, detail="文档内容为空")

    # 更新状态
    document.status = "processing"
    await db.commit()

    try:
        # 获取配置（优先用户配置）
        embedding_config = await get_embedding_config(db, user_id)

        embedding_service = EmbeddingService(
            api_key=embedding_config["api_key"],
            base_url=embedding_config["base_url"],
            model=embedding_config["model"]
        )

        # 获取系统配置中的分块参数
        config_result = await db.execute(select(SystemConfig))
        configs = {c.config_key: c.config_value for c in config_result.scalars().all()}
        chunk_size = int(configs.get("chunk_size", 512))
        chunk_overlap = int(configs.get("chunk_overlap", 50))

        # 分块
        chunks = chunk_text(document.content, chunk_size, chunk_overlap)

        # 向量化并存储
        for chunk in chunks:
            embedding = await embedding_service.get_embedding(chunk["text"])
            chunk_record = DocumentChunk(
                document_id=document.id,
                chunk_index=chunk["index"],
                chunk_text=chunk["text"],
                embedding=vector_to_string(embedding),
                start_position=chunk["start"],
                end_position=chunk["end"]
            )
            db.add(chunk_record)

        # 更新状态
        document.status = "completed"
        await db.commit()

        return {"success": True, "message": f"已处理 {len(chunks)} 个文档块"}

    except Exception as e:
        document.status = "failed"
        await db.commit()
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


# ========== 搜索 ==========

@router.get("/search", response_model=SearchResponse)
async def search_knowledge_base(
    q: str,
    top_k: int = 5,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id)
):
    """搜索知识库"""
    # 获取配置（优先用户配置）
    embedding_config = await get_embedding_config(db, user_id)

    retrieval = RetrievalWithConfig(
        db=db,
        embedding_api_key=embedding_config["api_key"],
        embedding_base_url=embedding_config["base_url"],
        embedding_model=embedding_config["model"],
        top_k=top_k
    )

    results = await retrieval.retrieve(q, top_k=top_k)

    search_results = [
        SearchResult(
            document_id=r["document_id"],
            document_title=r["document_title"],
            chunk_text=r["chunk_text"],
            score=r["score"],
            metadata=r["metadata"]
        )
        for r in results
    ]

    return SearchResponse(results=search_results)
