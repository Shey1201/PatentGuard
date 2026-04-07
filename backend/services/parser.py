import json
import hashlib
from typing import List, Dict, Any, Optional
from pypdf import PdfReader
from docx import Document


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF"""
    try:
        from io import BytesIO
        reader = PdfReader(BytesIO(file_bytes))
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        raise ValueError(f"PDF 解析失败: {str(e)}")


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract text from DOCX"""
    try:
        from io import BytesIO
        doc = Document(BytesIO(file_bytes))
        text = ""
        for para in doc.paragraphs:
            text += para.text + "\n"
        return text
    except Exception as e:
        raise ValueError(f"DOCX 解析失败: {str(e)}")


def extract_text_from_txt(file_bytes: bytes) -> str:
    """Extract text from TXT"""
    try:
        return file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return file_bytes.decode("gbk", errors="ignore")


def extract_text(file_bytes: bytes, file_type: str) -> str:
    """Extract text based on file type"""
    file_type = file_type.lower()
    if file_type == "pdf":
        return extract_text_from_pdf(file_bytes)
    elif file_type in ["docx", "doc"]:
        return extract_text_from_docx(file_bytes)
    elif file_type == "txt":
        return extract_text_from_txt(file_bytes)
    else:
        raise ValueError(f"不支持的文件类型: {file_type}")


def chunk_text(text: str, chunk_size: int = 512, overlap: int = 50) -> List[Dict[str, Any]]:
    """Split text into chunks with overlap"""
    if not text:
        return []
    chunks = []
    start = 0
    text_length = len(text)
    while start < text_length:
        end = start + chunk_size
        chunk_text = text[start:end]
        chunks.append({
            "text": chunk_text,
            "start": start,
            "end": min(end, text_length),
            "index": len(chunks)
        })
        start = end - overlap
        if start >= text_length:
            break
    return chunks


def get_file_hash(file_bytes: bytes) -> str:
    """Calculate file hash"""
    return hashlib.md5(file_bytes).hexdigest()


def validate_file_size(file_size: int, max_size: int = 50 * 1024 * 1024) -> bool:
    """Validate file size"""
    return file_size <= max_size


def get_file_extension(filename: str) -> str:
    """Get file extension"""
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
