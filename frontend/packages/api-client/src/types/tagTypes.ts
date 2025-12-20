// Tag相关的类型定义

export interface Tag {
  primary_id: number
  space_id: string
  tag_name: string
  tag_color?: string
  is_active: boolean
  usage_count: number
  create_user?: string
  update_user?: string
  create_time?: number
  update_time?: number
}

export interface TagCreate {
  space_id: string
  tag_name: string
  tag_color?: string
  is_active?: boolean
  create_user?: string
}

export interface TagUpdate {
  tag_name?: string
  tag_color?: string
  is_active?: boolean
  update_user?: string
}

export interface TagResponse {
  tag: Tag
}

export interface TagListResponse {
  tags: Tag[]
  total: number
  page: number
  page_size: number
}

export interface TagGetOrCreateResponse {
  tag: Tag
  created: boolean
}

export interface TagBatchCreateResponse {
  created_tags: Tag[]
  failed_tags: Array<{
    tag: TagCreate
    error: string
  }>
  total_created: number
  total_failed: number
}

// 请求类型
export interface TagCreateRequest {
  tag: TagCreate
}

export interface TagUpdateRequest {
  tag_data: TagUpdate
  query: {
    primary_id: number
  }
}

export interface TagGetOrCreateRequest {
  space_id: string
  tag_name: string
  tag_color?: string
  is_active?: boolean
  create_user?: string
}

export interface TagBatchCreateRequest {
  tags: TagCreate[]
}

export interface TagSearchRequest {
  space_id: string
  search_pattern: string
  is_active?: boolean
  page?: number
  page_size?: number
}

export interface TagListRequest {
  space_id: string
  tag_name?: string
  is_active?: boolean
  page?: number
  page_size?: number
}

// API响应类型
export interface TagApiResponse<T = any> {
  code: number
  message: string
  data?: T
}

export interface TagApiError {
  code: number
  message: string
  details?: any
}

// 查询参数类型
export interface TagQueryParams {
  space_id: string
  tag_name?: string
  is_active?: boolean
  page?: number
  page_size?: number
}

export interface TagSearchQueryParams {
  space_id: string
  search_pattern: string
  is_active?: boolean
  page?: number
  page_size?: number
}

// 工作流标签关联类型
export interface WorkflowTagRelation {
  workflow_id: string
  workflow_version?: string
  space_id: string
  tag_id: number
}

export interface WorkflowTagRequest {
  workflow_id: string
  workflow_version?: string
  space_id: string
  tag_ids: number[]
}

export interface WorkflowTagResponse {
  workflow_id: string
  workflow_version?: string
  space_id: string
  tags: Tag[]
}

// 工作流创建/更新时包含Tag的请求类型
export interface CreateWorkflowWithTagsRequest {
  name: string
  desc: string
  space_id: string
  workflow_version?: string
  tag_ids?: number[]
  tags?: string[] // 也可以直接传tag名称，自动创建
}

export interface UpdateWorkflowWithTagsRequest {
  workflow_id: string
  space_id: string
  name?: string
  desc?: string
  workflow_version?: string
  tag_ids?: number[]
  tags?: string[] // 新增的tag名称
}
