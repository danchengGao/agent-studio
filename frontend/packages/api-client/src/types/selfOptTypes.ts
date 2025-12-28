// 自优化相关类型定义

// 消息接口
export interface OptimizationMessage {
  role: 'user' | 'assistant'
  content: string
  variable?: Record<string, string>
}

// 用例接口
export interface OptimizationCase {
  messages: OptimizationMessage[]
}

// 优化信息接口
export interface OptimizeInfo {
  cases: OptimizationCase[]
  num_iter: number
  early_stop_score: number
  example_num: number
  placeholder?: string[]
  llm_parallel: number
  user_compare_options: string
  user_compare_rules: string
  external_knowledge: string
}

// 模型信息接口
export interface ModelInfo {
  id: number
  model: string
  model_from: string
  headers: Record<string, any>
}

// 创建优化任务请求接口
export interface CreateOptimizationJobRequest {
  name: string
  desc: string
  rawTemplates: string
  optimizeInfo: OptimizeInfo
  modelInfo: ModelInfo
  assistantInfo: ModelInfo
  agentTools: any[]
}

// 保存草稿请求接口
export interface SaveJobDraftRequest {
  name?: string
  desc?: string
  rawTemplates?: string
  optimizeInfo?: Partial<OptimizeInfo>
  modelInfo?: Partial<ModelInfo>
  assistantInfo?: Partial<ModelInfo>
  agentTools?: any[]
}

// 任务信息接口
export interface JobInfo {
  id: string
  name: string
  desc: string
  num_iter: number
  created_at: string
  optimized_model: string
  assistant_model: string
  job_type: 'formal' | 'draft' // 任务类型：formal-正式任务，draft-草稿
}

// 创建优化任务响应接口
export interface CreateOptimizationJobResponse {
  code: number
  msg: string
  jobInfo?: JobInfo
}

// 保存草稿响应接口
export interface SaveJobDraftResponse {
  code: number
  msg: string
  draft_id?: number
}

// 草稿内容接口
export interface JobDraftContent {
  name: string
  desc: string
  rawTemplates: string
  optimizeInfo: OptimizeInfo
  modelInfo: ModelInfo
  assistantInfo: ModelInfo
  agentTools?: any[] // 工具信息，在content内部
}

// 查询草稿详情响应接口
export interface GetJobDraftResponse {
  code: number
  msg: string
  draft_id: number
  user_id: string
  space_id: string
  created_at: string
  content: JobDraftContent
}

// 任务详情接口
export interface JobDetail {
  error_msg: string
  job_info: {
    assistant_model: string
    created_at: string
    desc: string
    id: string
    name: string
    num_iter: number
    optimized_model: string
  }
  progress_rate: number
  status: 'running' | 'finished' | 'failed' | 'deleted' | 'stopped' | 'stopping' | 'queued'
  time_cost: number
}

// 查询任务列表请求接口
export interface GetJobListRequest {
  id_list: string[]
}

// 查询任务列表响应接口
export interface GetJobListResponse {
  code: number
  msg: string
  job_details: {
    data: JobDetail[]
    failed_jobs: number
    finished_jobs: number
    running_jobs: number
    stopped_jobs: number
    total_jobs: number
  }
}

// 删除任务响应接口
export interface DeleteJobResponse {
  code: number
  msg: string
}

// 用例检查请求接口
export interface CaseCheckRequest {
  cases: OptimizationCase[]
}

// 用例检查响应接口
export interface CaseCheckResponse {
  code: number
  msg: string
  error_index: number
}

// 优化历史记录接口
export interface OptimizationHistory {
  evaluations: any
  examples: string[]
  filled_prompt: string
  iteration_round: number
  optimized_placeholder: Record<string, any>
  optimized_prompt: string
  original_placeholder: Record<string, any>
  success_rate: number
}

// 优化进度接口
export interface OptimizationProgress {
  best_iteration: number
  best_placeholder: Record<string, any>
  best_prompt: string
  error_msg: string
  evaluation_method: string
  examples: string[]
  filled_prompt: string
  job_info: {
    assistant_model: string
    created_at: string
    desc: string
    id: string
    name: string
    num_iter: number
    optimized_model: string
    optimized_model_id: string
    assistant_model_id: string
  }
  original_placeholder: Record<string, any>
  original_prompt: string
  progress_rate: number
  status: string
  success_rate: number
  time_cost: number
}

// 优化信息详情接口
export interface OptimizeInfoDetail {
  num_iter: number
  early_stop_score: number | null
  cases: OptimizationCase[]
  example_num: number
  placeholder: any[]
  llm_parallel: number
  user_compare_rules: string
  user_compare_options: string
  external_knowledge: string
  tools: any[]
}

// 查询任务详情响应接口
export interface GetJobDetailResponse {
  code: number
  msg: string
  message: string
  history: OptimizationHistory[]
  progress: OptimizationProgress
  optimizeInfo: OptimizeInfoDetail
}

// API响应包装器
export interface SelfOptApiResponse<T> {
  code: number
  msg: string
  data?: T
}

// 错误响应
export interface SelfOptApiError {
  code: number
  msg: string
  error?: string
  details?: Record<string, any>
}

// 用例历史记录 - 用例输入
export interface CaseInputs {
  [key: string]: any
}

// 用例历史记录 - 用例标签
export interface CaseLabel {
  output: string
}

// 用例历史记录 - 用例详情
export interface CaseDetail {
  inputs: CaseInputs
  label: CaseLabel
  tools: any[] | null
  case_id: string
}

// 用例历史记录 - 模型回答
export interface CaseAnswer {
  output: string
  tool_calls: any[]
}

// 用例历史记录 - 评测用例
export interface EvaluateCase {
  case: CaseDetail
  answer: CaseAnswer
  score: number
  reason: string
}

// 用例历史记录 - 历史记录项
export interface JobHistoryItem {
  iteration_round: number
  optimized_prompt: string
  success_rate: number
  evaluate_cases: EvaluateCase[]
}

// 查询用例历史记录响应接口
export interface GetJobHistoryResponse {
  code: number
  msg: string
  history: JobHistoryItem[]
}