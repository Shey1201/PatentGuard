from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, BigInteger, ARRAY, JSON, UUID, ForeignKey
from sqlalchemy.sql import func
from datetime import datetime
import uuid
import loguru


class Base(DeclarativeBase):
    pass


# Users
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    username = Column(String(100), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="user")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# System Config
class SystemConfig(Base):
    __tablename__ = "system_config"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    config_key = Column(String(100), unique=True, nullable=False)
    config_value = Column(Text)
    description = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# Categories
class Category(Base):
    __tablename__ = "categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False)
    description = Column(Text)
    parent_id = Column(UUID(as_uuid=True))
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# Documents
class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    original_filename = Column(String(255))
    file_path = Column(String(512))
    file_size = Column(BigInteger)
    file_type = Column(String(50))
    category_id = Column(UUID(as_uuid=True))
    content = Column(Text)
    status = Column(String(20), default="pending")
    document_type = Column(String(50))
    tags = Column(ARRAY(String))
    meta = Column(JSON)  # 元数据 (JSONB)
    uploaded_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# Document Chunks (with vector - using pgvector)
class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"))
    chunk_index = Column(Integer, nullable=False)
    chunk_text = Column(Text, nullable=False)
    embedding = Column(Text)  # 向量存储为 JSON 字符串 (适配 Supabase)
    start_position = Column(Integer)
    end_position = Column(Integer)
    meta = Column(JSON)  # 元数据 (JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# Review Tasks
class ReviewTask(Base):
    __tablename__ = "review_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_name = Column(String(255), nullable=False)
    document_id = Column(UUID(as_uuid=True))
    document_title = Column(String(255))
    review_type = Column(String(50), default="general")  # 审查类型: general/patent/law/contract
    status = Column(String(20), default="pending")
    result = Column(JSON)
    error_message = Column(Text)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# Audit Logs
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True))
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50))
    resource_id = Column(UUID(as_uuid=True))
    ip_address = Column(String(50))
    user_agent = Column(Text)
    details = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# User API Configs (每个用户独立的 API 配置)
class UserAPIConfig(Base):
    __tablename__ = "user_api_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # LLM 配置
    llm_provider = Column(String(50), default="openai")
    llm_api_key = Column(String(255))  # 用户自己的 API Key
    llm_base_url = Column(String(255), default="https://api.openai.com/v1")
    llm_model = Column(String(100), default="gpt-4o-mini")

    # Embedding 配置
    embedding_model = Column(String(100), default="text-embedding-3-small")
    embedding_api_key = Column(String(255))  # 用户自己的 API Key
    embedding_base_url = Column(String(255), default="https://api.openai.com/v1")
    embedding_dim = Column(Integer, default=1536)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# Database setup - 使用配置文件中的数据库URL
from backend.config_local import get_settings

settings = get_settings()
DATABASE_URL = settings.database_url

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 创建默认用户
    await create_default_users()
    # 创建默认分类与模拟数据（无则插入）
    await create_default_categories_and_documents()
    # 确保有模拟审查任务数据
    await ensure_default_review_tasks()


async def create_default_users():
    """创建默认管理员和测试用户"""
    from backend.services.auth import get_password_hash
    from sqlalchemy import select

    async with AsyncSessionLocal() as session:
        # 检查是否已有用户
        result = await session.execute(select(User))
        existing_users = result.scalars().all()

        if existing_users:
            return  # 已有用户，跳过

        # 创建管理员用户
        admin = User(
            email="admin@patentguard.com",
            username="admin",
            password_hash=get_password_hash("admin123"),
            role="admin",
            is_active=True
        )
        session.add(admin)

        # 创建普通测试用户
        test_user = User(
            email="user@patentguard.com",
            username="testuser",
            password_hash=get_password_hash("user123"),
            role="user",
            is_active=True
        )
        session.add(test_user)

        await session.commit()
        loguru.logger.info("默认用户创建完成: admin@patentguard.com / admin123")


async def create_default_categories_and_documents():
    """创建默认分类与模拟文档/审查数据，供仪表盘与知识库直接引用"""
    from sqlalchemy import select

    async with AsyncSessionLocal() as session:
        # 若已有分类则跳过
        result = await session.execute(select(Category))
        if result.scalars().first():
            return

        # 获取管理员用户 id
        admin_result = await session.execute(
            select(User).where(User.email == "admin@patentguard.com")
        )
        admin = admin_result.scalar_one_or_none()
        if not admin:
            return

        admin_id = admin.id

        # 默认分类
        categories_data = [
            ("专利法律法规", "law", "专利相关法律法规、审查指南等"),
            ("专利模板", "patent", "发明/实用新型/外观设计申请模板"),
            ("政策文件", "policy", "国家与地方政策文件"),
            ("合同协议", "contract", "技术转让、许可等合同范本"),
        ]
        category_ids = []
        for name, type_, desc in categories_data:
            cat = Category(
                name=name,
                type=type_,
                description=desc,
                created_by=admin_id,
            )
            session.add(cat)
            await session.flush()
            category_ids.append(cat.id)

        # 模拟文档（部分已完成、部分处理中/待处理）
        docs_data = [
            ("专利法实施细则", "pdf", "completed", category_ids[0], "law"),
            ("专利审查指南", "pdf", "completed", category_ids[0], "law"),
            ("发明专利申请书模板", "docx", "completed", category_ids[1], "patent"),
            ("实用新型专利请求书", "docx", "processing", category_ids[1], "patent"),
            ("外观设计专利申请文件", "pdf", "pending", category_ids[1], "patent"),
            ("高新技术企业认定管理办法", "pdf", "completed", category_ids[2], "policy"),
            ("技术转让合同范本", "docx", "completed", category_ids[3], "contract"),
            ("专利许可合同", "pdf", "pending", category_ids[3], "contract"),
        ]
        doc_ids = []
        for title, file_type, status, cat_id, doc_type in docs_data:
            doc = Document(
                title=title,
                file_type=file_type,
                status=status,
                category_id=cat_id,
                document_type=doc_type,
                uploaded_by=admin_id,
            )
            session.add(doc)
            await session.flush()
            doc_ids.append((doc.id, status))

        # 为已完成文档添加模拟向量块（使 total_chunks > 0）
        for doc_id, status in doc_ids:
            if status != "completed":
                continue
            for i in range(3):
                chunk = DocumentChunk(
                    document_id=doc_id,
                    chunk_index=i,
                    chunk_text=f"模拟文本块 {i + 1}，用于向量检索与统计。",
                )
                session.add(chunk)

        # 模拟审查任务（使审查总数与完成数非 0）
        for idx, (doc_id, _) in enumerate(doc_ids[:4]):
            task = ReviewTask(
                task_name=f"审查任务-{idx + 1}",
                document_id=doc_id,
                document_title=docs_data[idx][0],
                status="completed" if idx < 3 else "pending",
                created_by=admin_id,
            )
            session.add(task)

        await session.commit()
        loguru.logger.info("默认分类与模拟数据创建完成")


async def ensure_default_review_tasks():
    """确保有模拟审查任务数据"""
    from sqlalchemy import select

    async with AsyncSessionLocal() as session:
        # 检查是否已有审查任务
        result = await session.execute(select(ReviewTask))
        existing_tasks = result.scalars().all()

        if existing_tasks:
            return  # 已有任务，跳过

        # 获取管理员用户 id
        admin_result = await session.execute(
            select(User).where(User.email == "admin@patentguard.com")
        )
        admin = admin_result.scalar_one_or_none()
        if not admin:
            return

        admin_id = admin.id

        # 获取已完成的文档
        docs_result = await session.execute(
            select(Document).where(Document.status == "completed").limit(4)
        )
        docs = docs_result.scalars().all()

        if not docs:
            return

        # 创建更多样化的模拟审查任务
        review_data = [
            ("发明专利申请书合规审查", "patent", "completed", "low", True,
             "文档格式规范，内容合规，未发现明显风险点。建议保持现有撰写风格。"),
            ("实用新型专利请求书审查", "patent", "completed", "high", False,
             "发现 3 处高风险问题：(1) 权利要求书缺少必要技术特征；(2) 说明书实施例不充分；(3) 摘要超出字数限制。"),
            ("技术转让合同合规审查", "contract", "completed", "medium", True,
             "合同主体资格合法，但存在2处中等风险点：违约金条款约定不明、争议解决条款需补充仲裁条款。"),
            ("高新技术企业认定材料审查", "policy", "processing", None, None, None),
            ("外观设计专利申请文件审查", "patent", "failed", None, None, "文档解析失败：文件损坏，无法提取文本内容"),
        ]

        from datetime import datetime, timedelta
        now = datetime.utcnow()

        for idx, (task_name, review_type, status, risk_level, compliance, summary) in enumerate(review_data):
            task = ReviewTask(
                task_name=task_name,
                review_type=review_type,
                document_id=docs[idx].id if idx < len(docs) else None,
                document_title=docs[idx].title if idx < len(docs) else "未知文档",
                status=status,
                created_by=admin_id,
            )

            if status == "completed":
                task.completed_at = now - timedelta(days=idx)
                if risk_level is not None and compliance is not None and summary is not None:
                    task.result = {
                        "compliance": compliance,
                        "risk_level": risk_level,
                        "summary": summary,
                        "findings": [],
                        "referenced_documents": []
                    }

            if status == "failed":
                task.error_message = summary

            session.add(task)

        await session.commit()
        loguru.logger.info("默认审查任务数据创建完成")
