# 本地开发配置 - 支持 Supabase 或本地开发
import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # 数据库 (Supabase)
    database_url: str = "postgresql+asyncpg://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

    # Supabase
    supabase_url: str = "https://[YOUR-PROJECT-REF].supabase.co"
    supabase_anon_key: str = ""
    supabase_service_key: str = ""

    # 本地文件存储
    upload_dir: str = "./uploads"

    # 使用 Supabase Storage
    use_supabase_storage: bool = True
    storage_bucket: str = "documents"

    # MinIO 配置（可选，本地开发可保留）
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin123"
    minio_bucket_name: str = "patentguard"
    minio_secure: bool = False

    # Redis 配置
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    secret_key: str = "local-dev-secret-key"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    # LLM (需要用户配置)
    llm_provider: str = "openai"
    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"

    # Embedding
    embedding_model: str = "text-embedding-3-small"
    embedding_dim: int = 1536
    embedding_api_key: str = ""
    embedding_base_url: str = "https://api.openai.com/v1"

    # 分块配置
    chunk_size: int = 512
    chunk_overlap: int = 50

    # 检索配置
    retrieval_top_k: int = 5
    retrieval_score_threshold: float = 0.5

    # CORS
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173"

    # 日志
    log_level: str = "INFO"

    class Config:
        env_file = ".env"
        extra = "allow"


@lru_cache()
def get_settings() -> Settings:
    return Settings()