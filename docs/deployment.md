# PatentGuard 部署指南

## 一、环境要求

### 硬件要求
- CPU: 4 核心
- 内存: 8GB (推荐 16GB)
- 磁盘: 50GB (根据文档量调整)

### 软件要求
- Docker: 20.10+
- Docker Compose: 2.0+
- 浏览器: Chrome/Edge/Firefox 最新版

## 二、快速部署

### 步骤 1: 准备环境

```bash
# 克隆项目
git clone <repository-url>
cd PatentGuard
```

### 步骤 2: 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env
```

编辑 `.env` 文件，配置 LLM API：

```env
# LLM 配置 (必填)
# 支持: openai, qianwen, claude, zhipu
LLM_PROVIDER=openai
LLM_API_KEY=your-api-key-here
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini

# Embedding 配置
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIM=1536
```

### 步骤 3: 启动服务

```bash
# 一键启动
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 步骤 4: 访问系统

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:3000 |
| 后端 API | http://localhost:8000 |
| API 文档 | http://localhost:8000/docs |
| MinIO 控制台 | http://localhost:9001 |
| MinIO 账号 | minioadmin / minioadmin123 |

## 三、服务管理

### 常用命令

```bash
# 启动所有服务
docker-compose up -d

# 停止所有服务
docker-compose down

# 重启服务
docker-compose restart

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f [服务名]

# 进入容器 (调试)
docker-compose exec backend bash
```

### 服务健康检查

```bash
# 检查所有服务健康状态
curl http://localhost:8000/health

# 检查数据库连接
docker-compose exec postgres pg_isready -U patentguard_user

# 检查 MinIO
curl http://localhost:9000/minio/health/live
```

## 四、数据管理

### 数据位置

| 数据类型 | 位置 |
|----------|------|
| 数据库 | `postgres_data` volume |
| 上传文件 | `minio_data` volume |
| 应用日志 | Docker 日志 |

### 备份与恢复

#### 备份数据库
```bash
docker-compose exec -T postgres pg_dump -U patentguard_user patentguard > backup.sql
```

#### 恢复数据库
```bash
docker-compose exec -T postgres psql -U patentguard_user patentguard < backup.sql
```

#### 备份文件
```bash
docker cp patentguard-minio:/data/ ./minio-backup/
```

## 五、配置说明

### LLM API 配置

系统支持用户在前端界面配置 LLM API，也可以在 `system_config` 表中配置：

```sql
-- 查看当前配置
SELECT * FROM system_config;

-- 更新配置
UPDATE system_config 
SET config_value = 'your-api-key' 
WHERE config_key = 'llm_api_key';
```

### 支持的 LLM 提供商

| 提供商 | 模型示例 | 备注 |
|--------|----------|------|
| OpenAI | gpt-4o-mini, gpt-4 | 需要 API Key |
| 阿里云通义千问 | qwen-turbo, qwen-max | 需要阿里云 API Key |
| Anthropic Claude | claude-3-sonnet | 需要 API Key |
| 智谱清言 | glm-4 | 需要 API Key |

### Embedding 模型

推荐模型（免费可用）：
- `text-embedding-3-small` (OpenAI, 1536维)
- `text-embedding-ada-002` (OpenAI, 1536维)

## 六、常见问题

### Q1: 启动失败

检查 Docker 是否正常运行：
```bash
docker ps
```

查看具体错误：
```bash
docker-compose logs
```

### Q2: 数据库连接失败

检查数据库是否就绪：
```bash
docker-compose logs postgres
```

等待数据库完全启动后再启动后端服务。

### Q3: LLM API 调用失败

1. 检查 API Key 是否正确
2. 检查网络是否能访问 API
3. 查看后端日志确认错误信息

### Q4: 向量检索无结果

1. 确认知识库已有文档
2. 检查文档已处理完成（status = 'completed'）
3. 调整 `retrieval_top_k` 参数

### Q5: 前端无法访问后端

检查后端是否正常启动：
```bash
curl http://localhost:8000/docs
```

检查前端环境变量是否正确配置。

## 七、安全建议

### 生产环境建议

1. **修改默认密码**
   - PostgreSQL 密码
   - MinIO 账号密码
   - JWT Secret Key

2. **启用 HTTPS**
   - 使用 Nginx 反向代理
   - 配置 SSL 证书

3. **定期备份**
   - 数据库每日备份
   - 文件定期备份

4. **监控告警**
   - 配置健康检查
   - 设置资源告警

## 八、卸载

```bash
# 停止并删除所有容器
docker-compose down

# 删除数据卷 (注意：会删除所有数据)
docker-compose down -v

# 删除镜像
docker-compose down --rmi local
```