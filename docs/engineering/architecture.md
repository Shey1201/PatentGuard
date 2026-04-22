# 架构设计

本文描述 PatentGuard 当前代码已经落地的系统结构，避免把规划能力写成已完成能力。

## 总体结构

PatentGuard 采用前后端分离架构：

```text
React 前端
  -> FastAPI 后端
    -> PostgreSQL / Supabase PostgreSQL
    -> pgvector 向量检索
    -> Supabase Storage
    -> 用户配置的 LLM / Embedding 服务
```

核心链路：

```text
文档上传
-> 文本解析与分块
-> Embedding 向量化
-> 知识库检索
-> LLM 合规审查
-> 审查结果与引用来源返回
```

## 后端结构

后端位于 `backend/`，使用 FastAPI + SQLAlchemy 异步访问数据库。

```text
backend/
├── api/          # 路由层
├── models/       # ORM 模型与 Pydantic schema
├── services/     # 业务服务
├── tests/        # 后端测试与接口冒烟测试
├── config.py     # 统一配置入口
└── main.py       # 应用入口、路由注册、中间件
```

主要模块：

| 模块 | 说明 |
| --- | --- |
| `api/auth.py` | 注册、登录、Token、当前用户 |
| `api/kb.py` | 知识库分类、文档上传、文档处理、检索 |
| `api/analysis.py` | 审查任务、文件审查、审查历史 |
| `api/system.py` | 系统配置、统计信息 |
| `api/user_config.py` | 用户级 LLM/Embedding 配置 |
| `api/tracking.py` | 埋点事件、API 日志、统计查询 |
| `services/parser.py` | 文档解析与分块 |
| `services/embedding.py` | Embedding 调用 |
| `services/retriever.py` | 向量检索 |
| `services/llm.py` | LLM 调用 |
| `services/checker.py` | 审查编排 |
| `services/storage.py` | Supabase Storage 文件存储 |
| `services/tracking.py` | 埋点与 API 日志统计 |

## 前端结构

前端位于 `frontend/`，使用 React + TypeScript + Ant Design + Zustand。

```text
frontend/src/
├── components/   # 通用组件和统计图表
├── constants/    # 常量
├── hooks/        # 复用 hooks
├── pages/        # 页面
├── services/     # API client
├── stores/       # Zustand 状态
├── types/        # 类型定义
└── utils/        # 工具函数，例如 tracker
```

主要页面：

| 页面 | 说明 |
| --- | --- |
| `Login.tsx` | 登录 |
| `Dashboard.tsx` | 工作台与统计 |
| `KnowledgeBase.tsx` | 知识库管理 |
| `Analysis.tsx` | 文档审查 |
| `History.tsx` | 审查历史 |
| `Settings.tsx` | 模型与系统配置 |

## 数据模型

主要 ORM 模型位于 `backend/models/database.py`。

| 表 | 说明 |
| --- | --- |
| `users` | 用户 |
| `system_config` | 系统配置 |
| `categories` | 知识库分类 |
| `documents` | 文档 |
| `document_chunks` | 文档分块与向量文本 |
| `review_tasks` | 审查任务 |
| `audit_logs` | 审计日志 |
| `api_logs` | API 调用日志 |
| `business_events` | 前端业务埋点事件 |
| `user_api_configs` | 用户级模型配置 |

## 运行与部署边界

当前 `docker-compose.yml` 更偏本地开发模式：

- 后端使用项目根目录的 `Dockerfile`。
- 前端使用 `node:20-alpine`，运行 `npm ci && npm run dev -- --host`。

生产部署时建议：

- 前端使用 `Dockerfile.frontend` 构建静态资源并由 Nginx 托管。
- 后端使用环境变量注入真实数据库、存储和模型服务配置。
- 数据库迁移脚本在发布流程中显式执行。

## 已知边界

- 后端模型、schema 和数据库连接当前集中在 `backend/models/`，后续规模扩大后可拆为 `db/`、`schemas/`、`repositories/`。
- 前端尚未引入正式测试脚本。
- Docker Compose 当前主要服务本地开发，不等同于生产编排。
