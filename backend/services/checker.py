"""
合规审查服务 - Compliance Checker Service

提供文档合规审查的核心功能，包括：
- 文档内容分析
- 合规性检查
- 风险评估
- 审查报告生成
"""

import json
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from backend.services.llm import LLMService
from backend.services.retriever import RetrievalService


class RiskLevel(Enum):
    """风险等级"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class FindingType(Enum):
    """发现问题类型"""
    RISK = "risk"
    SUGGESTION = "suggestion"
    INFO = "info"


@dataclass
class Finding:
    """审查发现项"""
    type: str
    severity: str
    description: str
    reference: str = ""
    suggestion: str = ""


@dataclass
class ReviewResult:
    """审查结果"""
    compliance: bool
    risk_level: str
    summary: str
    findings: List[Finding] = field(default_factory=list)
    referenced_documents: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "compliance": self.compliance,
            "risk_level": self.risk_level,
            "summary": self.summary,
            "findings": [
                {
                    "type": f.type,
                    "severity": f.severity,
                    "description": f.description,
                    "reference": f.reference,
                    "suggestion": f.suggestion
                }
                for f in self.findings
            ],
            "referenced_documents": self.referenced_documents,
            "metadata": self.metadata
        }


class ComplianceChecker:
    """
    合规审查器

    整合检索服务和 LLM 服务，提供完整的文档合规审查功能。
    """

    def __init__(
        self,
        llm_service: LLMService,
        retrieval_service: RetrievalService,
        review_type: str = "general"
    ):
        self.llm_service = llm_service
        self.retrieval_service = retrieval_service
        self.review_type = review_type

    async def review(
        self,
        document_content: str,
        top_k: int = 5,
        category_id: Optional[str] = None
    ) -> ReviewResult:
        """
        执行文档合规审查

        Args:
            document_content: 待审查的文档内容
            top_k: 检索返回的相关文档数量
            category_id: 可选的分类筛选

        Returns:
            ReviewResult: 审查结果对象
        """
        if not document_content or not document_content.strip():
            return ReviewResult(
                compliance=False,
                risk_level=RiskLevel.HIGH.value,
                summary="文档内容为空，无法进行审查",
                findings=[
                    Finding(
                        type=FindingType.RISK.value,
                        severity=RiskLevel.HIGH.value,
                        description="文档内容为空或无法解析",
                        suggestion="请检查文档格式是否正确，或尝试重新上传"
                    )
                ]
            )

        # 1. 从知识库检索相关内容
        retrieval_results = await self._retrieve_knowledge(
            document_content, top_k, category_id
        )

        if not retrieval_results:
            return ReviewResult(
                compliance=False,
                risk_level=RiskLevel.HIGH.value,
                summary="知识库为空，请先添加知识库文档",
                findings=[
                    Finding(
                        type=FindingType.RISK.value,
                        severity=RiskLevel.HIGH.value,
                        description="知识库中没有相关文档",
                        suggestion="请先上传法规、标准等知识库文档"
                    )
                ]
            )

        # 2. 构建上下文
        context = self._build_context(retrieval_results)

        # 3. LLM 分析
        analysis_result = await self._analyze_with_llm(context, document_content)

        # 4. 构建引用的文档
        referenced_docs = self._build_references(retrieval_results)

        # 5. 校验引用真实性（防止 LLM 捏造法规依据）
        raw_findings = analysis_result.get("findings", [])
        verified_findings = self._verify_references(raw_findings, retrieval_results)

        # 6. 组装结果
        findings = [
            Finding(
                type=f.get("type", FindingType.SUGGESTION.value),
                severity=f.get("severity", RiskLevel.LOW.value),
                description=f.get("description", ""),
                reference=f.get("reference", ""),
                suggestion=f.get("suggestion", "")
            )
            for f in verified_findings
        ]

        return ReviewResult(
            compliance=analysis_result.get("compliance", False),
            risk_level=analysis_result.get("risk_level", RiskLevel.MEDIUM.value),
            summary=analysis_result.get("summary", ""),
            findings=findings,
            referenced_documents=referenced_docs,
            metadata={
                "review_type": self.review_type,
                "retrieval_count": len(retrieval_results),
                "timestamp": datetime.utcnow().isoformat()
            }
        )

    async def _retrieve_knowledge(
        self,
        document_content: str,
        top_k: int,
        category_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        从知识库检索相关内容

        Args:
            document_content: 文档内容（取前 4000 字符 ≈ 1000 tokens 作为查询）
            top_k: 返回结果数量
            category_id: 可选的分类筛选

        Returns:
            List[Dict]: 检索结果列表
        """
        # 按 token 估算：中文约 1.5 字符/token，英文约 4 字符/token
        # 取前 4000 字符（混合文本约 1000 tokens），避免 embedding 模型 context 溢出
        MAX_QUERY_CHARS = 4000
        query = document_content[:MAX_QUERY_CHARS] if len(document_content) > MAX_QUERY_CHARS else document_content
        return await self.retrieval_service.retrieve(
            query=query,
            top_k=top_k,
            category_id=category_id,
            score_threshold=0.5
        )

    def _build_context(self, retrieval_results: List[Dict[str, Any]]) -> str:
        """
        从检索结果构建上下文

        Args:
            retrieval_results: 检索结果列表

        Returns:
            str: 格式化的上下文字符串
        """
        return self.retrieval_service.get_context_from_results_sync(retrieval_results)

    def _build_references(self, retrieval_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        构建引用文档列表

        Args:
            retrieval_results: 检索结果列表

        Returns:
            List[Dict]: 引用文档列表
        """
        references = []
        for r in retrieval_results:
            references.append({
                "title": r.get("document_title", "未知文档"),
                "relevance": r.get("score", 0.0),
                "matched_chunks": [r.get("chunk_text", "")[:200]]
            })
        return references

    def _verify_references(
        self,
        findings: List[Dict[str, Any]],
        retrieval_results: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        校验 finding 中的引用是否真实存在于知识库检索结果中。

        如果 LLM 捏造了法规引用（如"专利法第XX条"在知识库中不存在），
        则将 reference 标记为不可信（附加 warning 标记）。

        Args:
            findings: LLM 返回的 findings 列表
            retrieval_results: 知识库检索结果

        Returns:
            List[Dict]: 校验后的 findings（可能附加 verification 字段）
        """
        # 建立知识库文本集合（用于模糊匹配）
        kb_texts = []
        for r in retrieval_results:
            chunk = r.get("chunk_text", "")
            title = r.get("document_title", "")
            kb_texts.append(f"{title} {chunk}")

        verified_findings = []
        for f in findings:
            ref = f.get("reference", "")
            verified = {**f}

            if ref:
                # 简单关键词匹配：引用中至少有一个关键词出现在知识库中
                # 提取法规关键词（去掉标点，转小写）
                ref_keywords = [
                    kw.strip().lower()
                    for kw in ref.replace("。", " ").replace("，", " ").replace("、", " ").split()
                    if len(kw.strip()) >= 2
                ]

                # 检查关键词是否在知识库文本中
                matched_keywords = []
                for kw in ref_keywords:
                    for kb_text in kb_texts:
                        if kw in kb_text.lower():
                            matched_keywords.append(kw)
                            break

                if not matched_keywords:
                    # 没有匹配关键词：可能是捏造的引用
                    verified["reference"] = f"{ref} ⚠️（引用未经知识库验证）"
                    verified["verification_status"] = "unverified"
                else:
                    verified["verification_status"] = "verified"
                    verified["matched_keywords"] = list(set(matched_keywords))

            verified_findings.append(verified)

        return verified_findings

    async def _analyze_with_llm(
        self,
        context: str,
        document_content: str
    ) -> Dict[str, Any]:
        """
        使用 LLM 进行文档分析

        Args:
            context: 知识库上下文
            document_content: 待审查文档内容

        Returns:
            Dict: LLM 分析结果
        """
        from backend.services.llm import analyze_document

        return await analyze_document(
            llm_service=self.llm_service,
            context=context,
            document=document_content,
            review_type=self.review_type
        )

    async def quick_check(
        self,
        document_content: str,
        check_items: List[str]
    ) -> Dict[str, Any]:
        """
        快速检查特定项目

        Args:
            document_content: 文档内容
            check_items: 检查项目列表

        Returns:
            Dict: 检查结果
        """
        prompt = f"""请对以下文档进行快速合规检查：

检查项目：
{chr(10).join(f"- {item}" for item in check_items)}

文档内容：
{document_content[:3000]}

请输出检查结果（JSON格式）：
{{
    "passed": true/false,
    "checked_items": [
        {{
            "item": "检查项名称",
            "passed": true/false,
            "remark": "备注说明"
        }}
    ],
    "summary": "总体评价"
}}
"""

        try:
            result = await self.llm_service.generate(prompt)
            return json.loads(result)
        except json.JSONDecodeError:
            return {
                "passed": False,
                "checked_items": [],
                "summary": "检查失败，无法解析结果",
                "raw_response": result
            }


class BatchChecker:
    """
    批量审查器

    支持对多个文档进行批量合规审查。
    """

    def __init__(
        self,
        llm_service: LLMService,
        retrieval_service: RetrievalService,
        review_type: str = "general"
    ):
        self.checker = ComplianceChecker(llm_service, retrieval_service, review_type)

    async def review_batch(
        self,
        documents: List[Dict[str, str]],
        top_k: int = 5
    ) -> List[ReviewResult]:
        """
        批量审查多个文档

        Args:
            documents: 文档列表，每个文档包含 title 和 content
            top_k: 每个文档检索的相关文档数量

        Returns:
            List[ReviewResult]: 审查结果列表
        """
        results = []
        for doc in documents:
            result = await self.checker.review(
                document_content=doc.get("content", ""),
                top_k=top_k
            )
            result.metadata["document_title"] = doc.get("title", "未命名文档")
            results.append(result)
        return results

    async def review_batch_summary(
        self,
        results: List[ReviewResult]
    ) -> Dict[str, Any]:
        """
        生成批量审查的汇总报告

        Args:
            results: 审查结果列表

        Returns:
            Dict: 汇总报告
        """
        total = len(results)
        compliant = sum(1 for r in results if r.compliance)
        non_compliant = total - compliant

        risk_distribution = {
            RiskLevel.LOW.value: 0,
            RiskLevel.MEDIUM.value: 0,
            RiskLevel.HIGH.value: 0
        }

        for r in results:
            risk_distribution[r.risk_level] = risk_distribution.get(r.risk_level, 0) + 1

        return {
            "total_documents": total,
            "compliant": compliant,
            "non_compliant": non_compliant,
            "compliance_rate": compliant / total if total > 0 else 0,
            "risk_distribution": risk_distribution,
            "summary": f"共审查 {total} 份文档，合规 {compliant} 份，不合规 {non_compliant} 份"
        }
