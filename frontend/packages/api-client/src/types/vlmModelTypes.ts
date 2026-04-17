import type { ModelProvider } from './modelTypes'

export interface VLMModelConfigBase {
  name: string
  provider: ModelProvider
  space_id: string
  model_id: string
  base_url: string
  description?: string
  tags: string[]
  timeout: number
  retry_count: number
  is_active: boolean
}

export interface VLMModelConfigCreate extends VLMModelConfigBase {
  api_key: string
}

export interface VLMModelConfigUpdate {
  name?: string
  provider?: ModelProvider
  model_id?: string
  api_key?: string
  base_url?: string
  description?: string
  tags?: string[]
  timeout?: number
  retry_count?: number
  is_active?: boolean
}

export interface VLMModelConfigResponse extends VLMModelConfigBase {
  id: number
  created_at: string
  updated_at: string
  api_key_masked?: string
}

export interface VLMModelConfigList {
  items: VLMModelConfigResponse[]
  total: number
  page: number
  size: number
}

export interface VLMModelConfigRequest {
  config_id: number
  space_id: string
}

export interface VLMModelTestRequest {
  prompt: string
  mime_type?: string
  image_base64?: string
  parameters?: {
    temperature?: number
    top_p?: number
    max_tokens?: number
  }
}

export interface VLMModelTestResponse {
  success: boolean
  response?: string
  error?: string
  latency: number
  tokens_used?: number
  cost?: number
}

export interface VLMModelConfigUpdateRequest extends VLMModelConfigUpdate {
  config_id: number
  space_id: string
}

export interface VLMModelConfigQueryParams {
  page?: number
  size?: number
  provider?: ModelProvider
  is_active?: boolean
  search?: string
  sort_by?: 'updated_at' | 'created_at' | 'name'
  sort_order?: 'asc' | 'desc'
}

export interface VLMModelApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface VLMModelApiError {
  code: number
  message: string
  error?: string
  details?: Record<string, unknown>
}
