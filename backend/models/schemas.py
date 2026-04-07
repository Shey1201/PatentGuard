from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime


# User schemas
class UserBase(BaseModel):
    email: EmailStr
    username: str


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: UUID
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: UserResponse


# System Config schemas
class SystemConfigBase(BaseModel):
    config_key: str
    config_value: str


class SystemConfigResponse(SystemConfigBase):
    id: UUID
    description: Optional[str]
    updated_at: datetime

    class Config:
        from_attributes = True


class LLMConfigUpdate(BaseModel):
    llm_provider: Optional[str] = None  # 可选，不填则保留原值
    llm_model: str
    llm_api_key: str
    llm_base_url: str


class EmbeddingConfigUpdate(BaseModel):
    embedding_model: str
    chunk_size: int
    chunk_overlap: int
    retrieval_top_k: int


# Category schemas
class CategoryBase(BaseModel):
    name: str
    type: str
    description: Optional[str] = None


class CategoryCreate(CategoryBase):
    pass


class CategoryResponse(CategoryBase):
    id: UUID
    document_count: Optional[int] = 0
    created_at: datetime

    class Config:
        from_attributes = True


# Document schemas
class DocumentBase(BaseModel):
    title: str
    category_id: Optional[UUID] = None
    document_type: Optional[str] = None
    tags: Optional[List[str]] = None


class DocumentCreate(DocumentBase):
    pass


class DocumentResponse(DocumentBase):
    id: UUID
    original_filename: Optional[str]
    file_path: Optional[str]
    file_size: Optional[int]
    file_type: Optional[str]
    status: str
    content: Optional[str]
    uploaded_by: Optional[UUID]
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentWithChunks(DocumentResponse):
    chunks: Optional[List[Dict[str, Any]]] = []


# Chunk schemas
class ChunkResponse(BaseModel):
    id: UUID
    chunk_index: int
    chunk_text: str
    start_position: Optional[int]
    end_position: Optional[int]

    class Config:
        from_attributes = True


# Review Task schemas
class ReviewTaskCreate(BaseModel):
    task_name: str
    document_id: Optional[UUID] = None
    document_title: Optional[str] = None
    review_type: str


class ReviewTaskResponse(BaseModel):
    id: UUID
    task_name: str
    document_title: Optional[str] = None
    review_type: str = "general"
    status: str
    result: Optional[Dict[str, Any]]
    error_message: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


# Review Result schemas
class ReviewResultResponse(BaseModel):
    task_id: UUID
    document_title: str
    compliance: bool
    risk_level: str
    summary: str
    findings: List[Dict[str, Any]]
    referenced_documents: List[Dict[str, Any]]
    created_at: datetime


# Search schemas
class SearchResult(BaseModel):
    document_id: UUID
    document_title: str
    chunk_text: str
    score: float
    metadata: Optional[Dict[str, Any]]


class SearchResponse(BaseModel):
    results: List[SearchResult]


# Test LLM
class TestLLMRequest(BaseModel):
    prompt: str


class TestLLMResponse(BaseModel):
    success: bool
    response: Optional[str]
    latency_ms: Optional[int]
    error: Optional[str]


# Pagination
class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int


# Generic Response
class MessageResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None


# User API Config schemas (每个用户独立的 API 配置)
class UserAPIConfigBase(BaseModel):
    # LLM 配置
    llm_provider: str = "openai"
    llm_api_key: Optional[str] = None
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"

    # Embedding 配置
    embedding_model: str = "text-embedding-3-small"
    embedding_api_key: Optional[str] = None
    embedding_base_url: str = "https://api.openai.com/v1"
    embedding_dim: int = 1536


class UserAPIConfigCreate(UserAPIConfigBase):
    pass


class UserAPIConfigUpdate(BaseModel):
    # 所有字段都是可选的，允许部分更新
    llm_provider: Optional[str] = None
    llm_api_key: Optional[str] = None
    llm_base_url: Optional[str] = None
    llm_model: Optional[str] = None
    embedding_model: Optional[str] = None
    embedding_api_key: Optional[str] = None
    embedding_base_url: Optional[str] = None
    embedding_dim: Optional[int] = None


class UserAPIConfigResponse(BaseModel):
    id: UUID
    user_id: UUID
    llm_provider: str
    llm_base_url: str
    llm_model: str
    embedding_model: str
    embedding_base_url: str
    embedding_dim: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    # 这些字段不直接返回，需要单独获取
    llm_api_key: Optional[str] = None
    embedding_api_key: Optional[str] = None

    class Config:
        from_attributes = True


class UserAPIConfigWithMask(UserAPIConfigBase):
    """返回给用户时隐藏 API Key"""
    id: UUID
    user_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    # 隐藏敏感的 API key
    llm_api_key: Optional[str] = None
    embedding_api_key: Optional[str] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_mask(cls, obj):
        data = {
            "id": obj.id,
            "user_id": obj.user_id,
            "llm_provider": obj.llm_provider,
            "llm_api_key": "***" if obj.llm_api_key else None,
            "llm_base_url": obj.llm_base_url,
            "llm_model": obj.llm_model,
            "embedding_model": obj.embedding_model,
            "embedding_api_key": "***" if obj.embedding_api_key else None,
            "embedding_base_url": obj.embedding_base_url,
            "embedding_dim": obj.embedding_dim,
            "is_active": obj.is_active,
            "created_at": obj.created_at,
            "updated_at": obj.updated_at,
        }
        return cls(**data)


class TestUserLLMRequest(BaseModel):
    prompt: str
