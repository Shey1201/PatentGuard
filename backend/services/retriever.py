import json
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from backend.models.database import DocumentChunk, Document
from backend.services.embedding import EmbeddingService, string_to_vector


class RetrievalService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.embedding_service = EmbeddingService()

    async def retrieve(
        self,
        query: str,
        top_k: int = 5,
        category_id: Optional[str] = None,
        score_threshold: float = 0.5
    ) -> List[Dict[str, Any]]:
        """Retrieve relevant chunks from knowledge base (Supabase pgvector)"""

        # 1. 生成查询向量
        query_embedding = await self.embedding_service.get_embedding(query)

        # 2. 向量检索 (使用余弦相似度 - Supabase pgvector)
        # 直接传递列表，SQLAlchemy 会自动处理
        sql = text("""
            SELECT
                dc.id,
                dc.document_id,
                dc.chunk_index,
                dc.chunk_text,
                dc.start_position,
                dc.end_position,
                dc.meta,
                d.title as document_title,
                1 - (dc.embedding <=> :embedding::vector) as similarity
            FROM document_chunks dc
            JOIN documents d ON dc.document_id = d.id
            WHERE d.status = 'completed'
            AND d.category_id = COALESCE(:category_id::uuid, d.category_id)
            ORDER BY dc.embedding <=> :embedding::vector
            LIMIT :top_k
        """)

        # 将 embedding 列表转为 PostgreSQL 数组格式
        embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"

        result = await self.db.execute(sql, {
            "embedding": embedding_str,
            "category_id": category_id,
            "top_k": top_k
        })

        rows = result.fetchall()

        # 3. 过滤低分结果
        results = []
        for row in rows:
            similarity = float(row.similarity)
            if similarity >= score_threshold:
                results.append({
                    "id": str(row.id),
                    "document_id": str(row.document_id),
                    "document_title": row.document_title,
                    "chunk_text": row.chunk_text,
                    "chunk_index": row.chunk_index,
                    "score": similarity,
                    "metadata": row.meta or {}
                })

        return results

    async def get_context_from_results(self, results: List[Dict[str, Any]]) -> str:
        """Build context string from retrieval results"""
        return self.get_context_from_results_sync(results)

    def get_context_from_results_sync(self, results: List[Dict[str, Any]]) -> str:
        """Build context string from retrieval results (sync version)"""
        context_parts = []
        for i, result in enumerate(results, 1):
            context_parts.append(
                f"【文档{i}】{result['document_title']}\n"
                f"相关段落：{result['chunk_text']}\n"
                f"相似度：{result['score']:.2f}"
            )
        return "\n\n".join(context_parts)


class RetrievalWithConfig(RetrievalService):
    """Retrieval service with custom config"""

    def __init__(
        self,
        db: AsyncSession,
        embedding_api_key: str,
        embedding_base_url: str,
        embedding_model: str,
        top_k: int = 5
    ):
        self.db = db
        self.embedding_service = EmbeddingService(
            api_key=embedding_api_key,
            base_url=embedding_base_url,
            model=embedding_model
        )
        self.top_k = top_k
