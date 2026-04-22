from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import uuid

from backend.models.database import get_db, User, UserAPIConfig
from backend.models.schemas import (
    UserAPIConfigCreate, UserAPIConfigUpdate, UserAPIConfigResponse,
    UserAPIConfigWithMask, TestLLMResponse, TestUserLLMRequest, MessageResponse
)
from backend.services.auth import decode_token
from backend.services.llm import LLMService

router = APIRouter(prefix="/user/config", tags=["用户配置"])
security = HTTPBearer()


async def get_current_user(credentials = Depends(security), db: AsyncSession = Depends(get_db)):
    """获取当前用户"""
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="无效的认证")
    return user


@router.get("/api", response_model=UserAPIConfigWithMask)
async def get_user_api_config(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """获取当前用户的 API 配置"""
    result = await db.execute(
        select(UserAPIConfig).where(UserAPIConfig.user_id == user.id)
    )
    config = result.scalar_one_or_none()

    if not config:
        # 如果没有配置，返回默认值
        return UserAPIConfigWithMask(
            id=uuid.UUID("00000000-0000-0000-0000-000000000000"),
            user_id=user.id,
            llm_provider="custom",
            llm_api_key=None,
            llm_base_url="",
            llm_model="",
            embedding_model="",
            embedding_api_key=None,
            embedding_base_url="",
            embedding_dim=1536,
            is_active=False,
            created_at=None,
            updated_at=None
        )

    return UserAPIConfigWithMask.from_orm_with_mask(config)


@router.post("/api", response_model=UserAPIConfigWithMask)
async def create_user_api_config(
    config: UserAPIConfigCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """创建用户的 API 配置"""
    # 检查是否已存在
    result = await db.execute(
        select(UserAPIConfig).where(UserAPIConfig.user_id == user.id)
    )
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(status_code=400, detail="用户 API 配置已存在，请使用 PUT 更新")

    # 创建新配置
    new_config = UserAPIConfig(
        user_id=user.id,
        llm_provider=config.llm_provider,
        llm_api_key=config.llm_api_key,
        llm_base_url=config.llm_base_url,
        llm_model=config.llm_model,
        embedding_model=config.embedding_model,
        embedding_api_key=config.embedding_api_key,
        embedding_base_url=config.embedding_base_url,
        embedding_dim=config.embedding_dim,
        is_active=True
    )

    db.add(new_config)
    await db.commit()
    await db.refresh(new_config)

    return UserAPIConfigWithMask.from_orm_with_mask(new_config)


@router.put("/api", response_model=UserAPIConfigWithMask)
async def update_user_api_config(
    config_update: UserAPIConfigUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """更新用户的 API 配置"""
    result = await db.execute(
        select(UserAPIConfig).where(UserAPIConfig.user_id == user.id)
    )
    config = result.scalar_one_or_none()

    if not config:
        # 如果不存在，则创建
        config = UserAPIConfig(
            user_id=user.id,
            llm_provider=config_update.llm_provider or "custom",
            llm_api_key=config_update.llm_api_key,
            llm_base_url=config_update.llm_base_url or "",
            llm_model=config_update.llm_model or "",
            embedding_model=config_update.embedding_model or "",
            embedding_api_key=config_update.embedding_api_key,
            embedding_base_url=config_update.embedding_base_url or "",
            embedding_dim=config_update.embedding_dim or 1536,
            is_active=True
        )
        db.add(config)
    else:
        # 更新现有配置（只更新提供的字段）
        update_data = config_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            if value is not None:
                setattr(config, key, value)

    await db.commit()
    await db.refresh(config)

    return UserAPIConfigWithMask.from_orm_with_mask(config)


@router.delete("/api", response_model=MessageResponse)
async def delete_user_api_config(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """删除用户的 API 配置"""
    result = await db.execute(
        select(UserAPIConfig).where(UserAPIConfig.user_id == user.id)
    )
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(status_code=404, detail="用户 API 配置不存在")

    await db.delete(config)
    await db.commit()

    return MessageResponse(success=True, message="用户 API 配置已删除")


@router.post("/api/test-llm", response_model=TestLLMResponse)
async def test_user_llm(
    test_request: TestUserLLMRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """测试用户的 LLM 配置"""
    # 获取用户的 API 配置
    result = await db.execute(
        select(UserAPIConfig).where(UserAPIConfig.user_id == user.id)
    )
    config = result.scalar_one_or_none()

    if not config or not config.llm_api_key:
        raise HTTPException(status_code=400, detail="请先配置 LLM API Key")

    # 创建 LLM 服务实例
    llm_service = LLMService(
        api_key=config.llm_api_key,
        base_url=config.llm_base_url,
        model=config.llm_model,
        provider=config.llm_provider
    )

    # 测试连接
    test_result = await llm_service.test_connection(test_request.prompt)

    return TestLLMResponse(
        success=test_result["success"],
        response=test_result.get("response"),
        latency_ms=test_result.get("latency_ms"),
        error=test_result.get("error")
    )
