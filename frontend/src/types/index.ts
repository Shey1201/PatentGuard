export interface User {
  id: string;
  email: string;
  username: string;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface Category {
  id: string;
  name: string;
  type: string;
  description?: string;
  document_count: number;
  created_at: string;
}

export interface Document {
  id: string;
  title: string;
  original_filename?: string;
  file_path?: string;
  file_size?: number;
  file_type?: string;
  category_id?: string;
  content?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  document_type?: string;
  tags?: string[];
  uploaded_by?: string;
  created_at: string;
}

export interface DocumentWithChunks extends Document {
  chunks: { index: number; text: string }[];
}

export interface SearchResult {
  document_id: string;
  document_title: string;
  chunk_text: string;
  score: number;
  metadata: Record<string, any>;
}

export interface ReviewTask {
  id: string;
  task_name: string;
  document_id?: string;
  document_title?: string;
  review_type?: string;   // 审查类型: general/patent/law/contract
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: ReviewResult;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface ReviewResult {
  compliance: boolean;
  risk_level: 'low' | 'medium' | 'high';
  summary: string;
  findings: Finding[];
  referenced_documents: ReferencedDocument[];
}

export interface Finding {
  type: 'risk' | 'suggestion' | 'error';
  severity: 'low' | 'medium' | 'high';
  description: string;
  reference?: string;
  suggestion?: string;
  verification_status?: 'verified' | 'unverified';  // 引用校验状态
}

export interface ReferencedDocument {
  title: string;
  relevance: number;
  matched_chunks: string[];
}

export interface SystemConfig {
  llm_provider: string;
  llm_model: string;
  llm_api_key?: string;
  llm_base_url: string;
  embedding_model: string;
  embedding_dim: number;
  chunk_size: number;
  chunk_overlap: number;
  retrieval_top_k: number;
}

export interface SystemStats {
  total_documents: number;
  processed_documents: number;
  total_chunks: number;
  total_reviews: number;
  completed_reviews: number;
  pending_documents?: number;
  compliance_rate?: number;
}

export interface UserStats {
  total_reviews: number;
  completed_reviews: number;
  pending_reviews: number;
  failed_reviews: number;
}
