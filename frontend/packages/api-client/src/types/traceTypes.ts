// Trace API 相关类型定义

// 排序字段定义
export interface OrderBy {
  field: string
  is_asc: boolean
}

// Trace 列表查询请求参数
export interface TraceListRequest {
  workspace_id: string
  start_time: string
  end_time: string
  page_size?: number
  platform_type: 'all' | 'prompt' | 'workflow' | 'bot' | 'project' | 'sdk'
  span_list_type: 'root_span' | 'all_span' | 'llm_span'
  page_token?: string | null
  order_bys?: OrderBy[]
}

// Trace 数据项
export interface TraceSpan {
  span_id: string
  trace_id: string
  service_name: string
  span_name: string
  span_type: string
  platform_type?: string
  status: 'success' | 'failed' | 'pending'
  status_code: number
  started_at: string
  duration: string
  input?: string
  output?: string
  logid: string
  parent_id: string
  custom_tags: {
    enterprise_id?: string
    model_id?: string
    stream?: string
    call_options?: string
    input_tokens?: string
    model_name?: string
    output_tokens?: string
    user_id?: string
    latency_first_resp?: string
    model_identification?: string
    reasoning_duration?: string
    tenant?: string
    model_provider?: string
    tokens?: string
    prompt_key?: string
    workflow_name?: string
    bot_name?: string
    // 添加更多可能的字段
    execute_mode?: string
    fornax_space_id?: string
    request_env?: string
    app_id?: string
    connector_uid?: string
    span_name?: string
    version?: string
    workflow_id?: string
    workflow_type?: string
    connector_id?: string
    data_prepare_finish_time?: string
    in_project_create?: string
    run_mode?: string
    space_id?: string
    workflow_method?: string
    workflow_version?: string
    _sr?: string
    bot_space_id?: string
    execute_id?: string
    flow_mode?: string
    downstream_req_send_time?: string
    req_reply_final_time?: string
    req_reply_first_time?: string
    review_query_start_time?: string
    called_by?: string
    start_time_first_resp?: string
    end_time_final_resp?: string
    bot_env?: string
    conversation_id?: string
    latency_first_token_resp?: string
    dialog_scene?: string
    query_type?: string
    req_recv_time?: string
    start_time_first_token_resp?: string
    bot_version?: string
    review_query_end_time?: string
    traffic?: string
    bot_id?: string
    query_input_method?: string
    section_id?: string
    latency_first_resp?: string
    chat_type?: string
    message_id?: string
    chat_mode?: string
    // 允许其他任意字段
    [key: string]: string | undefined
  }
  system_tags: {
    clip_fields?: string
    create_time?: string
    runtime?: string
    tenant?: string
  }
  logic_delete_date: string
}

// Trace 列表响应
export interface TraceListResponse {
  spans: TraceSpan[]
  code: number
  msg: string
  next_page_token: string | null
  has_more: boolean
}

// 页面筛选参数
export interface TraceFilterParams {
  timeRange: string
  customTimeStart?: string
  customTimeEnd?: string
  spanType: 'Root Span' | 'All Span' | 'Model Span'
  dataSource: 'ALL' | '提示词开发' | '工作流' | '智能体' | '应用' | 'SDK上报'
  searchTerm?: string
}

// 转换后的Trace记录（用于页面显示）
export interface TraceRecord {
  traceId: string
  input: string
  output: string
  tokens: number | string
  latency: number
  latencyFirstResp: number
  startTime: string
  feedback?: 'good' | 'bad' | null
  inputTokens: number | string
  outputTokens: number | string
  spanId: string
  spanType: string
  spanName: string
  promptKey: string
  workflow?: string
  agent?: string
  app: string
  expirationTime: string
  status: 'success' | 'failed' | 'pending'
}

// 时间范围选项
export type TimeRangeOption = '过去1小时' | '过去3小时' | '过去1天' | '过去3天' | '过去7天' | '自定义'

// Span类型选项
export type SpanTypeOption = 'Root Span' | 'All Span' | 'Model Span'

// 数据来源选项
export type DataSourceOption = 'ALL' | '提示词开发' | '工作流' | '智能体' | '应用' | 'SDK上报'

// API错误响应
export interface TraceApiError {
  code: number
  msg: string
  error?: string
}

// 调用树查询请求参数
export interface TraceTreeRequest {
  workspace_id: string
  debug_id?: string
  trace_id?: string
  start_time?: string
  end_time?: string
}

// 调用树Span数据（比TraceSpan更详细）
export interface TraceTreeSpan {
  parent_id: string
  span_id: string
  trace_id: string
  service_name: string
  span_name: string
  span_type: string
  status: 'success' | 'failed' | 'pending'
  status_code: number
  started_at: string
  duration: string
  input: string
  output: string
  logid: string
  custom_tags: {
    stream?: string
    user_id?: string
    enterprise_id?: string
    output_tokens?: string
    prompt_key?: string
    prompt_version?: string
    input_tokens?: string
    tenant?: string
    tokens?: string
    [key: string]: string | undefined
  }
  system_tags: {
    clip_fields?: string
    create_time?: string
    runtime?: string
    tenant?: string
    [key: string]: string | undefined
  }
  logic_delete_date: string
}

// Trace汇总信息
export interface TraceAdvanceInfo {
  trace_id: string
  tokens: {
    input: string
    output: string
  }
}

// 调用树响应
export interface TraceTreeResponse {
  code: number
  msg: string
  spans: TraceTreeSpan[]
  traces_advance_info: TraceAdvanceInfo
}

// 调用树节点（用于UI展示）
export interface TraceTreeNode {
  span: TraceTreeSpan
  children: TraceTreeNode[]
  level: number
}

