from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import loguru

from backend.config_local import get_settings
from backend.models.database import init_db
from backend.api import auth, kb, analysis, system, user_config

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
