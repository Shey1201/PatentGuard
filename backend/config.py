from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # Database (Supabase)
    database_url: str = "postgresql+asyncpg://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

    # Supabase
    supabase_url: str = "https://[YOUR-PROJECT-REF].supabase.co"
    supabase_anon_key: str = ""
    supabase_service_key: str = ""

    # MinIO (可选，如果使用 Supabase Storage 则可移除)
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin123"
    minio_bucket_name: str = "patentguard"
    minio_secure: bool = False

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    secret_key: str = "patentguard-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    # LLM (Default - 可被数据库配置覆盖)
    llm_provider: str = "openai"
    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"

    # Embedding
    embedding_model: str = "text-embedding-3-small"
    embedding_dim: int = 1536
    embedding_api_key: str = ""
    embedding_base_url: str = "https://api.openai.com/v1"

    # Chunk
    chunk_size: int = 512
    chunk_overlap: int = 50

    # Retrieval
    retrieval_top_k: int = 5
    retrieval_score_threshold: float = 0.5

    # CORS
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Log
    log_level: str = "INFO"

    class Config:
        env_file = ".env"
        extra = "allow"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
