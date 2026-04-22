from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import time
import loguru

from backend.config import get_settings
from backend.models.database import init_db, get_db, AsyncSessionLocal
from backend.api import auth, kb, analysis, system, user_config
from backend.api.tracking import router as tracking_router
from backend.services.tracking import TrackingService

settings = get_settings()

loguru.logger.add(
    "logs/app.log",
    rotation="500 MB",
    retention="10 days",
    level=settings.log_level
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    loguru.logger.info("正在启动 PatentGuard...")
    await init_db()
    loguru.logger.info("数据库初始化完成")
    yield
    loguru.logger.info("PatentGuard 关闭中...")


app = FastAPI(
    title="PatentGuard API",
    description="自动化专利/文档合规审查系统 API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS 配置
origins = settings.cors_origins.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router, prefix="/api/v1")
app.include_router(kb.router, prefix="/api/v1")
app.include_router(analysis.router, prefix="/api/v1")
app.include_router(system.router, prefix="/api/v1")
app.include_router(user_config.router, prefix="/api/v1")
app.include_router(tracking_router, prefix="/api/v1")


@app.middleware("http")
async def api_logging_middleware(request: Request, call_next):
    """API 日志记录中间件"""
    if request.url.path.startswith("/api/"):
        start_time = time.time()

        request_size = 0
        if request.method in ["POST", "PUT", "PATCH"]:
            try:
                body = await request.body()
                request_size = len(body)
            except Exception:
                pass

        response = await call_next(request)

        duration_ms = int((time.time() - start_time) * 1000)
        status_code = response.status_code

        try:
            async with AsyncSessionLocal() as session:
                user_id = None
                try:
                    from backend.api.auth import get_user_from_token
                    auth_header = request.headers.get("Authorization")
                    if auth_header and auth_header.startswith("Bearer "):
                        token = auth_header[7:]
                        user = await get_user_from_token(token)
                        if user:
                            user_id = user.id
                except Exception:
                    pass

                ip_address = request.client.host if request.client else None
                user_agent = request.headers.get("user-agent")

                await TrackingService.log_api_call(
                    session=session,
                    method=request.method,
                    endpoint=request.url.path,
                    status_code=status_code,
                    duration_ms=duration_ms,
                    user_id=user_id,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    request_size=request_size,
                )
        except Exception as e:
            loguru.logger.warning(f"API 日志记录失败: {e}")

        return response
    else:
        return await call_next(request)


@app.get("/")
async def root():
    return {
        "name": "PatentGuard API",
        "version": "1.0.0",
        "description": "自动化专利/文档合规审查系统"
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
