import json
import httpx
import time
from typing import Dict, Any, Optional
from backend.config_local import get_settings

settings = get_settings()


class LLMService:
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        provider: Optional[str] = None
    ):
        self.api_key = api_key or settings.llm_api_key
        self.base_url = base_url or settings.llm_base_url
        self.model = model or settings.llm_model
        self.provider = provider or settings.llm_provider

    async def chat(
        self,
        messages: list,
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> Dict[str, Any]:
        """Send chat completion request"""
        start_time = time.time()

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens
                }
            )

            latency = int((time.time() - start_time) * 1000)

            if response.status_code != 200:
                raise Exception(f"LLM API error: {response.text}")

            result = response.json()
            return {
                "content": result["choices"][0]["message"]["content"],
                "latency_ms": latency,
                "usage": result.get("usage", {})
            }

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None
    ) -> str:
        """Simple generate method"""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        result = await self.chat(messages)
        return result["content"]

    async def test_connection(self, test_prompt: str = "你好，请回复 '连接成功'") -> Dict[str, Any]:
        """Test LLM connection"""
        try:
            start_time = time.time()
            response = await self.generate(test_prompt)
            latency = int((time.time() - start_time) * 1000)
            return {
                "success": True,
                "response": response,
                "latency_ms": latency
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }


# 合规审查 Prompt 模板
COMPLIANCE_REVIEW_PROMPT = """你是专业的专利/文档合规审查专家。

请基于以下法规和知识库内容，对用户文档进行分析：

【知识库内容】
{context}

【用户文档】
{document}

请输出 JSON 格式结果：
{{
    "compliance": true/false,
    "risk_level": "low/medium/high",
    "summary": "总体评价",
    "findings": [
        {{
            "type": "risk/suggestion",
            "severity": "low/medium/high",
            "description": "问题描述",
            "reference": "法规依据",
            "suggestion": "修改建议"
        }}
    ]
}}

只输出 JSON，不要输出其他内容。"""


async def analyze_document(
    llm_service: LLMService,
    context: str,
    document: str,
    review_type: str = "general"
) -> Dict[str, Any]:
    """Analyze document for compliance"""
    prompt = COMPLIANCE_REVIEW_PROMPT.format(context=context, document=document)

    system_prompt = f"你是一个专业的{review_type}合规审查专家，请严格按照JSON格式输出审查结果。"

    result = await llm_service.generate(prompt, system_prompt)

    try:
        # 尝试解析 JSON
        return json.loads(result)
    except json.JSONDecodeError:
        # 如果不是有效 JSON，尝试提取 JSON
        import re
        json_match = re.search(r'\{[\s\S]*\}', result)
        if json_match:
            return json.loads(json_match.group())
        return {
            "compliance": False,
            "risk_level": "high",
            "summary": "解析结果失败",
            "findings": [{"type": "error", "description": result}]
        }
