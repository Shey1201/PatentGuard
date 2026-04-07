# PatentGuard 常见问题 (FAQ)

## 一、部署相关问题

### Q1: Docker 启动失败怎么办？

**A:** 请按以下步骤排查：

1. 检查 Docker 是否正常运行：
   ```bash
   docker ps
   ```

2. 查看具体错误日志：
   ```bash
   docker-compose logs
   ```

3. 常见原因：
   - 端口被占用（3000、8000、5432、9000）
   - 内存不足（建议至少 8GB）
   - 磁盘空间不足

### Q2: 数据库连接失败

**A:** 
1. 等待数据库完全启动（首次启动可能需要 30-60 秒）
2. 检查数据库日志：
   ```bash
   docker-compose logs postgres
   ```
3. 确认环境变量中的数据库配置正确

### Q3: 如何修改默认端口？

**A:** 编辑 `docker-compose.yml` 文件，修改对应服务的端口映射：
```yaml
services:
  frontend:
    ports:
      - "8080:80"  # 将 3000 改为 8080
```

---

## 二、LLM API 相关问题

### Q1: LLM API 调用失败

**A:** 
1. 检查 API Key 是否正确配置
2. 确认网络可以访问对应的 API 地址
3. 在系统设置页面测试连接
4. 查看后端日志获取详细错误信息：
   ```bash
   docker-compose logs backend
   ```

### Q2: 支持哪些 LLM 提供商？

**A:** 目前支持：
- OpenAI (GPT-4, GPT-3.5)
- 阿里云通义千问 (qwen-turbo, qwen-max)
- Anthropic Claude
- 智谱清言 (GLM-4)
- 任何 OpenAI 兼容接口

### Q3: 如何配置自定义 LLM API？

**A:**
1. 进入系统设置页面
2. 选择 "自定义" 提供商
3. 填写 API 地址和模型名称
4. 确保接口兼容 OpenAI API 格式

### Q4: Embedding 模型如何选择？

**A:** 推荐选项：
- `text-embedding-3-small` (OpenAI, 1536维, 推荐)
- `text-embedding-ada-002` (OpenAI, 1536维)
- `text-embedding-3-large` (OpenAI, 3072维, 更高精度)

---

## 三、知识库相关问题

### Q1: 支持的文档格式有哪些？

**A:** 目前支持：
- PDF (.pdf)
- Word (.docx, .doc)
- 纯文本 (.txt)

### Q2: 文档上传后状态一直是 "processing"

**A:**
1. 检查后端服务是否正常运行
2. 查看处理日志：
   ```bash
   docker-compose logs -f backend
   ```
3. 可能是文档过大或格式特殊，建议分割后重新上传

### Q3: 向量检索无结果

**A:**
1. 确认知识库中已有文档且状态为 "completed"
2. 检查 Embedding 配置是否正确
3. 调整 `retrieval_top_k` 参数
4. 确认文档内容不为空

### Q4: 如何删除已上传的文档？

**A:** 只有管理员可以删除文档：
1. 以管理员身份登录
2. 进入知识库管理页面
3. 点击文档列表中的删除按钮

---

## 四、文档审查相关问题

### Q1: 审查任务一直显示 "processing"

**A:**
1. 大文档审查可能需要较长时间（几分钟）
2. 检查 LLM API 是否正常响应
3. 查看任务详情获取错误信息

### Q2: 审查结果不准确

**A:**
1. 确保知识库中有相关的法规/标准文档
2. 尝试调整检索参数
3. 上传更多相关的参考文档到知识库

### Q3: 如何导出审查报告？

**A:** 目前支持在审查结果页面复制 JSON 格式的结果。PDF/Word 导出功能正在开发中。

---

## 五、性能优化

### Q1: 系统运行缓慢

**A:**
1. 增加 Docker 内存限制
2. 优化 PostgreSQL 配置
3. 考虑使用更高配置的 Embedding 模型
4. 减少单次检索的文档数量

### Q2: 如何提升检索准确性？

**A:**
1. 使用更高质量的 Embedding 模型
2. 调整 `chunk_size` 和 `chunk_overlap` 参数
3. 对知识库文档进行合理分类
4. 定期更新知识库内容

---

## 六、安全相关问题

### Q1: 如何修改默认密码？

**A:**
1. 数据库密码：修改 `.env` 文件中的 `POSTGRES_PASSWORD`
2. MinIO 密码：修改 `.env` 文件中的 `MINIO_ROOT_PASSWORD`
3. JWT Secret：修改 `.env` 文件中的 `SECRET_KEY`

### Q2: 生产环境部署建议

**A:**
1. 启用 HTTPS
2. 修改所有默认密码
3. 配置防火墙规则
4. 定期备份数据
5. 启用访问日志

### Q3: API Key 存储安全吗？

**A:** API Key 存储在数据库中，建议：
1. 使用环境变量配置初始值
2. 定期更换 API Key
3. 限制数据库访问权限

---

## 七、开发相关问题

### Q1: 如何本地开发调试？

**A:**
```bash
# 后端
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# 前端
cd frontend
npm install
npm run dev
```

### Q2: 如何添加新的文档解析器？

**A:** 在 `backend/services/parser.py` 中添加新的解析函数，然后在 `extract_text` 函数中注册。

### Q3: 如何扩展 LLM 提供商？

**A:** 在 `backend/services/llm.py` 中扩展 `LLMService` 类，添加对新提供商的支持。

---

## 八、其他问题

### Q1: 如何获取技术支持？

**A:**
- 提交 Issue 到项目仓库
- 查看项目文档
- 参考架构设计文档

### Q2: 项目是否开源？

**A:** 是的，项目采用 MIT 许可证开源。

### Q3: 如何贡献代码？

**A:**
1. Fork 项目仓库
2. 创建功能分支
3. 提交 Pull Request
4. 等待代码审查

---

## 问题反馈

如果您遇到其他问题，请：
1. 查看后端日志获取错误信息
2. 记录复现步骤
3. 提交详细的 Issue 报告
