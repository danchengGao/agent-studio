import { getApiClient } from '../utils/apiClientFactory'
import { API_ENDPOINTS } from '../config'
import type {
  Tag,
  TagCreate,
  TagUpdate,
  TagResponse,
  TagListResponse,
  TagGetOrCreateResponse,
  TagBatchCreateResponse,
  TagCreateRequest,
  TagUpdateRequest,
  TagGetOrCreateRequest,
  TagBatchCreateRequest,
  TagSearchRequest,
  TagListRequest,
  TagApiResponse,
  TagApiError,
} from '../types/tagTypes'

export class TagService {
  // 创建Tag
  static async createTag(request: TagCreateRequest): Promise<TagApiResponse<TagResponse>> {
    const apiClient = getApiClient()
    const response = await apiClient.post<TagApiResponse<TagResponse>>(API_ENDPOINTS.TAGS.CREATE, request)
    return response.data
  }

  // 获取Tag列表
  static async getTags(request: TagListRequest): Promise<TagApiResponse<TagListResponse>> {
    const apiClient = getApiClient()
    const response = await apiClient.get<TagApiResponse<TagListResponse>>(API_ENDPOINTS.TAGS.LIST, {
      params: {
        space_id: request.space_id,
        tag_name: request.tag_name,
        is_active: request.is_active,
        page: request.page || 1,
        page_size: request.page_size || 100,
      },
    })
    return response.data
  }

  // 搜索Tag
  static async searchTags(request: TagSearchRequest): Promise<TagApiResponse<TagListResponse>> {
    const apiClient = getApiClient()
    const response = await apiClient.get<TagApiResponse<TagListResponse>>(API_ENDPOINTS.TAGS.SEARCH, {
      params: {
        space_id: request.space_id,
        pattern: request.search_pattern,
        is_active: request.is_active,
        page: request.page || 1,
        page_size: request.page_size || 100,
      },
    })
    return response.data
  }

  // 根据ID获取Tag
  static async getTagById(tagId: number): Promise<TagApiResponse<TagResponse>> {
    const apiClient = getApiClient()
    const url = API_ENDPOINTS.TAGS.GET_BY_ID.replace(':id', tagId.toString())
    const response = await apiClient.get<TagApiResponse<TagResponse>>(url)
    return response.data
  }

  // 根据space_id和tag_name获取Tag
  static async getTag(spaceId: string, tagName: string): Promise<TagApiResponse<TagResponse>> {
    const apiClient = getApiClient()
    const response = await apiClient.get<TagApiResponse<TagResponse>>(API_ENDPOINTS.TAGS.GET, {
      params: {
        space_id: spaceId,
        tag_name: tagName,
      },
    })
    return response.data
  }

  // 更新Tag
  static async updateTag(tagId: number, request: TagUpdateRequest): Promise<TagApiResponse<TagResponse>> {
    const apiClient = getApiClient()
    const url = API_ENDPOINTS.TAGS.UPDATE.replace(':id', tagId.toString())
    const response = await apiClient.put<TagApiResponse<TagResponse>>(url, request)
    return response.data
  }

  // 删除Tag
  static async deleteTag(spaceId: string, tagName: string): Promise<TagApiResponse<null>> {
    const apiClient = getApiClient()
    const response = await apiClient.delete<TagApiResponse<null>>(API_ENDPOINTS.TAGS.DELETE, {
      params: {
        space_id: spaceId,
        tag_name: tagName,
      },
    })
    return response.data
  }

  // 获取或创建Tag
  static async getOrCreateTag(request: TagGetOrCreateRequest): Promise<TagApiResponse<TagGetOrCreateResponse>> {
    const apiClient = getApiClient()
    const response = await apiClient.post<TagApiResponse<TagGetOrCreateResponse>>(API_ENDPOINTS.TAGS.GET_OR_CREATE, request)
    return response.data
  }

  // 批量创建Tag
  static async batchCreateTags(request: TagBatchCreateRequest): Promise<TagApiResponse<TagBatchCreateResponse>> {
    const apiClient = getApiClient()
    const response = await apiClient.post<TagApiResponse<TagBatchCreateResponse>>(API_ENDPOINTS.TAGS.BATCH_CREATE, request)
    return response.data
  }
}

// 导出工作流服务实例
export default TagService
