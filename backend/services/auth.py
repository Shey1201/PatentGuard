from supabase import create_client, Client
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from uuid import UUID
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.config_local import get_settings
from backend.models.database import User

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Supabase 客户端
_supabase_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """获取 Supabase 客户端单例"""
    global _supabase_client
    if _supabase_client is None:
        if not settings.supabase_url or not settings.supabase_service_key:
            raise ValueError("Supabase configuration not set")
        _supabase_client = create_client(
            settings.supabase_url,
            settings.supabase_service_key
        )
    return _supabase_client


# =================== 用户认证 ===================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.jwt_algorithm)
    return encoded_jwt


# 前端演示模式使用的 token，后端识别后返回默认管理员用户（便于本地/演示不登录即可用）
DEMO_TOKEN = "demo-token-for-preview"


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_user_for_token(token: str, db: AsyncSession) -> User:
    """根据 token 解析出当前用户；支持演示 token 返回默认管理员"""
    if token == DEMO_TOKEN:
        result = await db.execute(select(User).where(User.email == "admin@patentguard.com"))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="演示用户未初始化，请使用 admin@patentguard.com / admin123 登录")
        return user
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="无效的认证")
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="无效的认证")
    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(lambda: None)
) -> User:
    """获取当前用户 - 支持 Supabase Auth"""
    token = credentials.credentials

    # 尝试使用 Supabase 验证 token
    try:
        supabase = get_supabase_client()
        user = supabase.auth.get_user(token)
        if user:
            # 从数据库获取本地用户记录，或自动创建
            result = await db.execute(
                select(User).where(User.email == user.user.email)
            )
            local_user = result.scalar_one_or_none()
            if local_user:
                return local_user
            # 如果本地没有，自动创建用户
            new_user = User(
                email=user.user.email,
                username=user.user.email.split('@')[0],
                password_hash=get_password_hash("supabase-managed"),
                role="user"
            )
            db.add(new_user)
            await db.commit()
            return new_user
    except Exception:
        pass

    # 回退到本地 JWT 验证
    payload = decode_token(token)
    user_id: str = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    return user


async def authenticate_user(email: str, password: str, db: AsyncSession) -> Optional[User]:
    """使用 Supabase Auth 认证用户"""
    try:
        supabase = get_supabase_client()
        # 使用 Supabase 验证登录
        auth_response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })

        if auth_response.user:
            # 查找或创建本地用户
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()

            if not user:
                # 自动创建本地用户记录
                user = User(
                    email=email,
                    username=email.split('@')[0],
                    password_hash=get_password_hash(password),
                    role="user"
                )
                db.add(user)
                await db.commit()
                await db.refresh(user)

            return user

    except Exception as e:
        # Supabase 认证失败，尝试本地认证作为回退
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user and verify_password(password, user.password_hash):
            return user

    return None


def require_admin(current_user: User) -> User:
    """Require admin role"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin permission required"
        )
    return current_user


# =================== Supabase Auth API ===================

async def sign_up(email: str, password: str, db: AsyncSession) -> dict:
    """用户注册（使用 Supabase Auth）"""
    supabase = get_supabase_client()
    auth_response = supabase.auth.sign_up({
        "email": email,
        "password": password
    })

    if auth_response.user:
        # 创建本地用户记录
        user = User(
            email=email,
            username=email.split('@')[0],
            password_hash=get_password_hash(password),
            role="user"
        )
        db.add(user)
        await db.commit()

    return {
        "user_id": auth_response.user.id if auth_response.user else None,
        "email": email,
        "message": "Registration successful. Please check your email to verify."
    }


async def sign_in(email: str, password: str, db: AsyncSession) -> dict:
    """用户登录（使用 Supabase Auth）"""
    supabase = get_supabase_client()
    auth_response = supabase.auth.sign_in_with_password({
        "email": email,
        "password": password
    })

    if auth_response.session:
        # 生成 JWT token 用于 API 访问
        access_token = create_access_token({"sub": str(auth_response.user.id)})

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": auth_response.user.id,
                "email": auth_response.user.email
            }
        }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials"
    )


def sign_out():
    """用户登出"""
    supabase = get_supabase_client()
    supabase.auth.sign_out()