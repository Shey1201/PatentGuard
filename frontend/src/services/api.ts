import axios, { AxiosInstance, AxiosError } from 'axios';
import { DEMO_PREVIEW_TOKEN } from '../constants/auth';

// 强制使用真实API，不再降级到模拟数据
const USE_MOCK = false;

// 使用相对路径，通过 Vite 代理转发到后端
const API_BASE_URL = '/api/v1';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 从 localStorage 或 persist 的 auth-storage 中读取 token（兼容默认演示用户）
// 注意：FastAPI HTTPBearer 在缺少 Authorization 时会返回 403，首屏可能早于 Zustand persist 写入，需回退演示 token
function getAuthToken(): string | null {
  const direct = localStorage.getItem('token');
  if (direct) return direct;
  try {
    const raw = localStorage.getItem('auth-storage');
    if (raw) {
      const o = JSON.parse(raw);
      const fromPersist = o?.state?.token ?? null;
      if (fromPersist) return fromPersist;
    }
  } catch (_) {}
  return DEMO_PREVIEW_TOKEN;
}

// 请求拦截器 - 添加 Token
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器 - 处理错误
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API 调用（强制使用真实后端API，不再降级）
const withFallback = async <T>(real: () => Promise<T>): Promise<T> => {
  return real();
};

// Auth API
export const authApi = {
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  register: (data: { email: string; username: string; password: string }) =>
    api.post('/auth/register', data),
  getCurrentUser: () => api.get('/auth/me'),
};

// Knowledge Base API
export const kbApi = {
  getCategories: () =>
    api.get('/kb/categories'),
  createCategory: (data: { name: string; type: string; description?: string }) =>
    api.post('/kb/categories', data),
  deleteCategory: (id: string) => api.delete(`/kb/categories/${id}`),

  getDocuments: (params?: { page?: number; page_size?: number; category_id?: string }) =>
    api.get('/kb/documents', { params }),
  getDocument: (id: string) => api.get(`/kb/documents/${id}`),
  uploadDocument: (formData: FormData) =>
    api.post('/kb/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteDocument: (id: string) =>
    api.delete(`/kb/documents/${id}`),
  processDocument: (id: string) =>
    api.post(`/kb/documents/${id}/process`),

  search: (q: string, top_k?: number) =>
    api.get('/kb/search', { params: { q, top_k } }),
};

// Analysis API
export const analysisApi = {
  createReviewTask: (data: { task_name: string; document_id?: string; review_type: string }) =>
    api.post('/analysis/review', data),
  reviewWithFile: (formData: FormData) =>
    api.post('/analysis/review/with-file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getTask: (id: string) => api.get(`/analysis/tasks/${id}`),
  getResult: (id: string) => api.get(`/analysis/results/${id}`),
  executeTask: (id: string) => api.post(`/analysis/review/${id}/execute`),
  getHistory: (params?: { page?: number; page_size?: number }) =>
    api.get('/analysis/history', { params }),
  getAllHistory: (params?: { page?: number; page_size?: number }) =>
    api.get('/analysis/history/all', { params }),
};

// System API
export const systemApi = {
  getConfig: () =>
    api.get('/system/config'),
  updateLLMConfig: (data: {
    llm_provider: string;
    llm_model: string;
    llm_api_key: string;
    llm_base_url: string;
  }) =>
    api.put('/system/config/llm', data),
  updateEmbeddingConfig: (data: {
    embedding_model: string;
    chunk_size: number;
    chunk_overlap: number;
    retrieval_top_k: number;
  }) =>
    api.put('/system/config/embedding', data),
  testLLM: () =>
    api.post('/system/config/test-llm', { prompt: '你好，请回复"连接成功"' }),
  getStats: () =>
    api.get('/system/stats'),
  getUserStats: () =>
    api.get('/system/user-stats'),
  getRecentActivity: (limit?: number) =>
    api.get<{ items: { id: string; time: string; title: string; type: string }[] }>(
      '/system/recent-activity',
      { params: { limit: limit ?? 10 } }
    ),
};

export default api;
