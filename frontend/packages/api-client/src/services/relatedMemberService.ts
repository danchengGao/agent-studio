import { getApiClient } from '../utils/apiClientFactory'
import { API_ENDPOINTS } from '../config'
import { ApiResponse } from '../types'

// MemberType 枚举定义
export enum MemberType {
  AGENT = 'AGENT',
  WORKFLOW = 'WORKFLOW',
  PROMPT = 'PROMPT',
}

// RelatedMemberInfo 接口定义
export interface RelatedMemberInfo {
  id: string
  version: string
  name: string
  type: MemberType
  only_active?: boolean // @deprecated 已废弃，请使用 getPromptRelations 的第三个参数
}

// 响应模型定义
export interface RegisterRelationResponse {
  code: number
  message: string
  data?: any
}

export interface GetRelationsResponse {
  code: number
  message: string
  data?: Array<{
    id: string
    version: string
    name: string
    prompt_id: string
    prompt_version: string
    prompt_name: string
    type: string
    create_time: number
    update_time: number
  }>
}

// RelatedMemberService 类
export class RelatedMemberService {
  /**
   * 注册 prompt 与其他成员（agent 或 workflow）的关联关系
   * @param spaceId 空间 ID
   * @param promptInfo prompt 信息
   * @param relatedMemberInfo 关联成员信息
   * @returns 注册结果
   */
  static async registerPromptRelation(
    spaceId: string,
    promptInfo: RelatedMemberInfo,
    relatedMemberInfo: RelatedMemberInfo,
  ): Promise<ApiResponse<RegisterRelationResponse>> {
    const apiClient = getApiClient()
    const url = API_ENDPOINTS.RELATED.PROMPT_REGISTER.replace(':spaceId', spaceId)
    const response = await apiClient.post<ApiResponse<RegisterRelationResponse>>(url, {
      prompt_info: promptInfo,
      related_member_info: relatedMemberInfo,
    })
    return response.data
  }

  /**
   * 获取指定成员的关联关系
   * @param spaceId 空间 ID
   * @param keyMemberInfo 查询的成员信息
   * @param onlyActivate 是否只获取活跃的关联关系，传递到URL查询参数中
   * @returns 关联关系列表
   */
  static async getPromptRelations(spaceId: string, keyMemberInfo: RelatedMemberInfo, onlyActivate?: boolean): Promise<ApiResponse<GetRelationsResponse>> {
    const apiClient = getApiClient()
    let url = API_ENDPOINTS.RELATED.PROMPT_LIST.replace(':spaceId', spaceId)

    // 如果指定了onlyActivate参数，添加到URL查询参数中
    if (onlyActivate !== undefined) {
      url += `?only_activate=${onlyActivate}`
    }

    // 从请求体中移除 only_active 字段
    const { only_active, ...requestBody } = keyMemberInfo

    const response = await apiClient.post<ApiResponse<GetRelationsResponse>>(url, requestBody)
    return response.data
  }

  /**
   * 删除指定成员的关联关系
   * @param spaceId 空间 ID
   * @param keyMemberInfo 要删除的成员关联信息
   * @returns 删除结果
   */
  static async deletePromptRelation(spaceId: string, keyMemberInfo: RelatedMemberInfo): Promise<ApiResponse<RegisterRelationResponse>> {
    const apiClient = getApiClient()
    const url = API_ENDPOINTS.RELATED.PROMPT_DELETE.replace(':spaceId', spaceId)
    const response = await apiClient.delete<ApiResponse<RegisterRelationResponse>>(url, {
      data: keyMemberInfo,
    })
    return response.data
  }
}

// 导出服务
// 同时保持原有单例导出以兼容现有代码
const serviceInstance = new RelatedMemberService()
export const relatedMemberService = serviceInstance
export default RelatedMemberService
