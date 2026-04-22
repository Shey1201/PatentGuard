from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import uuid

from backend.models.database import get_db, User, Document, ReviewTask, SystemConfig, UserAPIConfig
from backend.models.schemas import (
    ReviewTaskCreate, ReviewTaskResponse, ReviewResultResponse,
    MessageResponse, TestLLMRequest, TestLLMResponse
)
from backend.services.auth import get_user_for_token
from backend.services.parser import extract_text, get_file_extension
from backend.services.llm import LLMService
from backend.services.retriever import RetrievalWithConfig
from backend.services.checker import ComplianceChecker, ReviewResult

router = APIRouter(prefix="/analysis", tags=["审查"])
security = HTTPBearer()


async def get_current_user_id(credentials = Depends(security), db: AsyncSession = Depends(get_db)):
    """Get current user ID from token（支持演示 token）"""
    user = await get_user_for_token(credentials.credentials, db)
    return user.id


async def require_admin(credentials = Depends(security), db: AsyncSession = Depends(get_db)):
    """仅管理员可访问"""
    user = await get_user_for_token(credentials.credentials, db)
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user


async def get_llm_config(db: AsyncSession, user_id: uuid.UUID = None) -> dict:
    """获取 LLM 配置（优先用户配置，其次系统配置）"""
    # 优先使用用户配置
    if user_id:
        result = await db.execute(
            select(UserAPIConfig).where(UserAPIConfig.user_id == user_id, UserAPIConfig.is_active == True)
        )
        user_config = result.scalar_one_or_none()
        if user_config and user_config.llm_api_key:
            return {
                "provider": user_config.llm_provider,
                "api_key": user_config.llm_api_key,
                "base_url": user_config.llm_base_url,
                "model": user_config.llm_model
            }

    # 回退到系统配置
    result = await db.execute(select(SystemConfig))
    configs = {c.config_key: c.config_value for c in result.scalars().all()}
    return {
        "provider": configs.get("llm_provider", "custom"),
        "api_key": configs.get("llm_api_key", ""),
        "base_url": configs.get("llm_base_url", ""),
        "model": configs.get("llm_model", "")
    }


async def get_retrieval_config(db: AsyncSession, user_id: uuid.UUID = None) -> dict:
    """获取检索配置（优先用户配置，其次系统配置）"""
    # 优先使用用户配置
    if user_id:
        result = await db.execute(
            select(UserAPIConfig).where(UserAPIConfig.user_id == user_id, UserAPIConfig.is_active == True)
        )
        user_config = result.scalar_one_or_none()
        if user_config and user_config.embedding_api_key:
            return {
                "api_key": user_config.embedding_api_key,
                "base_url": user_config.embedding_base_url,
                "model": user_config.embedding_model,
                "top_k": 5
            }

    # 回退到系统配置
    result = await db.execute(select(SystemConfig))
    configs = {c.config_key: c.config_value for c in result.scalars().all()}
    return {
        "api_key": configs.get("embedding_api_key", "") or configs.get("llm_api_key", ""),
        "base_url": configs.get("embedding_base_url", "") or configs.get("llm_base_url", ""),
        "model": configs.get("embedding_model", ""),
        "top_k": int(configs.get("retrieval_top_k", 5))
    }


# ========== 审查任务 ==========

@router.post("/review", response_model=ReviewTaskResponse)
async def create_review_task(
    task_data: ReviewTaskCreate,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id)
):
    """创建审查任务"""
    # 获取文档内容
    document = None
    document_title = task_data.document_title or "待审文档"

    if task_data.document_id:
        result = await db.execute(select(Document).where(Document.id == task_data.document_id))
        document = result.scalar_one_or_none()
        if document:
            document_title = document.title

    # 创建任务
    task = ReviewTask(
        task_name=task_data.task_name or f"审查任务",
        document_id=task_data.document_id,
        document_title=document_title,
        review_type=task_data.review_type,
        status="pending",
        created_by=user_id
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    return ReviewTaskResponse.model_validate(task)


@router.post("/review/with-file", response_model=ReviewTaskResponse)
async def review_with_file(
    file: UploadFile = File(...),
    review_type: str = "general",
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id)
):
    """上传文件并审查"""
    # 读取文件
    content = await file.read()
    file_ext = get_file_extension(file.filename)

    # 解析文本
    try:
        text_content = extract_text(content, file_ext)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"文件解析失败: {str(e)}")

    # 创建任务
    task = ReviewTask(
        task_name=f"审查: {file.filename}",
        document_title=file.filename,
        review_type=review_type,
        status="processing",
        created_by=user_id
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    # 异步执行审查
    try:
        await execute_review(task.id, text_content, review_type, db, user_id)
    except Exception as e:
        task.status = "failed"
        task.error_message = str(e)
        await db.commit()

    return ReviewTaskResponse.model_validate(task)


@router.post("/review/{task_id}/execute")
async def execute_review_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id)
):
    """执行审查任务"""
    result = await db.execute(select(ReviewTask).where(ReviewTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    # 获取文档内容
    document_content = ""
    if task.document_id:
        doc_result = await db.execute(select(Document).where(Document.id == task.document_id))
        document = doc_result.scalar_one_or_none()
        if document:
            document_content = document.content or ""

    task.status = "processing"
    await db.commit()

    try:
        result = await execute_review(task_id, document_content, task.review_type, db, user_id)
        return result
    except Exception as e:
        task.status = "failed"
        task.error_message = str(e)
        await db.commit()
        raise HTTPException(status_code=500, detail=str(e))


async def execute_review(task_id: uuid.UUID, document_content: str, review_type: str, db: AsyncSession, user_id: uuid.UUID = None):
    """执行审查逻辑"""
    from datetime import datetime

    # 获取配置（优先用户配置）
    llm_config = await get_llm_config(db, user_id)
    retrieval_config = await get_retrieval_config(db, user_id)

    # 初始化服务
    llm_service = LLMService(
        api_key=llm_config["api_key"],
        base_url=llm_config["base_url"],
        model=llm_config["model"],
        provider=llm_config["provider"]
    )

    retrieval = RetrievalWithConfig(
        db=db,
        embedding_api_key=retrieval_config["api_key"],
        embedding_base_url=retrieval_config["base_url"],
        embedding_model=retrieval_config["model"],
        top_k=retrieval_config["top_k"]
    )

    # 使用 ComplianceChecker 执行审查
    checker = ComplianceChecker(
        llm_service=llm_service,
        retrieval_service=retrieval,
        review_type=review_type
    )

    review_result = await checker.review(
        document_content=document_content,
        top_k=retrieval_config["top_k"]
    )

    # 更新任务
    result = await db.execute(select(ReviewTask).where(ReviewTask.id == task_id))
    task = result.scalar_one_or_none()
    if task:
        task.status = "completed"
        task.result = review_result.to_dict()
        task.completed_at = datetime.utcnow()
        await db.commit()

    return review_result.to_dict()


# ========== 审查结果 ==========

@router.get("/tasks/{task_id}", response_model=ReviewTaskResponse)
async def get_review_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id)
):
    """获取审查任务状态"""
    result = await db.execute(select(ReviewTask).where(ReviewTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return ReviewTaskResponse.model_validate(task)


@router.get("/results/{task_id}")
async def get_review_result(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id)
):
    """获取审查结果详情"""
    result = await db.execute(select(ReviewTask).where(ReviewTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if task.status != "completed":
        return {
            "task_id": task_id,
            "status": task.status,
            "message": "任务尚未完成"
        }

    return {
        "task_id": task.id,
        "document_title": task.document_title,
        **task.result
    }


@router.get("/history")
async def get_review_history(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id)
):
    """获取当前用户的审查历史"""
    from sqlalchemy import func

    # 获取当前用户的历史记录
    query = select(ReviewTask).where(ReviewTask.created_by == user_id).order_by(ReviewTask.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    tasks = result.scalars().all()

    # 获取总数
    count_result = await db.execute(
        select(func.count(ReviewTask.id)).where(ReviewTask.created_by == user_id)
    )
    total = count_result.scalar() or 0

    return {
        "items": [ReviewTaskResponse.model_validate(t) for t in tasks],
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/history/all")
async def get_all_review_history(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin)
):
    """获取所有审查历史（仅管理员）"""
    from sqlalchemy import func

    # 获取所有历史记录
    query = select(ReviewTask).order_by(ReviewTask.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    tasks = result.scalars().all()

    # 获取总数
    count_result = await db.execute(select(func.count(ReviewTask.id)))
    total = count_result.scalar() or 0

    return {
        "items": [ReviewTaskResponse.model_validate(t) for t in tasks],
        "total": total,
        "page": page,
        "page_size": page_size
    }
