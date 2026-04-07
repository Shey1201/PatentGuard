"""
数据埋点 API 路由
提供埋点事件的接收、查询和统计接口
"""
from datetime import datetime, timedelta
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.database import get_db, BusinessEvent, User
from backend.models.schemas import (
    TrackEventCreate,
    TrackEventBatchCreate,
    TrackEventResponse,
    TrackStatsRequest,
    TrackStatsResponse,
    APILogResponse,
    PaginatedResponse,
)
from backend.services.tracking import TrackingService
from backend.api.auth import get_current_user, get_optional_user
import loguru

router = APIRouter(prefix="/track", tags=["数据埋点"])


@router.post("/events", response_model=TrackEventResponse, summary="记录单个埋点事件")
async def create_event(
    event: TrackEventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    记录单个埋点事件

    - **event_name**: 事件名称（如 page_view, button_click 等）
    - **event_category**: 事件类别（如 user_action, business, system 等）
    - **session_id**: 会话 ID
    - **resource_id**: 关联资源 ID（如文档 ID、任务 ID 等）
    - **properties**: 自定义属性（字典形式）
    - **system_info**: 系统信息（设备、浏览器、操作系统等）
    """
    user_id = UUID(current_user.id) if current_user else None
    db_event = await TrackingService.create_event(db, event, user_id)
    return db_event


@router.post("/events/batch", response_model=List[TrackEventResponse], summary="批量记录埋点事件")
async def create_events_batch(
    batch: TrackEventBatchCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    批量记录埋点事件

    适用于前端将多个事件打包一起发送，减少网络请求次数
    """
    user_id = UUID(current_user.id) if current_user else None
    db_events = await TrackingService.create_events_batch(db, batch.events, user_id)
    return db_events


@router.get("/events", response_model=PaginatedResponse, summary="查询埋点事件列表")
async def get_events(
    event_name: Optional[str] = Query(None, description="事件名称"),
    event_category: Optional[str] = Query(None, description="事件类别"),
    session_id: Optional[str] = Query(None, description="会话 ID"),
    start_date: Optional[str] = Query(None, description="开始日期 (ISO 格式)"),
    end_date: Optional[str] = Query(None, description="结束日期 (ISO 格式)"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=100, description="每页数量"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    查询埋点事件列表

    支持按事件名称、类别、会话 ID、时间范围等条件筛选
    """
    start_dt = datetime.fromisoformat(start_date) if start_date else None
    end_dt = datetime.fromisoformat(end_date) if end_date else None

    result = await TrackingService.get_events(
        db,
        user_id=UUID(current_user.id) if current_user else None,
        event_name=event_name,
        event_category=event_category,
        session_id=session_id,
        start_date=start_dt,
        end_date=end_dt,
        page=page,
        page_size=page_size,
    )

    return {
        "items": result["items"],
        "total": result["total"],
        "page": result["page"],
        "page_size": result["page_size"],
    }


@router.get("/stats", response_model=TrackStatsResponse, summary="获取埋点统计数据")
async def get_stats(
    start_date: Optional[str] = Query(None, description="开始日期 (ISO 格式)"),
    end_date: Optional[str] = Query(None, description="结束日期 (ISO 格式)"),
    event_name: Optional[str] = Query(None, description="事件名称"),
    event_category: Optional[str] = Query(None, description="事件类别"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    获取埋点统计数据

    返回指定时间范围内的统计数据，包括：
    - 总事件数
    - 各事件类型数量
    - 每日事件数量趋势
    - 用户数
    - 页面访问统计
    - 行为统计
    """
    request = TrackStatsRequest(
        start_date=start_date,
        end_date=end_date,
        event_name=event_name,
        event_category=event_category,
    )
    stats = await TrackingService.get_stats(
        db,
        request,
        user_id=UUID(current_user.id) if current_user else None,
    )
    return stats


@router.get("/api-logs", response_model=PaginatedResponse, summary="查询 API 调用日志")
async def get_api_logs(
    endpoint: Optional[str] = Query(None, description="API 端点（模糊匹配）"),
    status_code: Optional[int] = Query(None, description="状态码"),
    start_date: Optional[str] = Query(None, description="开始日期 (ISO 格式)"),
    end_date: Optional[str] = Query(None, description="结束日期 (ISO 格式)"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=100, description="每页数量"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    查询 API 调用日志（仅管理员可用）

    记录所有 API 请求的调用情况，包括：
    - 请求方法、端点、状态码
    - 响应时间、请求大小、响应大小
    - 用户 IP、User-Agent
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可查询 API 日志")

    start_dt = datetime.fromisoformat(start_date) if start_date else None
    end_dt = datetime.fromisoformat(end_date) if end_date else None

    result = await TrackingService.get_api_logs(
        db,
        user_id=None,
        endpoint=endpoint,
        status_code=status_code,
        start_date=start_dt,
        end_date=end_dt,
        page=page,
        page_size=page_size,
    )

    return {
        "items": result["items"],
        "total": result["total"],
        "page": result["page"],
        "page_size": result["page_size"],
    }


@router.get("/events/export", summary="导出埋点事件数据")
async def export_events(
    start_date: str = Query(..., description="开始日期 (ISO 格式)"),
    end_date: str = Query(..., description="结束日期 (ISO 格式)"),
    event_category: Optional[str] = Query(None, description="事件类别"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    导出埋点事件数据为 JSON 格式

    适用于将数据导出到外部分析工具
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可导出数据")

    start_dt = datetime.fromisoformat(start_date)
    end_dt = datetime.fromisoformat(end_date)

    result = await TrackingService.get_events(
        db,
        user_id=None,
        event_category=event_category,
        start_date=start_dt,
        end_date=end_dt,
        page=1,
        page_size=10000,
    )

    events = []
    for event in result["items"]:
        events.append({
            "id": str(event.id),
            "event_name": event.event_name,
            "event_category": event.event_category,
            "user_id": str(event.user_id) if event.user_id else None,
            "session_id": event.session_id,
            "resource_id": str(event.resource_id) if event.resource_id else None,
            "properties": event.properties,
            "system_info": event.system_info,
            "created_at": event.created_at.isoformat(),
        })

    return {
        "total": len(events),
        "start_date": start_date,
        "end_date": end_date,
        "events": events,
    }


@router.get("/dashboard-stats", summary="获取管理员看板统计数据")
async def get_dashboard_stats(
    start_date: Optional[str] = Query(None, description="开始日期 (ISO 格式)"),
    end_date: Optional[str] = Query(None, description="结束日期 (ISO 格式)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    获取管理员看板统计数据

    返回总事件数、活跃用户数、各类事件数量等
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可查看看板数据")

    start_dt = datetime.fromisoformat(start_date) if start_date else None
    end_dt = datetime.fromisoformat(end_date) if end_date else None

    stats = await TrackingService.get_dashboard_stats(db, start_dt, end_dt)
    return stats


@router.get("/daily-trend", summary="获取每日趋势数据")
async def get_daily_trend(
    start_date: Optional[str] = Query(None, description="开始日期 (ISO 格式)"),
    end_date: Optional[str] = Query(None, description="结束日期 (ISO 格式)"),
    event_name: Optional[str] = Query(None, description="事件名称"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    获取每日趋势数据

    返回日期、日活用户数、页面浏览数、审查完成数等
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可查看趋势数据")

    start_dt = datetime.fromisoformat(start_date) if start_date else None
    end_dt = datetime.fromisoformat(end_date) if end_date else None

    trend = await TrackingService.get_daily_trend(db, start_dt, end_dt, event_name)
    return trend


@router.get("/funnel", summary="获取审查流程漏斗数据")
async def get_funnel_data(
    start_date: Optional[str] = Query(None, description="开始日期 (ISO 格式)"),
    end_date: Optional[str] = Query(None, description="结束日期 (ISO 格式)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    获取审查流程漏斗数据

    返回文档上传→提交审查→审查完成→查看结果的转化漏斗
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可查看漏斗数据")

    start_dt = datetime.fromisoformat(start_date) if start_date else None
    end_dt = datetime.fromisoformat(end_date) if end_date else None

    funnel = await TrackingService.get_funnel_data(db, start_dt, end_dt)
    return funnel


@router.get("/review-type-distribution", summary="获取审查类型分布")
async def get_review_type_distribution(
    start_date: Optional[str] = Query(None, description="开始日期 (ISO 格式)"),
    end_date: Optional[str] = Query(None, description="结束日期 (ISO 格式)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    获取审查类型分布

    返回各类审查（专利、合同、商标、版权等）的数量分布
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可查看分布数据")

    start_dt = datetime.fromisoformat(start_date) if start_date else None
    end_dt = datetime.fromisoformat(end_date) if end_date else None

    distribution = await TrackingService.get_review_type_distribution(db, start_dt, end_dt)
    return distribution


@router.get("/risk-distribution", summary="获取风险等级分布")
async def get_risk_distribution(
    start_date: Optional[str] = Query(None, description="开始日期 (ISO 格式)"),
    end_date: Optional[str] = Query(None, description="结束日期 (ISO 格式)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    获取风险等级分布

    返回高风险、中风险、低风险文档的数量分布
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可查看分布数据")

    start_dt = datetime.fromisoformat(start_date) if start_date else None
    end_dt = datetime.fromisoformat(end_date) if end_date else None

    distribution = await TrackingService.get_risk_distribution(db, start_dt, end_dt)
    return distribution


@router.get("/api-performance", summary="获取 API 性能统计")
async def get_api_performance(
    start_date: Optional[str] = Query(None, description="开始日期 (ISO 格式)"),
    end_date: Optional[str] = Query(None, description="结束日期 (ISO 格式)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    获取 API 性能统计

    返回各 API 端点的平均响应时间、P50、P95 等指标
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可查看性能数据")

    start_dt = datetime.fromisoformat(start_date) if start_date else None
    end_dt = datetime.fromisoformat(end_date) if end_date else None

    performance = await TrackingService.get_api_performance(db, start_dt, end_dt)
    return performance
