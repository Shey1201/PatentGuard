"""
数据埋点服务
提供埋点事件的记录、查询和统计分析功能
"""
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.database import BusinessEvent, APILog
from backend.models.schemas import (
    TrackEventCreate,
    TrackEventBatchCreate,
    TrackStatsRequest,
    TrackStatsResponse,
)
from backend.api.auth import get_current_user
import loguru


class TrackingService:
    """埋点服务类"""

    @staticmethod
    async def create_event(
        session: AsyncSession,
        event: TrackEventCreate,
        user_id: Optional[UUID] = None
    ) -> BusinessEvent:
        """创建单个埋点事件"""
        db_event = BusinessEvent(
            event_name=event.event_name,
            event_category=event.event_category,
            user_id=user_id,
            session_id=event.session_id,
            resource_id=event.resource_id,
            properties=event.properties,
            system_info=event.system_info,
        )
        session.add(db_event)
        await session.commit()
        await session.refresh(db_event)
        loguru.logger.debug(f"埋点事件已记录: {event.event_name}")
        return db_event

    @staticmethod
    async def create_events_batch(
        session: AsyncSession,
        events: List[TrackEventCreate],
        user_id: Optional[UUID] = None
    ) -> List[BusinessEvent]:
        """批量创建埋点事件"""
        db_events = []
        for event in events:
            db_event = BusinessEvent(
                event_name=event.event_name,
                event_category=event.event_category,
                user_id=user_id,
                session_id=event.session_id,
                resource_id=event.resource_id,
                properties=event.properties,
                system_info=event.system_info,
            )
            db_events.append(db_event)
        session.add_all(db_events)
        await session.commit()
        for event in db_events:
            await session.refresh(event)
        loguru.logger.debug(f"批量埋点事件已记录: {len(events)} 条")
        return db_events

    @staticmethod
    async def get_events(
        session: AsyncSession,
        user_id: Optional[UUID] = None,
        event_name: Optional[str] = None,
        event_category: Optional[str] = None,
        session_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Dict[str, Any]:
        """查询埋点事件列表"""
        query = select(BusinessEvent)

        conditions = []
        if user_id:
            conditions.append(BusinessEvent.user_id == user_id)
        if event_name:
            conditions.append(BusinessEvent.event_name == event_name)
        if event_category:
            conditions.append(BusinessEvent.event_category == event_category)
        if session_id:
            conditions.append(BusinessEvent.session_id == session_id)
        if start_date:
            conditions.append(BusinessEvent.created_at >= start_date)
        if end_date:
            conditions.append(BusinessEvent.created_at <= end_date)

        if conditions:
            query = query.where(and_(*conditions))

        query = query.order_by(desc(BusinessEvent.created_at))

        count_query = select(func.count(BusinessEvent.id))
        if conditions:
            count_query = count_query.where(and_(*conditions))
        total_result = await session.execute(count_query)
        total = total_result.scalar()

        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await session.execute(query)
        events = result.scalars().all()

        return {
            "items": events,
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    @staticmethod
    async def get_stats(
        session: AsyncSession,
        request: TrackStatsRequest,
        user_id: Optional[UUID] = None,
    ) -> TrackStatsResponse:
        """获取埋点统计数据"""
        conditions = []
        if user_id:
            conditions.append(BusinessEvent.user_id == user_id)
        if request.event_name:
            conditions.append(BusinessEvent.event_name == request.event_name)
        if request.event_category:
            conditions.append(BusinessEvent.event_category == request.event_category)

        if request.start_date:
            conditions.append(
                BusinessEvent.created_at >= datetime.fromisoformat(request.start_date)
            )
        if request.end_date:
            conditions.append(
                BusinessEvent.created_at <= datetime.fromisoformat(request.end_date)
            )

        where_clause = and_(*conditions) if conditions else True

        base_query = select(BusinessEvent).where(where_clause)

        total_result = await session.execute(select(func.count(BusinessEvent.id)).where(where_clause))
        total_count = total_result.scalar()

        user_count_result = await session.execute(
            select(func.count(func.distinct(BusinessEvent.user_id))).where(where_clause)
        )
        user_count = user_count_result.scalar()

        event_counts_result = await session.execute(
            select(BusinessEvent.event_name, func.count(BusinessEvent.id))
            .where(where_clause)
            .group_by(BusinessEvent.event_name)
        )
        event_counts = {row[0]: row[1] for row in event_counts_result.all()}

        daily_counts_result = await session.execute(
            select(
                func.date(BusinessEvent.created_at).label("date"),
                func.count(BusinessEvent.id).label("count"),
            )
            .where(where_clause)
            .group_by(func.date(BusinessEvent.created_at))
            .order_by(func.date(BusinessEvent.created_at))
        )
        daily_counts = [
            {"date": str(row[0]), "count": row[1]}
            for row in daily_counts_result.all()
        ]

        category_counts_result = await session.execute(
            select(
                BusinessEvent.event_category,
                func.count(BusinessEvent.id).label("count"),
            )
            .where(where_clause)
            .group_by(BusinessEvent.event_category)
        )
        category_counts = {row[0] or "unknown": row[1] for row in category_counts_result.all()}

        return TrackStatsResponse(
            total_count=total_count or 0,
            event_counts=event_counts,
            daily_counts=daily_counts,
            user_counts=user_count or 0,
            page_view_counts={},
            action_counts=category_counts,
        )

    @staticmethod
    async def log_api_call(
        session: AsyncSession,
        method: str,
        endpoint: str,
        status_code: int,
        duration_ms: int,
        user_id: Optional[UUID] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_size: Optional[int] = None,
        response_size: Optional[int] = None,
        error_message: Optional[str] = None,
    ) -> APILog:
        """记录 API 调用日志"""
        api_log = APILog(
            user_id=user_id,
            method=method,
            endpoint=endpoint,
            status_code=status_code,
            duration_ms=duration_ms,
            ip_address=ip_address,
            user_agent=user_agent,
            request_size=request_size,
            response_size=response_size,
            error_message=error_message,
        )
        session.add(api_log)
        await session.commit()
        await session.refresh(api_log)
        return api_log

    @staticmethod
    async def get_api_logs(
        session: AsyncSession,
        user_id: Optional[UUID] = None,
        endpoint: Optional[str] = None,
        status_code: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Dict[str, Any]:
        """查询 API 调用日志"""
        query = select(APILog)

        conditions = []
        if user_id:
            conditions.append(APILog.user_id == user_id)
        if endpoint:
            conditions.append(APILog.endpoint.like(f"%{endpoint}%"))
        if status_code:
            conditions.append(APILog.status_code == status_code)
        if start_date:
            conditions.append(APILog.created_at >= start_date)
        if end_date:
            conditions.append(APILog.created_at <= end_date)

        if conditions:
            query = query.where(and_(*conditions))

        query = query.order_by(desc(APILog.created_at))

        count_query = select(func.count(APILog.id))
        if conditions:
            count_query = count_query.where(and_(*conditions))
        total_result = await session.execute(count_query)
        total = total_result.scalar()

        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await session.execute(query)
        logs = result.scalars().all()

        return {
            "items": logs,
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    @staticmethod
    async def get_dashboard_stats(
        session: AsyncSession,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """获取管理员看板统计数据"""
        conditions = []
        if start_date:
            conditions.append(BusinessEvent.created_at >= start_date)
        if end_date:
            conditions.append(BusinessEvent.created_at <= end_date)

        where_clause = and_(*conditions) if conditions else True

        # 总事件数
        total_result = await session.execute(select(func.count(BusinessEvent.id)).where(where_clause))
        total_events = total_result.scalar() or 0

        # 活跃用户数
        user_count_result = await session.execute(
            select(func.count(func.distinct(BusinessEvent.user_id))).where(where_clause)
        )
        active_users = user_count_result.scalar() or 0

        # 各事件类型数量
        event_counts_result = await session.execute(
            select(BusinessEvent.event_name, func.count(BusinessEvent.id))
            .where(where_clause)
            .group_by(BusinessEvent.event_name)
        )
        event_counts = {row[0]: row[1] for row in event_counts_result.all()}

        return {
            "total_events": total_events,
            "active_users": active_users,
            "event_counts": event_counts,
        }

    @staticmethod
    async def get_daily_trend(
        session: AsyncSession,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        event_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """获取每日趋势数据"""
        conditions = []
        if start_date:
            conditions.append(BusinessEvent.created_at >= start_date)
        if end_date:
            conditions.append(BusinessEvent.created_at <= end_date)
        if event_name:
            conditions.append(BusinessEvent.event_name == event_name)

        where_clause = and_(*conditions) if conditions else True

        # 按日期分组，获取日活用户数和各类事件数量
        daily_stats_result = await session.execute(
            select(
                func.date(BusinessEvent.created_at).label("date"),
                func.count(func.distinct(BusinessEvent.user_id)).label("dau"),
                func.count(BusinessEvent.id).label("total_events"),
            )
            .where(where_clause)
            .group_by(func.date(BusinessEvent.created_at))
            .order_by(func.date(BusinessEvent.created_at))
        )

        trend = []
        for row in daily_stats_result.all():
            date_str = str(row[0]) if row[0] else None
            if date_str:
                trend.append({
                    "date": date_str,
                    "dau": row[1] or 0,
                    "page_views": 0,  # 从 event_counts 中获取
                    "reviews": 0,
                    "uploads": 0,
                    "searches": 0,
                })

        # 获取各事件的每日数量
        if start_date and end_date:
            for event_type in ['page_view', 'review_complete', 'document_upload', 'search_action']:
                event_result = await session.execute(
                    select(
                        func.date(BusinessEvent.created_at).label("date"),
                        func.count(BusinessEvent.id).label("count"),
                    )
                    .where(and_(
                        BusinessEvent.created_at >= start_date,
                        BusinessEvent.created_at <= end_date,
                        BusinessEvent.event_name == event_type
                    ))
                    .group_by(func.date(BusinessEvent.created_at))
                    .order_by(func.date(BusinessEvent.created_at))
                )
                event_map = {str(row[0]): row[1] for row in event_result.all()}
                field_map = {
                    'page_view': 'page_views',
                    'review_complete': 'reviews',
                    'document_upload': 'uploads',
                    'search_action': 'searches',
                }
                field_name = field_map.get(event_type, '')
                for item in trend:
                    if item["date"] in event_map:
                        item[field_name] = event_map[item["date"]]

        return {"trend": trend}

    @staticmethod
    async def get_funnel_data(
        session: AsyncSession,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """获取审查流程漏��数据"""
        funnel_conditions = []
        if start_date:
            funnel_conditions.append(BusinessEvent.created_at >= start_date)
        if end_date:
            funnel_conditions.append(BusinessEvent.created_at <= end_date)

        funnel = []

        # 文档上传
        upload_where = and_(*funnel_conditions, BusinessEvent.event_name == 'document_upload') if funnel_conditions else BusinessEvent.event_name == 'document_upload'
        upload_result = await session.execute(select(func.count(func.distinct(BusinessEvent.resource_id))).where(upload_where))
        upload_count = upload_result.scalar() or 0
        funnel.append({"step": "文档上传", "count": upload_count, "rate": 100})

        # 提交审查
        submit_where = and_(*funnel_conditions, BusinessEvent.event_name == 'review_submit') if funnel_conditions else BusinessEvent.event_name == 'review_submit'
        submit_result = await session.execute(select(func.count(func.distinct(BusinessEvent.resource_id))).where(submit_where))
        submit_count = submit_result.scalar() or 0
        funnel.append({"step": "提交审查", "count": submit_count, "rate": upload_count > 0 and round(submit_count / upload_count * 100, 2) or 0})

        # 审查完成
        complete_where = and_(*funnel_conditions, BusinessEvent.event_name == 'review_complete') if funnel_conditions else BusinessEvent.event_name == 'review_complete'
        complete_result = await session.execute(select(func.count(func.distinct(BusinessEvent.resource_id))).where(complete_where))
        complete_count = complete_result.scalar() or 0
        funnel.append({"step": "审查完成", "count": complete_count, "rate": upload_count > 0 and round(complete_count / upload_count * 100, 2) or 0})

        # 查看结果
        view_where = and_(*funnel_conditions, BusinessEvent.event_name == 'review_view_result') if funnel_conditions else BusinessEvent.event_name == 'review_view_result'
        view_result = await session.execute(select(func.count(func.distinct(BusinessEvent.resource_id))).where(view_where))
        view_count = view_result.scalar() or 0
        funnel.append({"step": "查看结果", "count": view_count, "rate": upload_count > 0 and round(view_count / upload_count * 100, 2) or 0})

        return {"funnel": funnel}

    @staticmethod
    async def get_review_type_distribution(
        session: AsyncSession,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """获取审查类型分布"""
        conditions = [BusinessEvent.event_name.in_(['review_submit', 'review_complete'])]
        if start_date:
            conditions.append(BusinessEvent.created_at >= start_date)
        if end_date:
            conditions.append(BusinessEvent.created_at <= end_date)

        result = await session.execute(
            select(
                BusinessEvent.properties["review_type"].astext.label("review_type"),
                func.count(BusinessEvent.id).label("count"),
            )
            .where(and_(*conditions))
            .group_by(BusinessEvent.properties["review_type"].astext)
            .order_by(func.count(BusinessEvent.id).desc())
        )

        distribution = []
        for row in result.all():
            review_type = row[0] or 'unknown'
            name_map = {
                'patent': '专利审查',
                'contract': '合同审查',
                'trademark': '商标审查',
                'copyright': '版权审查',
                'other': '其他',
                'unknown': '未知',
            }
            distribution.append({
                "name": name_map.get(review_type, review_type),
                "value": row[1] or 0,
            })

        return {"distribution": distribution}

    @staticmethod
    async def get_risk_distribution(
        session: AsyncSession,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """获取风险等级分布"""
        conditions = [BusinessEvent.event_name == 'review_complete']
        if start_date:
            conditions.append(BusinessEvent.created_at >= start_date)
        if end_date:
            conditions.append(BusinessEvent.created_at <= end_date)

        result = await session.execute(
            select(
                BusinessEvent.properties["risk_level"].astext.label("risk_level"),
                func.count(BusinessEvent.id).label("count"),
            )
            .where(and_(*conditions))
            .group_by(BusinessEvent.properties["risk_level"].astext)
            .order_by(func.count(BusinessEvent.id).desc())
        )

        distribution = []
        for row in result.all():
            risk_level = row[0] or 'unknown'
            name_map = {
                'high': '高风险',
                'medium': '中风险',
                'low': '低风险',
                'unknown': '未知',
            }
            distribution.append({
                "name": name_map.get(risk_level, risk_level),
                "value": row[1] or 0,
            })

        return {"distribution": distribution}

    @staticmethod
    async def get_api_performance(
        session: AsyncSession,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """获取 API 性能统计"""
        conditions = []
        if start_date:
            conditions.append(APILog.created_at >= start_date)
        if end_date:
            conditions.append(APILog.created_at <= end_date)

        where_clause = and_(*conditions) if conditions else True

        result = await session.execute(
            select(
                APILog.endpoint,
                func.count(APILog.id).label("call_count"),
                func.avg(APILog.duration_ms).label("avg_ms"),
                func.percentile_cont(0.5).within_group(APILog.duration_ms).label("p50_ms"),
                func.percentile_cont(0.95).within_group(APILog.duration_ms).label("p95_ms"),
            )
            .where(where_clause)
            .group_by(APILog.endpoint)
            .order_by(func.avg(APILog.duration_ms).desc())
        )

        performance = []
        for row in result.all():
            performance.append({
                "endpoint": row[0] or 'unknown',
                "call_count": row[1] or 0,
                "avg_ms": round(float(row[2] or 0), 2),
                "p50_ms": round(float(row[3] or 0), 2),
                "p95_ms": round(float(row[4] or 0), 2),
            })

        return {"performance": performance}
