// 提示词模型相关类型定义

// 参数配置接口
export interface ParamSchema {
  name: string
  label: string
  desc: string
  type: 'float' | 'int' | 'string' | 'boolean'
  min?: string
  max?: string
  default_val?: string
}

// 参数配置
export interface ParamConfig {
  param_schemas: ParamSchema[]
}

// 开放模型接口
export interface OpenModel {
  workspace_id: string
  desc: string
  name: string
  model_id: string
  param_config: ParamConfig
}

// 模型系列接口
export interface ModelSeries {
  icon: string
  name: string
  vendor: string
}

// 模型接口
export interface Model {
  tags: string[]
  icon: string
  openModel: OpenModel
  series: ModelSeries
  model_from: string
}

// 获取模型列表请求参数
export interface GetModelsListRequest {
  workspace_id: string
  scenario: string
  page_size: number
  page_token: string
}

// 获取模型列表响应
export interface GetModelsListResponse {
  msg: string
  code: number
  has_more: boolean
  models: Model[]
  next_page_token: string
  total: number
}

// 获取模型详情响应
export interface GetModelDetailResponse {
  msg: string
  code: number
  model: Model
}

// 获取模型列表的可选参数
export interface GetModelsListParams {
  scenario?: string
  pageSize?: number
  pageToken?: string
  workspaceId?: string
}

// API响应包装器
export interface PromptModelApiResponse<T> {
  code: number
  msg: string
  data?: T
}

// 错误响应
export interface PromptModelApiError {
  code: number
  msg: string
  error?: string
  details?: Record<string, any>
}
