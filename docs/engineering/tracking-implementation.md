# 埋点实现说明

本文描述 PatentGuard 当前已经落地的数据埋点实现，包括前端采集、后端接收、数据库存储和统计查询。

## 当前目标

埋点系统用于回答三类问题：

- 用户是否在使用系统，以及主要访问哪些页面。
- 知识库、审查、配置等核心功能是否被触发。
- API 调用是否稳定，哪些接口响应慢或错误率高。

## 实现结构

```text
frontend/src/utils/tracker.ts
  -> /api/v1/track/events 或 /api/v1/track/events/batch
    -> backend/api/tracking.py
      -> backend/services/tracking.py
        -> business_events / api_logs
```

相关文件：

| 文件 | 说明 |
| --- | --- |
| `frontend/src/utils/tracker.ts` | 前端埋点 SDK，负责事件封装、队列和批量发送 |
| `frontend/src/stores/tracker.ts` | Zustand store，负责初始化和页面访问去重 |
| `frontend/src/hooks/useTrack.ts` | React Hook，封装页面访问、点击、审查、知识库等事件 |
| `frontend/src/services/api.ts` | tracking API client |
| `backend/api/tracking.py` | 埋点 API 路由 |
| `backend/services/tracking.py` | 事件写入、查询和聚合统计 |
| `backend/models/database.py` | `BusinessEvent` 与 `APILog` ORM 模型 |
| `backend/models/schemas.py` | 埋点请求和响应 schema |
| `backend/main.py` | API 日志中间件 |

## 前端采集

前端 SDK 使用内存队列暂存事件：

- 默认每 5 秒尝试发送一次。
- 队列达到 20 条时立即发送。
- 页面卸载时尝试使用 `navigator.sendBeacon` 发送剩余事件。

事件基础结构：

```ts
interface TrackEvent {
  event_name: string;
  event_category?: string;
  session_id?: string;
  resource_id?: string;
  properties?: Record<string, any>;
  system_info?: SystemInfo;
}
```

系统信息包括：

- 设备类型
- 浏览器
- 操作系统
- 屏幕尺寸
- 语言
- 时区

## 事件类型

当前 SDK 已封装的主要事件：

| 事件 | 分类 | 说明 |
| --- | --- | --- |
| `page_view` | `navigation` | 页面访问 |
| `page_stay` | `navigation` | 页面停留时长 |
| `button_click` | `user_action` | 按钮或链接点击 |
| `search_action` | `user_action` | 搜索行为 |
| `login` | `user_action` | 登录尝试 |
| `logout` | `user_action` | 退出登录 |
| `document_upload` | `business` | 审查文件上传 |
| `review_submit` | `business` | 提交审查 |
| `review_complete` | `business` | 审查完成 |
| `kb_document_view` | `user_action` | 查看知识库文档 |
| `kb_document_delete` | `user_action` | 删除知识库文档 |
| `kb_category_create` | `user_action` | 创建知识库分类 |
| `kb_category_delete` | `user_action` | 删除知识库分类 |
| `kb_search` | `user_action` | 知识库搜索 |
| `kb_upload` | `business` | 知识库文档入库 |
| `settings_save` | `system` | 保存配置 |
| `settings_test` | `system` | 测试配置连接 |
| `review_type_select` | `user_action` | 选择审查类型 |
| `review_file_select` | `user_action` | 选择审查文件 |
| `review_view_result` | `business` | 查看审查结果 |
| `review_download` | `business` | 下载审查结果 |
| `review_share` | `business` | 分享审查结果 |
| `ui_action` | `user_action` | 通用 UI 操作 |
| `dropdown_select` | `user_action` | 下拉选择 |
| `modal_open` | `user_action` | 打开弹窗 |
| `modal_close` | `user_action` | 关闭弹窗 |
| `export_action` | `user_action` | 导出 |
| `performance_sample` | `system` | 页面性能采样 |
| `validation_error` | `system` | 表单校验错误 |
| `upload_error` | `system` | 上传错误 |
| `search_no_result` | `user_action` | 搜索无结果 |
| `error` | `system` | 通用错误 |

## 后端 API

路由统一挂载在 `/api/v1/track`。

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| `POST` | `/events` | 写入单条事件 | 可匿名 |
| `POST` | `/events/batch` | 批量写入事件 | 可匿名 |
| `GET` | `/events` | 查询事件列表 | 当前实现可匿名过滤 |
| `GET` | `/stats` | 获取事件统计 | 当前实现可匿名过滤 |
| `GET` | `/api-logs` | 查询 API 日志 | 管理员 |
| `GET` | `/events/export` | 导出事件 | 管理员 |
| `GET` | `/dashboard-stats` | 管理员看板概要 | 管理员 |
| `GET` | `/daily-trend` | 每日趋势 | 管理员 |
| `GET` | `/funnel` | 审查流程漏斗 | 管理员 |
| `GET` | `/review-type-distribution` | 审查类型分布 | 管理员 |
| `GET` | `/risk-distribution` | 风险等级分布 | 管理员 |
| `GET` | `/api-performance` | API 性能统计 | 管理员 |

## 数据库存储

### business_events

用于保存前端行为和业务事件。

| 字段 | 说明 |
| --- | --- |
| `id` | 事件 ID |
| `event_name` | 事件名称 |
| `event_category` | 事件分类 |
| `user_id` | 用户 ID，可为空 |
| `session_id` | 前端会话 ID |
| `resource_id` | 关联资源 ID |
| `properties` | 事件自定义属性 |
| `system_info` | 设备、浏览器、系统等信息 |
| `created_at` | 创建时间 |

### api_logs

由 `backend/main.py` 中的 HTTP 中间件自动写入。

| 字段 | 说明 |
| --- | --- |
| `method` | HTTP 方法 |
| `endpoint` | 请求路径 |
| `status_code` | 响应状态码 |
| `duration_ms` | 响应耗时 |
| `user_id` | 用户 ID，可为空 |
| `ip_address` | 客户端 IP |
| `user_agent` | User-Agent |
| `request_size` | 请求体大小 |
| `response_size` | 当前预留，部分请求可能为空 |
| `error_message` | 当前预留 |

## 已知边界

- 前端 tracker 直接使用 `axios.post`，没有复用 `frontend/src/services/api.ts` 的认证拦截器，因此多数埋点事件的 `user_id` 可能为空。若需要用户归因，应给 tracker 请求补充 Authorization header。
- `navigator.sendBeacon` 默认 Content-Type 可能不是 `application/json`，页面卸载时的批量事件需要在浏览器中重点验证。
- 管理员看板统计依赖前端是否实际触发对应事件；若某些事件未接入页面，相关图表会为空。
- 当前 API 日志中间件记录了请求体大小，但未统一记录响应体大小。

