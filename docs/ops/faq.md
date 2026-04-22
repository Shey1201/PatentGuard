# 常见问题

## 启动与环境

### 后端启动失败怎么办？

先检查 `.env` 是否存在，并确认数据库、Supabase、LLM、Embedding 等必要配置已经填写。然后查看后端日志：

```bash
docker-compose logs -f backend
```

### 数据库缺少字段怎么办？

先执行完整 schema，再执行增量迁移：

```bash
psql "<DATABASE_URL>" -f database/schema.sql
psql "<DATABASE_URL>" -f database/migrations/versions/001_add_review_type.sql
```

## LLM 与 Embedding

### 支持哪些 LLM 提供商？

PatentGuard 不绑定固定 LLM 厂商。系统通过自定义配置接入模型服务，核心配置是：

- `LLM_BASE_URL`
- `LLM_MODEL`
- `LLM_API_KEY`

后端默认按兼容 Chat Completions 的格式请求：

```text
POST {LLM_BASE_URL}/chat/completions
```

因此，只要目标服务兼容该调用格式，就可以接入。

### 如何配置自定义 LLM？

1. 打开系统配置页面。
2. 填写 API 基础地址、模型名称和 API Key。
3. 保存配置。
4. 点击“测试连接”确认服务可用。

### Embedding 模型如何选择？

Embedding 同样按实际接入服务配置。需要确保：

- `EMBEDDING_MODEL` 是服务实际支持的模型名。
- `EMBEDDING_BASE_URL` 是正确的接口地址。
- `EMBEDDING_DIM` 与生成向量维度一致。

## 知识库

### 文档上传后一直是 processing 怎么办？

可以按顺序检查：

1. 后端服务是否正常运行。
2. 文档格式是否受支持。
3. Embedding 服务是否配置正确。
4. 后端日志中是否有解析、向量化或存储错误。

### 知识库搜索没有结果怎么办？

请确认：

1. 知识库中已有状态为 `completed` 的文档。
2. 文档已经完成分块和向量化。
3. 查询内容与知识库语义相关。
4. `RETRIEVAL_TOP_K` 和相似度阈值配置合理。

## 审查

### 审查返回 500 怎么办？

常见原因：

- LLM API Key 无效。
- LLM Base URL 或模型名称错误。
- Embedding 配置错误。
- 数据库连接失败。
- 文档解析失败。

建议先访问 `http://localhost:8000/docs` 使用测试接口定位问题。

### 审查结果引用不可信怎么办？

这通常表示 LLM 输出的引用无法在知识库中找到充分依据。建议：

- 检查知识库资料是否完整。
- 上传更准确的法规、模板或业务文档。
- 调整审查提示词或检索参数。

