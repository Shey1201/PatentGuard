from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta
from typing import List
import uuid

from backend.models.database import get_db, User, SystemConfig
from backend.models.schemas import (
    UserCreate, UserLogin, UserResponse, Token,
    MessageResponse
)
from backend.services.auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, decode_token, sign_up, sign_in, authenticate_user
)
from backend.config_local import get_settings

router = APIRouter(prefix="/auth", tags=["认证"])
security = HTTPBearer()
settings = get_settings()


@router.post("/register", response_model=Token)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """用户注册 (使用 Supabase Auth)"""
    try:
        # 使用 Supabase Auth 注册
        result = await sign_up(user_data.email, user_data.password, db)

        # 查找本地用户记录
        result = await db.execute(select(User).where(User.email == user_data.email))
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="注册失败，请重试"
            )

        # 生成 token
        access_token = create_access_token(
            data={"sub": str(user.id)},
            expires_delta=timedelta(minutes=settings.access_token_expire_minutes)
        )

        return Token(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.access_token_expire_minutes * 60,
            user=UserResponse.model_validate(user)
        )

    except Exception as e:
        # 回退到本地注册
        result = await db.execute(select(User).where(User.email == user_data.email))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="邮箱已被注册"
            )

        user = User(
            email=user_data.email,
            username=user_data.username,
            password_hash=get_password_hash(user_data.password),
            role="user"
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        access_token = create_access_token(
            data={"sub": str(user.id)},
            expires_delta=timedelta(minutes=settings.access_token_expire_minutes)
        )

        return Token(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.access_token_expire_minutes * 60,
            user=UserResponse.model_validate(user)
        )


@router.post("/login", response_model=Token)
async def login(login_data: UserLogin, db: AsyncSession = Depends(get_db)):
    """用户登录 (使用 Supabase Auth)"""
    # 优先使用 Supabase Auth 验证
    user = await authenticate_user(login_data.email, login_data.password, db)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="邮箱或密码错误"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账户已被禁用"
        )

    # 生成 token
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes)
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserResponse.model_validate(user)
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    credentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """刷新 Token"""
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在或已被禁用"
        )

    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes)
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    credentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """获取当前用户信息"""
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    return UserResponse.model_validate(user)
