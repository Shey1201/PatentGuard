# 数据库迁移

## 手动执行迁移

如果无法使用 Alembic，可直接执行 SQL 迁移文件：

```bash
psql "postgresql+asyncpg://postgres:<PASSWORD>@db.<PROJECT-REF>.supabase.co:5432/postgres" \
  -f database/migrations/versions/001_add_review_type.sql
```

## 迁移清单

| 编号 | 文件 | 描述 | 状态 |
|------|------|------|------|
| 001 | `001_add_review_type.sql` | 添加 review_type 列到 review_tasks 表 | 按需执行：旧库升级时需要，新库若已执行 `schema.sql` 可跳过 |
