# PatentGuard - 自动化专利/文档合规审查系统

## 项目简介

PatentGuard 是一个基于 **RAG（检索增强生成）** 的企业级文档合规审查系统，实现自动化分析、风险识别与可追溯解释。

### 核心功能

- **知识库管理**：支持法规/标准/专利模板的上传、自动解析、向量化存储
- **RAG 检索增强**：向量相似度检索，确保知识召回准确
- **LLM 合规分析**：基于检索到的知识进行智能审查，支持通用/专利/法律/合同四种类型
- **可解释输出**：每个审查结果附带引用来源，并经过真实性校验
- **用户 API 配置**：支持用户自定义 LLM API（OpenAI、通义千问等）

### 技术选型

| 组件 | 技术栈 | 说明 |
|------|--------|------|
| 数据库 | Supabase (PostgreSQL + pgvector) | 云托管，内置向量搜索 |
| 文件存储 | Supabase Storage | 云对象存储 |
| 认证 | JWT（本地）+ Supabase Auth | 双轨认证 |
| 后端框架 | FastAPI + SQLAlchemy 2.0 | 高性能异步 API |
| 前端 | React 18 + TypeScript + Ant Design | 现代前端框架 |
| 状态管理 | Zustand | 轻量状态管理 |
| 向量模型 | text-embedding-3-small | OpenAI Embedding |
| LLM | 用户自定义 | 支持 OpenAI、通义千问等 |

---

## 快速开始

### 前置要求

- Python 3.9+
- Node.js 18+
- Supabase 项目（或本地 PostgreSQL + pgvector）
- LLM API Key（OpenAI / 通义千问等）

### 1. 环境配置

```bash
# 复制环境变量文件
cp .env.example .env

# 编辑 .env，填入以下必需配置：
# - DATABASE_URL（Supabase PostgreSQL 连接字符串）
# - LLM_API_KEY（LLM API 密钥）
# - EMBEDDING_API_KEY（Embedding API 密钥，默认同 LLM_API_KEY）
```

**.env 关键配置项说明：**

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql+asyncpg://postgres:xxx@db.xxx.supabase.co:5432/postgres` |
| `LLM_API_KEY` | LLM API 密钥 | `sk-xxx` |
| `LLM_MODEL` | LLM 模型名称 | `gpt-4o-mini` |
| `LLM_BASE_URL` | LLM API 地址 | `https://api.openai.com/v1` |
| `EMBEDDING_API_KEY` | Embedding API 密钥 | 同 `LLM_API_KEY` |
| `EMBEDDING_MODEL` | Embedding 模型 | `text-embedding-3-small` |
| `RETRIEVAL_TOP_K` | 检索返回数量 | `5` |
| `CHUNK_SIZE` | 文档分块大小（字符） | `512` |

### 2. 数据库初始化

首次使用需执行数据库 schema：

```bash
# 方式一：直接执行 SQL（推荐用于 Supabase）
psql "postgresql://postgres:<PASSWORD>@db.<PROJECT-REF>.supabase.co:5432/postgres" \
  -f database/schema.sql

# 方式二：执行单个迁移
psql "<DATABASE_URL>" -f database/migrations/versions/001_add_review_type.sql
```

### 3. 启动后端

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. 启动前端

```bash
cd frontend
npm install
npm run dev
```

### 5. Docker Compose（可选）

```bash
docker-compose up -d
# 前端: http://localhost:3000
# 后端 API: http://localhost:8000
# API 文档: http://localhost:8000/docs
```

---

## 项目结构

```
PatentGuard/
├── backend/
│   ├── main.py              # FastAPI 入口，路由注册
│   ├── config_local.py      # 环境变量配置（Pydantic Settings）
│   ├── requirements.txt     # Python 依赖
│   ├── api/
│   │   ├── auth.py         # 用户注册/登录/JWT 认证
│   │   ├── kb.py           # 知识库管理（上传/分块/向量化/检索）
│   │   ├── analysis.py     # 文档审查（核心 RAG 链路）
│   │   ├── system.py       # 系统配置与统计
│   │   └── user_config.py  # 用户 API 个性化配置
│   ├── models/
│   │   ├── database.py     # SQLAlchemy 模型（Document, DocumentChunk, ReviewTask）
│   │   └── schemas.py       # Pydantic 请求/响应模型
│   └── services/
│       ├── parser.py        # 文档解析（PDF/Word/TXT）与分块
│       ├── embedding.py     # Embedding 向量化服务
│       ├── retriever.py     # pgvector 向量检索（余弦相似度）
│       ├── llm.py           # LLM 调用与合规审查 Prompt
│       ├── checker.py        # 审查编排 + 引用真实性校验
│       ├── auth.py          # JWT 工具与 Supabase Auth
│       └── storage.py       # Supabase Storage 文件存储
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.tsx       # 登录/注册
│   │   │   ├── Dashboard.tsx   # 工作台（管理员）
│   │   │   ├── KnowledgeBase.tsx # 知识库管理
│   │   │   ├── Analysis.tsx    # 文档审查（核心页面）
│   │   │   ├── History.tsx     # 审查历史
│   │   │   └── Settings.tsx    # 系统设置
│   │   ├── services/api.ts     # Axios API 客户端
│   │   └── types/index.ts      # TypeScript 类型定义
│   ├── package.json
│   └── vite.config.ts      # Vite 配置（含 API 代理）
├── database/
│   ├── schema.sql           # 完整数据库 Schema（含 pgvector 扩展）
│   └── migrations/
│       └── versions/
│           └── 001_add_review_type.sql  # 增量迁移
├── docker-compose.yml
├── .env.example             # 环境变量模板
├── .gitignore
└── README.md
```

---

## API 文档

启动后端后访问 **http://localhost:8000/docs**（Swagger UI）

### 审查类型

`review_type` 参数支持四种审查模式：

| 值 | 说明 | 适用场景 |
|----|------|----------|
| `general` | 通用审查 | 各类文档全面合规检查 |
| `patent` | 专利审查 | 专利申请书、权利要求书 |
| `law` | 法律审查 | 法律法规合规性 |
| `contract` | 合同审查 | 合同协议条款风险 |

---

## 常见问题

**Q: 检索/审查返回 500 错误？**
A: 检查 `.env` 中的 `EMBEDDING_API_KEY` 和 `LLM_API_KEY` 是否配置为真实密钥。

**Q: 审查结果引用显示 ⚠️ 标记？**
A: 表示 LLM 引用的法规关键词未在知识库中找到，可能是 LLM 捏造了引用，建议核实。

**Q: 数据库缺少 `review_type` 列？**
A: 执行 `database/migrations/versions/001_add_review_type.sql` 迁移脚本。

---

## 许可证

MIT License
