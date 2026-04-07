from supabase import create_client, Client
from typing import Optional
from pathlib import Path
import uuid
import aiohttp
from backend.config_local import get_settings

settings = get_settings()

# Supabase Storage 客户端单例
_storage_client: Optional[Client] = None


def get_storage_client() -> Client:
    """获取 Supabase Storage 客户端"""
    global _storage_client
    if _storage_client is None:
        if not settings.supabase_url or not settings.supabase_service_key:
            raise ValueError("Supabase configuration not set")
        _storage_client = create_client(
            settings.supabase_url,
            settings.supabase_service_key
        )
    return _storage_client


class StorageService:
    """Supabase Storage 文件存储服务"""

    def __init__(self, bucket: str = "documents"):
        self.bucket = bucket
        self.client = get_storage_client()

    async def upload_file(
        self,
        file_data: bytes,
        file_name: str,
        folder: str = "uploads",
        content_type: str = "application/octet-stream"
    ) -> dict:
        """
        上传文件到 Supabase Storage

        Args:
            file_data: 文件字节数据
            file_name: 原始文件名
            folder: 存储文件夹
            content_type: 文件 MIME 类型

        Returns:
            dict: 包含 file_path 和 public_url
        """
        # 生成唯一文件名
        ext = Path(file_name).suffix
        unique_name = f"{uuid.uuid4()}{ext}"
        file_path = f"{folder}/{unique_name}"

        # 上传到 Supabase Storage
        response = self.client.storage.from_(self.bucket).upload(
            path=file_path,
            file=file_data,
            file_options={
                "content-type": content_type,
                "upsert": "false"
            }
        )

        # 获取公开访问 URL
        public_url = self.client.storage.from_(self.bucket).get_public_url(file_path)

        return {
            "file_path": file_path,
            "public_url": public_url,
            "file_name": file_name
        }

    async def delete_file(self, file_path: str) -> bool:
        """删除文件"""
        try:
            self.client.storage.from_(self.bucket).remove([file_path])
            return True
        except Exception:
            return False

    async def get_file_url(self, file_path: str, expires_in: int = 3600) -> str:
        """获取文件签名 URL（有时效性）"""
        return self.client.storage.from_(self.bucket).create_signed_url(
            file_path,
            expires_in
        )

    async def download_file(self, file_path: str) -> bytes:
        """下载文件"""
        response = self.client.storage.from_(self.bucket).download(file_path)
        return response


# 便捷函数
storage_service = StorageService()


async def upload_document(file_data: bytes, file_name: str, content_type: str = "application/octet-stream") -> dict:
    """上传文档的便捷函数"""
    return await storage_service.upload_file(
        file_data=file_data,
        file_name=file_name,
        folder="documents",
        content_type=content_type
    )


async def upload_chunk(file_data: bytes, file_name: str) -> dict:
    """上传文本块的便捷函数"""
    return await storage_service.upload_file(
        file_data=file_data,
        file_name=file_name,
        folder="chunks",
        content_type="text/plain"
    )