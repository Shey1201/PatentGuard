from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any
import json
import uuid

from backend.models.database import get_db, User, SystemConfig
from backend.models.schemas import (
    SystemConfigResponse, LLMConfigUpdate, EmbeddingConfigUpdate,
    TestLLMRequest, TestLLMResponse, MessageResponse
)
from backend.services.auth import get_user_for_token
from backend.services.llm import LLMService

router = APIRouter(prefix="/system", tags=["系统配置"])
security = HTTPBearer()


def _compliance_is_true(result: Any) -> bool:
    """兼容 JSON 列返回 dict / 字符串 / 异常结构，避免 stats 接口 500"""
    if result is None:
        return False
    if isinstance(result, dict):
        return result.get("compliance") is True
    if isinstance(result, str):
        try:
            parsed = json.loads(result)
            if isinstance(parsed, dict):
                return parsed.get("compliance") is True
        except (json.JSONDecodeError, TypeError):
            return False
    return False


async def get_current_user(credentials = Depends(security), db: AsyncSession = Depends(get_db)):
    """Get current user（支持演示 token）"""
    return await get_user_for_token(credentials.credentials, db)


async def require_admin(user: User = Depends(get_current_user)):
    """Require admin role"""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user


# ========== 配置管理 ==========

@router.get("/config", response_model=Dict[str, Any])
async def get_system_config(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """获取系统配置"""
    result = await db.execute(select(SystemConfig))
    configs = result.scalars().all()

    config_dict = {}
    for c in configs:
        # 隐藏敏感的 API key
        if c.config_key in ["llm_api_key", "embedding_api_key"]:
            config_dict[c.config_key] = "***" if c.config_value else ""
        else:
            config_dict[c.config_key] = c.config_value

    return config_dict


@router.put("/config/llm", response_model=MessageResponse)
async def update_llm_config(
    config: LLMConfigUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin)
):
    """更新 LLM 配置"""
    config_dict = config.model_dump(exclude_none=True)

    for key, value in config_dict.items():
        result = await db.execute(
            select(SystemConfig).where(SystemConfig.config_key == key)
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.config_value = value
        else:
            new_config = SystemConfig(config_key=key, config_value=value)
            db.add(new_config)

    await db.commit()

    return MessageResponse(success=True, message="LLM 配置已更新")


@router.put("/config/embedding", response_model=MessageResponse)
async def update_embedding_config(
    config: EmbeddingConfigUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin)
):
    """更新 Embedding 配置"""
    config_dict = config.model_dump()

    for key, value in config_dict.items():
        result = await db.execute(
            select(SystemConfig).where(SystemConfig.config_key == key)
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.config_value = str(value)
        else:
            new_config = SystemConfig(config_key=key, config_value=str(value))
            db.add(new_config)

    await db.commit()

    return MessageResponse(success=True, message="Embedding 配置已更新")


@router.post("/config/test-llm", response_model=TestLLMResponse)
async def test_llm_connection(
    test_request: TestLLMRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """测试 LLM 连接"""
    # 获取当前配置
    result = await db.execute(select(SystemConfig))
    configs = {c.config_key: c.config_value for c in result.scalars().all()}

    llm_service = LLMService(
        api_key=configs.get("llm_api_key", ""),
        base_url=configs.get("llm_base_url", ""),
        model=configs.get("llm_model", ""),
        provider=configs.get("llm_provider", "custom")
    )

    result = await llm_service.test_connection(test_request.prompt)

    return TestLLMResponse(
        success=result["success"],
        response=result.get("response"),
        latency_ms=result.get("latency_ms"),
        error=result.get("error")
    )


@router.get("/stats")
async def get_system_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """获取系统统计（已登录用户可读）"""
    from backend.models.database import Document, ReviewTask, DocumentChunk
    from sqlalchemy import func, select

    # 文档数量
    doc_count = await db.scalar(select(func.count(Document.id)))

    # 已处理的文档
    processed_count = await db.scalar(
        select(func.count(Document.id)).where(Document.status == "completed")
    )

    # 向量块数量
    chunk_count = await db.scalar(select(func.count(DocumentChunk.id)))

    # 审查次数
    review_count = await db.scalar(select(func.count(ReviewTask.id)))

    # 审查完成次数
    completed_review = await db.scalar(
        select(func.count(ReviewTask.id)).where(ReviewTask.status == "completed")
    )

    # 待处理/处理中文档数
    pending_docs = await db.scalar(
        select(func.count(Document.id)).where(Document.status.in_(["pending", "processing"]))
    )
    # 合规率（最近完成的审查中合规占比）
    recent_reviews = await db.execute(
        select(ReviewTask).where(ReviewTask.status == "completed").order_by(ReviewTask.completed_at.desc()).limit(50)
    )
    recent_tasks = recent_reviews.scalars().all()
    compliance_rate = 0.0
    if recent_tasks:
        passed = sum(1 for t in recent_tasks if _compliance_is_true(t.result))
        compliance_rate = round(passed / len(recent_tasks) * 100, 1)

    return {
        "total_documents": doc_count or 0,
        "processed_documents": processed_count or 0,
        "total_chunks": chunk_count or 0,
        "total_reviews": review_count or 0,
        "completed_reviews": completed_review or 0,
        "pending_documents": pending_docs or 0,
        "compliance_rate": compliance_rate,
    }


@router.get("/user-stats")
async def get_user_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """获取当前用户的个人统计"""
    from backend.models.database import ReviewTask
    from sqlalchemy import func

    uid = user.id
    total = await db.scalar(select(func.count(ReviewTask.id)).where(ReviewTask.created_by == uid))
    completed = await db.scalar(
        select(func.count(ReviewTask.id)).where(ReviewTask.created_by == uid, ReviewTask.status == "completed")
    )
    pending = await db.scalar(
        select(func.count(ReviewTask.id)).where(ReviewTask.created_by == uid, ReviewTask.status.in_(["pending", "processing"]))
    )
    failed = await db.scalar(
        select(func.count(ReviewTask.id)).where(ReviewTask.created_by == uid, ReviewTask.status == "failed")
    )

    return {
        "total_reviews": total or 0,
        "completed_reviews": completed or 0,
        "pending_reviews": pending or 0,
        "failed_reviews": failed or 0,
    }


@router.get("/recent-activity")
async def get_recent_activity(
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user)
):
    """最近处理动态：最近文档与审查任务"""
    from backend.models.database import Document, ReviewTask
    from sqlalchemy import desc

    activities = []

    # 最近更新的文档
    doc_result = await db.execute(
        select(Document)
        .order_by(desc(Document.updated_at))
        .limit(limit)
    )
    for doc in doc_result.scalars().all():
        status_text = {"pending": "待处理", "processing": "处理中", "completed": "已入库"}.get(doc.status, doc.status)
        activities.append({
            "id": str(doc.id),
            "time": doc.updated_at.isoformat() if doc.updated_at else "",
            "title": f"文档「{doc.title}」{status_text}",
            "type": "upload" if doc.status != "completed" else "vector",
        })

    # 最近审查任务
    task_result = await db.execute(
        select(ReviewTask)
        .order_by(desc(ReviewTask.updated_at))
        .limit(limit)
    )
    task_status_text = {"pending": "待处理", "processing": "处理中", "completed": "已完成", "failed": "失败"}
    for task in task_result.scalars().all():
        activities.append({
            "id": str(task.id),
            "time": task.updated_at.isoformat() if task.updated_at else "",
            "title": f"审查任务「{task.task_name}」{task_status_text.get(task.status, task.status)}",
            "type": "review",
        })

    # 按时间排序，取前 limit 条
    activities.sort(key=lambda x: x["time"], reverse=True)
    return {"items": activities[:limit]}
