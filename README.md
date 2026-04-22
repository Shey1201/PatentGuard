# PatentGuard

> 基于 RAG 的专利与文档合规审查系统。

![PatentGuard 项目示意图](assets/project-overview.png)

PatentGuard 面向专利、合同、法规与通用文档审查场景，基于 FastAPI、React、PostgreSQL/pgvector 与可配置 LLM，实现知识库管理、检索增强审查、引用溯源、用户级模型配置和行为埋点统计。

## 项目简介

企业文档合规审查通常会遇到三类问题：知识库分散、人工审查不可追踪、LLM 输出缺少依据。PatentGuard 将文档解析、向量检索、审查编排、引用校验和审查历史串成一条可运行链路，让审查结果既能自动生成，也能回到知识来源与操作记录。

## 核心功能

- 知识库管理：支持法规、标准、专利模板、合同范本等资料上传、解析、分块与向量化。
- RAG 检索增强：基于 pgvector 的相似度召回，为审查提示词提供可追溯上下文。
- 多类型审查：支持通用、专利、法律、合同等审查模式。
- 可解释输出：审查结论关联引用来源，并对引用真实性做基础校验。
- 用户自定义 LLM 配置：支持每个用户配置独立的 LLM 与 Embedding API。
- 埋点与统计：后端记录 API 调用日志，前端提供行为上报工具和统计看板。
- 前后端分离：FastAPI 后端、React + TypeScript 前端、Zustand 状态管理。

## 目录结构

```text
PatentGuard/
├── backend/              # FastAPI 后端
├── frontend/             # React 前端
├── database/             # 数据库脚本
├── docs/                 # 项目文档
├── scripts/              # 辅助脚本
├── assets/               # 展示素材
├── docker-compose.yml
├── Dockerfile
├── Dockerfile.frontend
└── README.md
```

## 快速开始

### 环境要求

- Python 3.9+
- Node.js 18+
- PostgreSQL + pgvector，或 Supabase 项目
- LLM API Key，以及兼容 Chat Completions 格式的自定义接口地址

### 1. 配置环境变量

```bash
cp .env.example .env
```

按 [.env.example](.env.example) 中的注释填写本地配置。

本地演示可将 `ENABLE_DEMO_MODE` 与 `VITE_ENABLE_DEMO_MODE` 设为 `true`，生产环境建议保持关闭。

### 2. 初始化数据库

```bash
psql "<DATABASE_URL>" -f database/schema.sql
psql "<DATABASE_URL>" -f database/migrations/versions/001_add_review_type.sql
```

### 3. 启动后端

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

后端启动后可访问：

- API root: `http://localhost:8000`
- Health check: `http://localhost:8000/health`
- Swagger UI: `http://localhost:8000/docs`

### 4. 启动前端

```bash
cd frontend
npm install
npm run dev
```

默认前端开发地址为 `http://localhost:3000`。

### 5. Docker Compose 启动

```bash
docker-compose up -d
```

## 项目文档

- 产品需求：[docs/product/prd.md](docs/product/prd.md)
- 架构设计：[docs/engineering/architecture.md](docs/engineering/architecture.md)
- API 设计：[docs/engineering/api-design.md](docs/engineering/api-design.md)
- 埋点实现：[docs/engineering/tracking-implementation.md](docs/engineering/tracking-implementation.md)
- 埋点分析：[docs/engineering/tracking-analytics.md](docs/engineering/tracking-analytics.md)
- 部署说明：[docs/ops/deployment.md](docs/ops/deployment.md)
- 常见问题：[docs/ops/faq.md](docs/ops/faq.md)
- 面试材料：[docs/presentation/interview-notes.md](docs/presentation/interview-notes.md)

## 许可证

MIT License.
