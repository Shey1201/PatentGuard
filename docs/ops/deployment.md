# 部署说明

本文说明 PatentGuard 的本地开发和基础部署方式。

## 环境准备

- Python 3.9+
- Node.js 18+
- PostgreSQL + pgvector，或 Supabase PostgreSQL
- Supabase Storage，或兼容的文件存储方案
- 可访问的 LLM 与 Embedding 服务

## 环境变量

复制模板：

```bash
cp .env.example .env
```

LLM 不绑定固定厂商，请填写自定义模型服务配置：

```env
LLM_PROVIDER=custom
LLM_API_KEY=your-api-key-here
LLM_BASE_URL=https://your-llm-endpoint.example/v1
LLM_MODEL=your-chat-model
```

后端调用方式：

```text
POST {LLM_BASE_URL}/chat/completions
```

Embedding 也按实际服务填写：

```env
EMBEDDING_MODEL=your-embedding-model
EMBEDDING_DIM=1536
EMBEDDING_API_KEY=your-api-key-here
EMBEDDING_BASE_URL=https://your-embedding-endpoint.example/v1
```

## 数据库初始化

```bash
psql "<DATABASE_URL>" -f database/schema.sql
psql "<DATABASE_URL>" -f database/migrations/versions/001_add_review_type.sql
```

## 本地启动

后端：

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

生产环境建议去掉 `--reload`，使用 Dockerfile 中的默认启动命令或进程管理器托管服务。

前端：

```bash
cd frontend
npm install
npm run dev
```

## Docker Compose

```bash
docker-compose up -d
```

当前 `docker-compose.yml` 更偏本地开发模式：

- 后端使用项目根目录的 `Dockerfile`。
- 前端使用 `node:20-alpine` 安装依赖并运行 Vite dev server。

生产部署建议：

- 使用 `Dockerfile.frontend` 构建前端静态资源。
- 使用 Nginx 或静态资源服务托管前端产物。
- 后端通过环境变量注入数据库、存储、LLM 和 Embedding 配置。
- 数据库迁移在发布流程中显式执行。
