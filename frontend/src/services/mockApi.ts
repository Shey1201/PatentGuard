import dayjs from 'dayjs';
import { SystemStats, SystemConfig, Category, Document } from '../types';

// 模拟数据
export const MOCK_STATS: SystemStats = {
  total_documents: 128,
  processed_documents: 94,
  total_chunks: 3247,
  total_reviews: 156,
  completed_reviews: 142,
  pending_documents: 12,
  compliance_rate: 89.4,
};

export const MOCK_CONFIG: SystemConfig = {
  llm_provider: 'qianwen',
  llm_model: 'qwen-max',
  llm_api_key: '',
  llm_base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  embedding_model: 'text-embedding-3-small',
  embedding_dim: 1536,
  chunk_size: 512,
  chunk_overlap: 50,
  retrieval_top_k: 5,
};

export const MOCK_CATEGORIES: Category[] = [
  { id: '1', name: '专利法律法规', type: 'law', description: '专利相关法律法规', document_count: 24, created_at: '2024-01-15T10:00:00Z' },
  { id: '2', name: '专利模板', type: 'patent', description: '专利申请模板', document_count: 36, created_at: '2024-02-20T14:30:00Z' },
  { id: '3', name: '政策文件', type: 'policy', description: '国家政策文件', document_count: 18, created_at: '2024-03-10T09:15:00Z' },
  { id: '4', name: '合同协议', type: 'contract', description: '标准合同范本', document_count: 12, created_at: '2024-04-05T11:45:00Z' },
];

export const MOCK_DOCUMENTS: Document[] = [
  { id: '1', title: '专利法实施细则', file_type: 'pdf', status: 'completed', category_id: '1', created_at: '2024-01-16T10:00:00Z' },
  { id: '2', title: '发明专利申请书模板', file_type: 'docx', status: 'completed', category_id: '2', created_at: '2024-02-21T14:30:00Z' },
  { id: '3', title: '实用新型专利请求书', file_type: 'docx', status: 'processing', category_id: '2', created_at: '2024-03-01T16:00:00Z' },
  { id: '4', title: '外观设计专利申请文件', file_type: 'pdf', status: 'pending', category_id: '2', created_at: '2024-03-05T09:20:00Z' },
  { id: '5', title: '高新技术企业认定管理办法', file_type: 'pdf', status: 'completed', category_id: '3', created_at: '2024-03-11T09:15:00Z' },
  { id: '6', title: '技术转让合同范本', file_type: 'docx', status: 'completed', category_id: '4', created_at: '2024-04-06T11:45:00Z' },
  { id: '7', title: '专利许可合同', file_type: 'pdf', status: 'pending', category_id: '4', created_at: '2024-04-10T13:30:00Z' },
  { id: '8', title: '专利审查指南', file_type: 'pdf', status: 'completed', category_id: '1', created_at: '2024-01-20T10:00:00Z' },
];

// 延迟模拟网络请求
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const mockApi = {
  // 系统统计
  getStats: async () => {
    await delay(300);
    return { data: MOCK_STATS };
  },

  // 用户个人统计
  getUserStats: async () => {
    await delay(300);
    return {
      data: {
        total_reviews: 28,
        completed_reviews: 22,
        pending_reviews: 4,
        failed_reviews: 2,
      },
    };
  },

  // 系统配置
  getConfig: async () => {
    await delay(300);
    return { data: MOCK_CONFIG };
  },

  updateLLMConfig: async (config: Partial<SystemConfig>) => {
    await delay(500);
    Object.assign(MOCK_CONFIG, config);
    return { data: { success: true } };
  },

  updateEmbeddingConfig: async (config: Partial<SystemConfig>) => {
    await delay(500);
    Object.assign(MOCK_CONFIG, config);
    return { data: { success: true } };
  },

  testLLM: async () => {
    await delay(1000);
    return { data: { success: true, response: 'API 连接正常，模型响应正常。' } };
  },

  // 登录（忽略参数，返回模拟用户）
  login: async (_data?: { email: string; password: string }) => {
    await delay(500);
    return {
      data: {
        access_token: 'mock-token-12345',
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          id: '1',
          email: 'admin@patentguard.local',
          username: '管理员',
          role: 'admin',
          is_active: true,
          created_at: new Date().toISOString(),
        },
      },
    };
  },

  // 知识库分类
  getCategories: async () => {
    await delay(300);
    return { data: MOCK_CATEGORIES };
  },

  createCategory: async (data: { name: string; type: string; description?: string }) => {
    await delay(300);
    const newCat: Category = {
      id: String(Date.now()),
      ...data,
      document_count: 0,
      created_at: new Date().toISOString(),
    };
    MOCK_CATEGORIES.push(newCat);
    return { data: newCat };
  },

  // 知识库文档
  getDocuments: async (params?: { page?: number; page_size?: number; category_id?: string }) => {
    await delay(400);
    let docs = [...MOCK_DOCUMENTS];
    if (params?.category_id) {
      docs = docs.filter(d => d.category_id === params.category_id);
    }
    return { data: docs };
  },

  uploadDocument: async (formData: FormData) => {
    await delay(800);
    const newDoc: Document = {
      id: String(Date.now()),
      title: formData.get('file')?.toString() || '新文档',
      file_type: 'pdf',
      status: 'pending',
      category_id: formData.get('category_id')?.toString(),
      created_at: new Date().toISOString(),
    };
    MOCK_DOCUMENTS.unshift(newDoc);
    return { data: newDoc };
  },

  deleteDocument: async (id: string) => {
    await delay(300);
    const idx = MOCK_DOCUMENTS.findIndex(d => d.id === id);
    if (idx >= 0) MOCK_DOCUMENTS.splice(idx, 1);
    return { data: { success: true } };
  },

  processDocument: async (id: string) => {
    await delay(1500);
    const doc = MOCK_DOCUMENTS.find(d => d.id === id);
    if (doc) doc.status = 'completed';
    return { data: { success: true } };
  },

  // 审查历史
  getHistory: async (params?: { page?: number; page_size?: number }) => {
    await delay(400);
    const page = params?.page ?? 1;
    const pageSize = params?.page_size ?? 10;
    const now = dayjs();
    const items: any[] = [
      {
        id: '1', task_name: '发明专利申请书合规审查', document_title: '发明专利申请书模板',
        status: 'completed', created_at: now.subtract(10, 'minute').toISOString(),
        completed_at: now.subtract(8, 'minute').toISOString(),
        result: { compliance: true, risk_level: 'low', summary: '文档格式规范，内容合规，未发现明显风险点。建议保持现有撰写风格。', findings: [], referenced_documents: [] },
      },
      {
        id: '2', task_name: '实用新型专利请求书审查', document_title: '实用新型专利请求书',
        status: 'completed', created_at: now.subtract(2, 'hour').toISOString(),
        completed_at: now.subtract(1, 'hour').toISOString(),
        result: { compliance: false, risk_level: 'high', summary: '发现 3 处高风险问题：(1) 权利要求书缺少必要技术特征；(2) 说明书实施例不充分；(3) 摘要超出字数限制。', findings: [
          { type: 'risk', severity: 'high', description: '权利要求书缺少必要技术特征', suggestion: '补充必要技术特征以满足新颖性和创造性要求', reference: '专利法实施细则第23条' },
          { type: 'risk', severity: 'high', description: '说明书实施例不充分', suggestion: '增加至少2个具体实施例', reference: '专利法第26条第3款' },
          { type: 'risk', severity: 'medium', description: '摘要超出规定字数（应为300字以内）', suggestion: '精简摘要内容', reference: '专利法实施细则第24条' },
        ], referenced_documents: [
          { title: '专利法实施细则', relevance: 0.92, matched_chunks: ['第23条权利要求书的撰写要求'] },
          { title: '专利审查指南', relevance: 0.85, matched_chunks: ['第二章第3节 说明书的要求'] },
        ] },
      },
      {
        id: '3', task_name: '技术转让合同合规审查', document_title: '技术转让合同范本',
        status: 'completed', created_at: now.subtract(1, 'day').toISOString(),
        completed_at: now.subtract(1, 'day').add(5, 'minute').toISOString(),
        result: { compliance: true, risk_level: 'medium', summary: '合同主体资格合法，但存在2处中等风险点：违约金条款约定不明、争议解决条款需补充仲裁条款。', findings: [
          { type: 'risk', severity: 'medium', description: '违约金条款约定不明', suggestion: '明确违约金计算方式或固定金额', reference: '民法典第585条' },
          { type: 'suggestion', severity: 'medium', description: '争议解决条款需补充仲裁条款', suggestion: '建议增加仲裁条款以提高纠纷解决效率', reference: '合同法司法解释（二）' },
        ], referenced_documents: [
          { title: '技术合同纠纷司法解释', relevance: 0.78, matched_chunks: ['第12条技术转让合同条款要求'] },
        ] },
      },
      {
        id: '4', task_name: '高新技术企业认定材料审查', document_title: '高新技术企业认定管理办法',
        status: 'processing', created_at: now.subtract(30, 'minute').toISOString(),
      },
      {
        id: '5', task_name: '外观设计专利申请文件审查', document_title: '外观设计专利申请文件',
        status: 'failed', created_at: now.subtract(3, 'day').toISOString(),
        completed_at: now.subtract(3, 'day').add(1, 'minute').toISOString(),
        error_message: '文档解析失败：文件损坏，无法提取文本内容',
      },
      {
        id: '6', task_name: '专利许可合同审查', document_title: '专利许可合同',
        status: 'pending', created_at: now.subtract(5, 'minute').toISOString(),
      },
    ];
    const start = (page - 1) * pageSize;
    return { data: { items: items.slice(start, start + pageSize), total: items.length } };
  },

  getResult: async (id: string) => {
    await delay(300);
    const { data } = await mockApi.getHistory({ page_size: 100 });
    const task = data.items.find((t: any) => t.id === id);
    return { data: task?.result ?? null };
  },
};
