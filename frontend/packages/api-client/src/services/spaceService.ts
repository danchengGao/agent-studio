import { getApiClient } from '../utils/apiClientFactory'
import { API_ENDPOINTS } from '../config'
import { ApiResponse } from '../types'

// Space类型定义
export interface Space {
  space_id: string
  spacename: string
  description: string
  avatar_url?: string
  role_type: number
  user_id_str: string
  creator_id_str: string
  space_create_time: number
  space_update_time: number
  app_ids?: string
  space_type?: number
  connectors?: string
  hide_operation?: boolean
  display_local_plugin?: boolean
}

export interface SpaceResponse {
  space_list: Space[]
  has_personal_space: boolean
  team_space_num: number
  recently_used_space_list: Space[]
  space_total_num: number
  has_more: boolean
}

// 空间服务
export class SpaceService {
  // 获取用户空间列表
  static async getUserSpaces(): Promise<ApiResponse<SpaceResponse>> {
    const apiClient = getApiClient()
    const response = await apiClient.get<ApiResponse<SpaceResponse>>(API_ENDPOINTS.SPACE.LIST)
    return response.data
  }

  // 获取指定空间详情
  static async getSpaceById(spaceId: string): Promise<ApiResponse<Space>> {
    const apiClient = getApiClient()
    const url = API_ENDPOINTS.SPACE.DETAIL.replace(':id', spaceId)
    const response = await apiClient.get<ApiResponse<Space>>(url)
    return response.data
  }

  // 创建空间
  static async createSpace(spaceData: Partial<Space>): Promise<ApiResponse<Space>> {
    const apiClient = getApiClient()
    const response = await apiClient.post<ApiResponse<Space>>(API_ENDPOINTS.SPACE.CREATE, spaceData)
    return response.data
  }

  // 更新空间
  static async updateSpace(spaceId: string, spaceData: Partial<Space>): Promise<ApiResponse<Space>> {
    const apiClient = getApiClient()
    const url = API_ENDPOINTS.SPACE.UPDATE.replace(':id', spaceId)
    const response = await apiClient.put<ApiResponse<Space>>(url, spaceData)
    return response.data
  }

  // 删除空间
  static async deleteSpace(spaceId: string): Promise<ApiResponse<null>> {
    const apiClient = getApiClient()
    const url = API_ENDPOINTS.SPACE.DELETE.replace(':id', spaceId)
    const response = await apiClient.delete<ApiResponse<null>>(url)
    return response.data
  }

  // 获取当前用户的空间列表
  static async getUserSpecificSpaces(): Promise<ApiResponse<Space[]>> {
    const apiClient = getApiClient()
    const response = await apiClient.get<ApiResponse<Space[]>>(API_ENDPOINTS.SPACE.USER_SPACES)
    return response.data
  }
}

// 导出空间服务实例
export default SpaceService
