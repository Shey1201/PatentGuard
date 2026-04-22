# 埋点分析指南

本文说明如何基于当前埋点表做产品和工程分析。它面向产品、运营和开发同学，重点是“能用现有数据回答什么问题”。

## 数据来源

| 数据源 | 表 | 主要用途 |
| --- | --- | --- |
| 前端行为事件 | `business_events` | 页面访问、点击、上传、审查、配置、搜索等行为 |
| API 调用日志 | `api_logs` | 接口耗时、状态码、错误排查和性能分析 |

## 推荐指标

### 使用活跃度

| 指标 | 口径 |
| --- | --- |
| 页面访问量 | `event_name = 'page_view'` |
| 活跃会话数 | `COUNT(DISTINCT session_id)` |
| 活跃用户数 | `COUNT(DISTINCT user_id)`，注意匿名事件不计入 |
| 页面停留时长 | `event_name = 'page_stay'` 的 `duration_ms` |

### 核心业务漏斗

推荐使用以下事件观察审查流程：

```text
document_upload
-> review_submit
-> review_complete
-> review_view_result
```

注意：如果页面未触发某个事件，对应漏斗步骤会偏低或为空。

### 功能使用情况

| 功能 | 事件 |
| --- | --- |
| 知识库搜索 | `kb_search`、`search_no_result` |
| 知识库上传 | `kb_upload` |
| 审查类型选择 | `review_type_select` |
| 审查提交 | `review_submit` |
| 审查完成 | `review_complete` |
| 配置保存 | `settings_save` |
| 配置测试 | `settings_test` |

### API 性能

使用 `api_logs` 分析：

- 慢接口排行
- 状态码分布
- P50 / P95 响应时间
- 某个用户或某类路径的异常调用

## 常用 SQL

### 每日事件数

```sql
SELECT
  DATE(created_at) AS day,
  COUNT(*) AS events
FROM business_events
GROUP BY DATE(created_at)
ORDER BY day;
```

### 页面访问 Top 10

```sql
SELECT
  properties->>'page_url' AS page_url,
  COUNT(*) AS views,
  COUNT(DISTINCT session_id) AS sessions
FROM business_events
WHERE event_name = 'page_view'
GROUP BY properties->>'page_url'
ORDER BY views DESC
LIMIT 10;
```

### 审查类型分布

```sql
SELECT
  properties->>'review_type' AS review_type,
  COUNT(*) AS count
FROM business_events
WHERE event_name IN ('review_submit', 'review_complete')
GROUP BY properties->>'review_type'
ORDER BY count DESC;
```

### 审查完成成功率

```sql
SELECT
  properties->>'review_type' AS review_type,
  COUNT(*) AS total,
  SUM(CASE WHEN properties->>'success' = 'true' THEN 1 ELSE 0 END) AS success_count,
  ROUND(
    SUM(CASE WHEN properties->>'success' = 'true' THEN 1 ELSE 0 END)::numeric
    / NULLIF(COUNT(*), 0) * 100,
    2
  ) AS success_rate
FROM business_events
WHERE event_name = 'review_complete'
GROUP BY properties->>'review_type';
```

### 审查漏斗

```sql
WITH funnel AS (
  SELECT 'document_upload' AS step, COUNT(DISTINCT resource_id) AS count
  FROM business_events
  WHERE event_name = 'document_upload'

  UNION ALL

  SELECT 'review_submit' AS step, COUNT(DISTINCT resource_id) AS count
  FROM business_events
  WHERE event_name = 'review_submit'

  UNION ALL

  SELECT 'review_complete' AS step, COUNT(DISTINCT resource_id) AS count
  FROM business_events
  WHERE event_name = 'review_complete'

  UNION ALL

  SELECT 'review_view_result' AS step, COUNT(DISTINCT resource_id) AS count
  FROM business_events
  WHERE event_name = 'review_view_result'
)
SELECT * FROM funnel;
```

### 慢接口排行

```sql
SELECT
  endpoint,
  method,
  COUNT(*) AS calls,
  ROUND(AVG(duration_ms)::numeric, 2) AS avg_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::numeric, 2) AS p95_ms
FROM api_logs
GROUP BY endpoint, method
ORDER BY p95_ms DESC
LIMIT 20;
```

### API 错误统计

```sql
SELECT
  endpoint,
  status_code,
  COUNT(*) AS error_count
FROM api_logs
WHERE status_code >= 400
GROUP BY endpoint, status_code
ORDER BY error_count DESC;
```

## 分析注意事项

- 当前前端 tracker 请求通常不带认证头，`business_events.user_id` 可能为空。做用户级分析前，应先确认用户归因是否已接入。
- 事件名来自前端调用，分析前要先确认页面是否真的触发了对应事件。
- `properties` 是 JSON 字段，字段是否存在取决于事件类型。
- API 性能数据来自后端中间件，更适合工程排查；业务转化分析应优先使用 `business_events`。

