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
    llm_provider: str = "custom"
    llm_api_key: Optional[str] = None
    llm_base_url: str = ""
    llm_model: str = ""

    # Embedding 配置
    embedding_model: str = ""
    embedding_api_key: Optional[str] = None
    embedding_base_url: str = ""
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


# ===== 数据埋点相关 Schema =====

class TrackEventBase(BaseModel):
    """埋点事件基础模型"""
    event_name: str
    event_category: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None


class TrackEventCreate(TrackEventBase):
    """创建埋点事件"""
    session_id: Optional[str] = None
    resource_id: Optional[str] = None
    system_info: Optional[Dict[str, Any]] = None


class TrackEventBatchCreate(BaseModel):
    """批量创建埋点事件"""
    events: List[TrackEventCreate]


class TrackEventResponse(BaseModel):
    """埋点事件响应"""
    id: UUID
    event_name: str
    event_category: Optional[str]
    user_id: Optional[UUID]
    session_id: Optional[str]
    resource_id: Optional[UUID]
    properties: Optional[Dict[str, Any]]
    system_info: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True


class APILogResponse(BaseModel):
    """API 日志响应"""
    id: UUID
    user_id: Optional[UUID]
    method: Optional[str]
    endpoint: Optional[str]
    status_code: Optional[int]
    duration_ms: Optional[int]
    request_size: Optional[int]
    response_size: Optional[int]
    ip_address: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class TrackStatsRequest(BaseModel):
    """埋点统计请求"""
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    event_name: Optional[str] = None
    event_category: Optional[str] = None
    group_by: Optional[str] = None


class TrackStatsResponse(BaseModel):
    """埋点统计响应"""
    total_count: int
    event_counts: Dict[str, int]
    daily_counts: List[Dict[str, Any]]
    user_counts: int
    page_view_counts: Dict[str, int]
    action_counts: Dict[str, int]


# ===== 新增：可视化看板相关 Schema =====

class DashboardStatsResponse(BaseModel):
    """管理员看板统计数据响应"""
    total_events: int
    active_users: int
    event_counts: Dict[str, int]


class DailyTrendItem(BaseModel):
    """每日趋势数据项"""
    date: str
    dau: int = 0
    page_views: int = 0
    reviews: int = 0
    uploads: int = 0
    searches: int = 0


class DailyTrendResponse(BaseModel):
    """每日趋势响应"""
    trend: List[DailyTrendItem]


class FunnelItem(BaseModel):
    """漏斗数据项"""
    step: str
    count: int
    rate: float


class FunnelResponse(BaseModel):
    """漏斗数据响应"""
    funnel: List[FunnelItem]


class DistributionItem(BaseModel):
    """分布数据项"""
    name: str
    value: int


class DistributionResponse(BaseModel):
    """分布数据响应"""
    distribution: List[DistributionItem]


class APIPerfItem(BaseModel):
    """API 性能数据项"""
    endpoint: str
    call_count: int
    avg_ms: float
    p50_ms: float
    p95_ms: float


class APIPerformanceResponse(BaseModel):
    """API 性能响应"""
    performance: List[APIPerfItem]
