# API 设计

本文记录当前后端 API 的主要模块与设计约定。完整接口以运行后的 Swagger UI 为准：`http://localhost:8000/docs`。

## 基础约定

- 基础路径：`/api/v1`
- 认证方式：Bearer Token
- 响应格式：JSON
- 后端框架：FastAPI

## 路由模块

| 模块 | 路径前缀 | 文件 | 说明 |
| --- | --- | --- | --- |
| Auth | `/api/v1/auth` | `backend/api/auth.py` | 注册、登录、刷新 Token、当前用户 |
| Knowledge Base | `/api/v1/kb` | `backend/api/kb.py` | 分类、文档上传、文档处理、检索 |
| Analysis | `/api/v1/analysis` | `backend/api/analysis.py` | 文档审查、文件审查、任务和历史 |
| System | `/api/v1/system` | `backend/api/system.py` | 系统配置、统计和模型连接测试 |
| User Config | `/api/v1/user/config` | `backend/api/user_config.py` | 用户级 LLM/Embedding 配置 |
| Tracking | `/api/v1/track` | `backend/api/tracking.py` | 埋点事件、API 日志、统计查询 |

## 认证模块

常用接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/auth/register` | 注册 |
| `POST` | `/auth/login` | 登录 |
| `POST` | `/auth/refresh` | 刷新 Token |
| `GET` | `/auth/me` | 当前用户 |

## 知识库模块

常用接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/kb/categories` | 分类列表 |
| `POST` | `/kb/categories` | 创建分类 |
| `DELETE` | `/kb/categories/{id}` | 删除分类 |
| `GET` | `/kb/documents` | 文档列表 |
| `GET` | `/kb/documents/{id}` | 文档详情 |
| `POST` | `/kb/documents/upload` | 上传文档 |
| `POST` | `/kb/documents/{id}/process` | 处理文档 |
| `DELETE` | `/kb/documents/{id}` | 删除文档 |
| `GET` | `/kb/search` | 知识库检索 |

## 审查模块

常用接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/analysis/review` | 创建审查任务 |
| `POST` | `/analysis/review/with-file` | 上传文件并审查 |
| `POST` | `/analysis/review/{id}/execute` | 执行审查任务 |
| `GET` | `/analysis/tasks/{id}` | 获取任务状态 |
| `GET` | `/analysis/results/{id}` | 获取审查结果 |
| `GET` | `/analysis/history` | 当前用户审查历史 |
| `GET` | `/analysis/history/all` | 全部审查历史 |

## 系统与用户配置

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/system/config` | 系统配置 |
| `PUT` | `/system/config/llm` | 更新系统 LLM 配置 |
| `PUT` | `/system/config/embedding` | 更新系统 Embedding 配置 |
| `POST` | `/system/config/test-llm` | 测试系统 LLM 连接 |
| `GET` | `/system/stats` | 系统统计 |
| `GET` | `/system/user-stats` | 当前用户统计 |
| `GET` | `/system/recent-activity` | 最近活动 |
| `GET` | `/user/config/api` | 获取用户 API 配置 |
| `POST` | `/user/config/api` | 创建用户 API 配置 |
| `PUT` | `/user/config/api` | 更新用户 API 配置 |
| `DELETE` | `/user/config/api` | 删除用户 API 配置 |
| `POST` | `/user/config/api/test-llm` | 测试用户 LLM 配置 |

## 埋点模块

详见 [tracking-implementation.md](tracking-implementation.md)。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/track/events` | 写入单条埋点事件 |
| `POST` | `/track/events/batch` | 批量写入埋点事件 |
| `GET` | `/track/events` | 查询埋点事件 |
| `GET` | `/track/stats` | 埋点统计 |
| `GET` | `/track/api-logs` | API 日志 |
| `GET` | `/track/dashboard-stats` | 管理员看板概要 |
| `GET` | `/track/daily-trend` | 每日趋势 |
| `GET` | `/track/funnel` | 审查流程漏斗 |
| `GET` | `/track/review-type-distribution` | 审查类型分布 |
| `GET` | `/track/risk-distribution` | 风险等级分布 |
| `GET` | `/track/api-performance` | API 性能统计 |

## 设计注意事项

- API 路由由 `backend/main.py` 统一注册。
- 请求和响应模型集中在 `backend/models/schemas.py`。
- 数据库模型集中在 `backend/models/database.py`。
- 当前项目仍处于演进阶段，接口字段以代码和 Swagger UI 为最终准。

