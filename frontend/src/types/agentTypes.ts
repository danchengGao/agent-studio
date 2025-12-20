// Agent 相关类型定义

// 模型详情类型
export type ModelDetail = {
  model_id?: number
  model_name: string
  temperature: number
  top_p: number
  max_tokens: number
  model_provider?: string
  api_key: string
  api_base: string
  streaming: boolean
  timeout: number
  model_type: string
  is_active: boolean // 添加模型活动状态
  // 以下字段与 API 返回的字段对应
  enable_streaming?: boolean
  enable_function_calling?: boolean
  retry_count?: number
}

// 工作流详情类型
export type WorkflowDetail = {
  description: string
  workflow_id: string
  workflow_name: string
  workflow_version: string
  create_time?: number
}

// Workflow 选择器类型
export type WorkflowSelectDetail = {
  create_time: number
  desc: string
  description: string
  icon: string
  icon_uri: string
  id: string
  name: string
  space_id: string
  tags: string[]
  version: string
  workflow_id: string
}
