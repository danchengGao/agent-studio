/**
 * DeepSearch API 服务层
 * 封装所有 DeepSearch 相关的 API 调用
 */

import { getAuthToken } from '@/utils/authUtils'
import { getDefaultSpaceId } from '@/utils/spaceUtils'

/** API 错误类型 */
export interface DeepSearchApiError {
  response?: { status: number }
  code?: string
  message?: string
}

/**
 * DeepSearch API 服务类
 */
export class DeepSearchApiService {
  /**
   * 取消 DeepSearch 对话请求
   *
   * @param conversationId - 对话 ID
   * @param signal - 可选的 AbortController signal，用于超时控制
   * @returns Promise<void>
   *
   * @example
   * ```ts
   * const abortController = new AbortController()
   * await DeepSearchApiService.cancelConversation('conv-123', abortController.signal)
   * ```
   */
  static async cancelConversation(
    conversationId: string,
    signal?: AbortSignal
  ): Promise<void> {
    // 获取认证 token
    const token = getAuthToken()
    if (!token) {
      console.error('[DeepSearchApi] 无法获取认证 token')
      return
    }

    // 获取 spaceId
    const spaceId = getDefaultSpaceId()
    if (!spaceId) {
      console.error('[DeepSearchApi] 无法获取 spaceId')
      return
    }

    try {
      console.log('[DeepSearchApi] 发送取消请求, conversation_id:', conversationId)

      const response = await fetch('/api/v1/agent/deepsearch/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          space_id: spaceId,
          conversation_id: conversationId,
          message: '',  // 必填字段，取消请求时为空字符串
          interrupt_feedback: 'cancel',  // DeepSearch 服务根据这个字段识别取消请求
          general_model_config_id: -1,  // 必填字段，但在取消请求中不使用
        }),
        signal,
      })

      if (!response.ok) {
        console.error('[DeepSearchApi] 取消请求失败, status:', response.status)
        const errorText = await response.text()
        console.error('[DeepSearchApi] 错误详情:', errorText)
      } else {
        const data = await response.json()
        console.log('[DeepSearchApi] 取消请求成功:', data)
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[DeepSearchApi] 取消请求被中止')
      } else {
        console.error('[DeepSearchApi] 取消请求错误:', error)
      }
    }
  }

}

