# PatentGuard API 设计文档

## 基础信息

- **基础路径**: `/api/v1`
- **认证方式**: Bearer Token (JWT)
- **响应格式**: JSON

## 认证接口

### 1. 用户登录

```
POST /api/v1/auth/login
```

**请求体**:
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**响应**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 86400,
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "username": "admin",
    "role": "admin"
  }
}
```

### 2. 用户注册

```
POST /api/v1/auth/register
```

**请求体**:
```json
{
  "email": "user@example.com",
  "username": "newuser",
  "password": "password123"
}
```

### 3. 刷新 Token

```
POST /api/v1/auth/refresh
```

---

## 系统配置接口 (重要)

### 1. 获取系统配置

```
GET /api/v1/system/config
```

**响应**:
```json
{
  "llm_provider": "openai",
  "llm_model": "gpt-4o-mini",
  "llm_base_url": "https://api.openai.com/v1",
  "embedding_model": "text-embedding-3-small",
  "embedding_dim": 1536,
  "chunk_size": 512,
  "chunk_overlap": 50,
  "retrieval_top_k": 5
}
```

### 2. 更新 LLM 配置 (用户自定义 API)

```
PUT /api/v1/system/config/llm
```

**请求体**:
```json
{
  "llm_provider": "qianwen",  // openai, qianwen, claude
  "llm_model": "qwen-turbo",
  "llm_api_key": "sk-xxxxx",
  "llm_base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1"
}
```

**说明**: 用户可以在这里配置自己的 LLM API，支持：
- OpenAI (GPT-4, GPT-3.5)
- 阿里云通义千问 (qwen-turbo, qwen-max)
- Anthropic Claude
- 其他 OpenAI 兼容接口

### 3. 更新 Embedding 配置

```
PUT /api/v1/system/config/embedding
```

**请求体**:
```json
{
  "embedding_model": "text-embedding-3-small",
  "chunk_size": 512,
  "chunk_overlap": 50,
  "retrieval_top_k": 5
}
```

### 4. 测试 LLM 连接

```
POST /api/v1/system/config/test-llm
```

**请求体**:
```json
{
  "prompt": "你好，请回复 '连接成功'"
}
```

**响应**:
```json
{
  "success": true,
  "response": "连接成功",
  "latency_ms": 1500
}
```

---

## 知识库管理接口

### 1. 获取文档分类

```
GET /api/v1/kb/categories
```

**响应**:
```json
[
  {
    "id": "uuid",
    "name": "法律法规",
    "type": "law",
    "description": "法律法规类文档",
    "document_count": 10
  }
]
```

### 2. 创建分类

```
POST /api/v1/kb/categories
```

**请求体**:
```json
{
  "name": "新增分类",
  "type": "policy",
  "description": "分类描述"
}
```

### 3. 上传文档

```
POST /api/v1/kb/documents/upload
```

**Content-Type**: `multipart/form-data`

**表单字段**:
- `file`: 文件 (PDF, DOCX, TXT)
- `category_id`: 分类 ID
- `document_type`: 文档类型 (law/patent/policy/contract)
- `tags`: 标签 (可选，逗号分隔)

**响应**:
```json
{
  "id": "uuid",
  "title": "测试文档.pdf",
  "status": "pending",
  "message": "文档上传成功，正在处理..."
}
```

### 4. 获取文档列表

```
GET /api/v1/kb/documents?page=1&page_size=20&category_id=xxx
```

**响应**:
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "专利法.pdf",
      "category_name": "法律法规",
      "document_type": "law",
      "status": "completed",
      "chunk_count": 25,
      "file_size": 1024000,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "page_size": 20
}
```

### 5. 获取文档详情

```
GET /api/v1/kb/documents/{id}
```

### 6. 删除文档

```
DELETE /api/v1/kb/documents/{id}
```

### 7. 搜索知识库

```
GET /api/v1/kb/search?q=专利法&top_k=5
```

**响应**:
```json
{
  "results": [
    {
      "document_id": "uuid",
      "document_title": "专利法",
      "chunk_text": "第一条 为了保护专利权人的合法权益...",
      "score": 0.92,
      "metadata": {}
    }
  ]
}
```

---

## 文档审查接口

### 1. 创建审查任务

```
POST /api/v1/analysis/review
```

**请求体**:
```json
{
  "document_id": "uuid",  // 可选，使用已上传的文档
  // 或
  "file": "文件",         // 直接上传文件审查
  "review_type": "patent", // patent/law/policy/contract
  "options": {
    "retrieval_top_k": 5,
    "include_raw_content": true
  }
}
```

**响应**:
```json
{
  "task_id": "uuid",
  "status": "processing"
}
```

### 2. 获取审查进度

```
GET /api/v1/analysis/tasks/{task_id}
```

**响应**:
```json
{
  "task_id": "uuid",
  "status": "completed",
  "progress": 100,
  "result": {
    "compliance": true,
    "risk_level": "low",
    "summary": "该文档符合相关规定",
    "details": [...]
  }
}
```

### 3. 获取审查结果

```
GET /api/v1/analysis/results/{task_id}
```

**响应**:
```json
{
  "task_id": "uuid",
  "document_title": "专利申请.pdf",
  "compliance": true,
  "risk_level": "low",
  "summary": "文档基本符合要求，存在以下改进建议：",
  "findings": [
    {
      "type": "risk",
      "severity": "low",
      "description": "缺少必要的技术交底书",
      "reference": "专利法实施细则第XX条",
      "suggestion": "建议补充技术交底书"
    }
  ],
  "referenced_documents": [
    {
      "title": "专利法",
      "relevance": 0.95,
      "matched_chunks": ["第一条 ...", "第二条 ..."]
    }
  ],
  "created_at": "2024-01-01T00:00:00Z"
}
```

### 4. 审查历史

```
GET /api/v1/analysis/history?page=1&page_size=20
```

---

## 通用响应格式

### 成功响应
```json
{
  "success": true,
  "data": {...},
  "message": "操作成功"
}
```

### 错误响应
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数验证失败",
    "details": [...]
  }
}
```

### 分页响应
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

---

## 错误码

| 错误码 | 说明 |
|--------|------|
| 10001 | 认证失败 |
| 10002 | Token 过期 |
| 10003 | 无权限 |
| 20001 | 参数验证错误 |
| 20002 | 资源不存在 |
| 30001 | LLM API 错误 |
| 30002 | Embedding 服务错误 |
| 40001 | 文件处理错误 |
| 40002 | 向量检索错误 |