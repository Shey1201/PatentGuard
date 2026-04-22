-- =====================================================
-- PatentGuard 数据库 Schema (PostgreSQL + pgvector)
-- =====================================================

-- 启用扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =====================================================
-- 用户与权限
-- =====================================================

-- 用户表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user', -- 'admin', 'user'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 用户会话/Token 表
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(512) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 系统配置 (LLM API 配置)
-- =====================================================

-- 系统配置表
CREATE TABLE system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 默认配置初始数据
INSERT INTO system_config (config_key, config_value, description) VALUES
    ('llm_provider', 'custom', 'LLM 服务类型'),
    ('llm_model', '', 'LLM 模型名称'),
    ('llm_api_key', '', 'LLM API Key'),
    ('llm_base_url', '', 'LLM API 基础地址'),
    ('embedding_model', '', 'Embedding 模型'),
    ('embedding_dim', '1536', 'Embedding 维度'),
    ('chunk_size', '512', '文档分块大小'),
    ('chunk_overlap', '50', '分块重叠大小'),
    ('retrieval_top_k', '5', '检索返回数量')
ON CONFLICT (config_key) DO NOTHING;

-- =====================================================
-- 知识库 - 文档管理
-- =====================================================

-- 文档分类
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'law', 'patent', 'policy', 'standard'
    description TEXT,
    parent_id UUID REFERENCES categories(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 文档表
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    file_path VARCHAR(512), -- MinIO 存储路径
    file_size BIGINT,
    file_type VARCHAR(50), -- 'pdf', 'docx', 'txt'
    category_id UUID REFERENCES categories(id),
    content TEXT, -- 提取的文本内容
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    document_type VARCHAR(50), -- 'law', 'patent', 'policy', 'contract'
    tags TEXT[], -- 标签数组
    metadata JSONB, -- 扩展元数据
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 知识库 - 向量存储 (核心)
-- =====================================================

-- 文档分块表 (带向量)
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding VECTOR(1536), -- 默认 1536 维向量，可按实际 Embedding 服务调整
    start_position INTEGER,
    end_position INTEGER,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建向量索引 (HNSW 索引，效率高)
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
ON document_chunks 
USING hnsw (embedding vector_cosine_ops);

-- =====================================================
-- 审查记录
-- =====================================================

-- 审查任务表
CREATE TABLE review_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_name VARCHAR(255) NOT NULL,
    document_id UUID REFERENCES documents(id),
    document_title VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    result JSONB, -- 审查结果
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 审查历史表
CREATE TABLE review_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES review_tasks(id),
    user_id UUID REFERENCES users(id),
    document_name VARCHAR(255) NOT NULL,
    result_summary TEXT,
    risk_level VARCHAR(20), -- 'low', 'medium', 'high'
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 审计日志
-- =====================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    ip_address VARCHAR(50),
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 辅助视图与函数
-- =====================================================

-- 文档统计视图
CREATE OR REPLACE VIEW document_stats AS
SELECT 
    c.name as category_name,
    c.type as category_type,
    COUNT(d.id) as document_count,
    COUNT(dc.id) as chunk_count,
    SUM(d.file_size) as total_size
FROM categories c
LEFT JOIN documents d ON d.category_id = c.id
LEFT JOIN document_chunks dc ON dc.document_id = d.id
GROUP BY c.id, c.name, c.type;

-- 获取用户可管理的分类
CREATE OR REPLACE VIEW user_categories AS
SELECT c.*, u.username as created_by_username
FROM categories c
LEFT JOIN users u ON u.id = c.created_by;

-- =====================================================
-- 初始化数据
-- =====================================================

-- 初始化默认管理员 (密码: admin123, 需要在代码中哈希)
-- 这里只存储占位，实际密码需要通过注册流程设置
INSERT INTO users (email, username, password_hash, role) 
VALUES ('admin@patentguard.local', 'admin', '$2b$12$placeholderhashfortesting', 'admin')
ON CONFLICT (email) DO NOTHING;

-- 初始化默认分类
INSERT INTO categories (name, type, description) VALUES
    ('法律法规', 'law', '法律法规类文档'),
    ('专利文档', 'patent', '专利申请文档'),
    ('政策文件', 'policy', '政策文件'),
    ('行业标准', 'standard', '行业标准规范'),
    ('合同协议', 'contract', '合同协议文本')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 权限设置
-- =====================================================

-- 给管理员授权
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO patentguard_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO patentguard_user;

-- 创建只读角色（如果需要）
-- CREATE ROLE readonly_user;
-- GRANT CONNECT ON DATABASE patentguard TO readonly_user;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
