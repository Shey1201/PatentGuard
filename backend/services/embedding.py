import json
import httpx
from typing import List, Dict, Any, Optional
from backend.config import get_settings

settings = get_settings()


class EmbeddingService:
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None
    ):
        self.api_key = api_key or settings.embedding_api_key or settings.llm_api_key
        self.base_url = base_url or settings.embedding_base_url or settings.llm_base_url
        self.model = model or settings.embedding_model
        self.dimension = settings.embedding_dim

    async def get_embedding(self, text: str) -> List[float]:
        """Get embedding for a single text"""
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/embeddings",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "input": text,
                    "model": self.model
                }
            )
            if response.status_code != 200:
                raise Exception(f"Embedding API error: {response.text}")
            result = response.json()
            return result["data"][0]["embedding"]

    async def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Get embeddings for multiple texts"""
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/embeddings",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "input": texts,
                    "model": self.model
                }
            )
            if response.status_code != 200:
                raise Exception(f"Embedding API error: {response.text}")
            result = response.json()
            return [item["embedding"] for item in result["data"]]


def vector_to_string(vector: List[float]) -> str:
    """Convert vector to JSON string for storage"""
    return json.dumps(vector)


def string_to_vector(string: str) -> List[float]:
    """Convert stored string back to vector"""
    return json.loads(string)
