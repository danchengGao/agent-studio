export interface KnowledgeBase {
  id: string
  name: string
  description?: string
  type: 'document' | 'web' | 'api' | 'database'
  status: 'active' | 'processing' | 'error' | 'inactive'
  documentCount: number
  size: number
  space_id: string
  created_at: string
  updated_at: string
  created_by: string
  embedding_model_config_id?: number // Embedding 模型配置ID
  desc?: string // 兼容字段
  embeddingModel?: string
  ds_kb_id?: string | null // DeepSearch 知识库 ID；当 kb_id === ds_kb_id 时为 DeepSearch 知识库，否则为原始文档知识库
}

export interface KnowledgeBaseDocument {
  id: string
  name: string
  knowledgeBaseId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
  updatedAt: string
  size: number
  type: string
}

export interface CreateKnowledgeBaseRequest {
  space_id: string
  name: string
  description?: string
  type?: 'document' | 'web' | 'api' | 'database'
  embedding_model_config_id: number // Embedding 模型配置ID（必填）
  config?: Record<string, any>
}

export interface UpdateKnowledgeBaseRequest {
  space_id: string
  kb_id: string
  name: string
  desc: string
}

export interface DeleteKnowledgeBaseRequest {
  space_id: string
  kb_id: string
}

export interface GetKnowledgeBasesRequest {
  space_id: string
  page: number
  size: number
}

export interface SearchKnowledgeBaseRequest {
  space_id: string
  query: string
  page?: number
  page_size?: number
}

export interface SearchKnowledgeBaseItem {
  id: string
  space_id: string
  name: string
  description: string
  embedding_model_config_id?: number
  config?: Record<string, any>
  create_time: number
  update_time: number
}

export interface KnowledgeBaseSearchRequest {
  space_id: string
  query: string
  page?: number
  page_size?: number
}

export interface KnowledgeBaseSearchResponse {
  knowledgeBases: KnowledgeBase[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface KnowledgeBaseStatistics {
  totalKnowledgeBases: number
  activeKnowledgeBases: number
  totalDocuments: number
  recentlyCreated: KnowledgeBase[]
  recentlyUpdated: KnowledgeBase[]
}

export interface GetKnowledgeBasesRequest {
  space_id: string
  page: number
  size: number
}

export interface KnowledgeBaseItem {
  name: string
  desc: string
  id: string
  type: string
  embedding_model_config_id?: number
  created_at: string
  updated_at: string
  ds_kb_id?: string | null
}

