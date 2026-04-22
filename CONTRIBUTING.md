# 贡献指南

感谢关注 PatentGuard。这个项目采用前后端分离结构，提交变更时请尽量保持改动范围清晰、说明完整，并优先沿用现有目录和代码风格。

## 开发流程

1. Fork 或创建功能分支。
2. 按 [.env.example](.env.example) 配置本地环境。
3. 分别启动后端和前端进行验证。
4. 提交前检查受影响模块，避免混入无关格式化或生成文件。

## 本地验证

后端：

```bash
cd backend
pip install -r requirements.txt
python -m compileall .
```

前端：

```bash
cd frontend
npm install
npm run lint
npm run build
```

如果某项验证暂时无法通过，请在 PR 中说明原因和影响范围。

## 提交建议

- 后端路由放在 `backend/api/`，业务编排放在 `backend/services/`。
- 前端页面放在 `frontend/src/pages/`，复用组件放在 `frontend/src/components/`。
- 文档按受众放入 `docs/product/`、`docs/engineering/`、`docs/ops/` 或 `docs/presentation/`。
- 运行日志、上传文件、依赖目录、构建产物不要提交。

