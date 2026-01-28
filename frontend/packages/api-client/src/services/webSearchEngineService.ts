/**
 * WebSearch Engine Service
 * 搜索引擎配置服务
 */

import { getApiClient } from '../utils/apiClientFactory'

// ==================== 类型定义 ====================

/**
 * 搜索引擎配置
 */
export interface WebSearchEngineConfig {
  web_search_engine_id: number
  search_engine_name: string
  search_url: string
  create_time: string
  update_time: string
}

/**
 * 搜索引擎列表响应
 */
export interface WebSearchEngineListResponse {
  code: number
  msg: string
  data: WebSearchEngineConfig[]
}

/**
 * 搜索引擎创建请求
 */
export interface WebSearchEngineCreateRequest {
  space_id: string
  search_engine_name: string
  search_api_key: string
  search_url: string
}

/**
 * 搜索引擎创建响应
 */
export interface WebSearchEngineCreateResponse {
  code: number
  msg: string
  web_search_engine_id?: number
}

/**
 * 搜索引擎删除响应
 */
export interface WebSearchEngineDeleteResponse {
  code: number
  msg: string
}

/**
 * 搜索引擎更新请求
 */
export interface WebSearchEngineUpdateRequest {
  space_id: string
  web_search_engine_id: number
  search_engine_name: string
  search_api_key: string
  search_url: string
}

/**
 * 搜索引擎更新响应
 */
export interface WebSearchEngineUpdateResponse {
  code: number
  msg: string
  web_search_engine_id?: number
}

/**
 * 搜索引擎详情响应
 */
export interface WebSearchEngineDetailResponse {
  code: number
  msg: string
  data: {
    web_search_engine_id: number
    search_engine_name: string
    search_url: string
    search_api_key: string
    create_time: string
    update_time: string
  }
}

// ==================== 搜索引擎服务 ====================

/**
 * 搜索引擎配置服务
 */
export const webSearchEngineService = {
  /**
   * 获取搜索引擎列表
   * @param spaceId - 用户空间ID
   * @returns 搜索引擎列表
   */
  async listEngines(spaceId: string): Promise<WebSearchEngineConfig[]> {
    const client = getApiClient()
    const response = await client.get<WebSearchEngineListResponse>(
      `/agent/deepsearch/web_search/${spaceId}`
    )
    return response.data.data
  },

  /**
   * 创建搜索引擎配置
   * @param spaceId - 用户空间ID
   * @param engineName - 搜索引擎名称
   * @param apiKey - API密钥
   * @param url - 搜索引擎URL
   * @returns 新创建的搜索引擎ID
   */
  async createEngine(
    spaceId: string,
    engineName: string,
    apiKey: string,
    url: string
  ): Promise<number> {
    const client = getApiClient()

    const request: WebSearchEngineCreateRequest = {
      space_id: spaceId,
      search_engine_name: engineName,
      search_api_key: apiKey,
      search_url: url
    }

    const response = await client.post<WebSearchEngineCreateResponse>(
      '/agent/deepsearch/web_search/',
      request
    )

    if (response.data.web_search_engine_id === undefined) {
      throw new Error(response.data.msg || '创建搜索引擎失败')
    }

    return response.data.web_search_engine_id
  },

  /**
   * 删除搜索引擎
   * @param spaceId - 用户空间ID
   * @param engineId - 搜索引擎ID
   */
  async deleteEngine(spaceId: string, engineId: number): Promise<void> {
    const client = getApiClient()
    await client.delete<WebSearchEngineDeleteResponse>(
      `/agent/deepsearch/web_search/${spaceId}/${engineId}`
    )
  },

  /**
   * 获取单个搜索引擎详情
   * @param spaceId - 用户空间ID
   * @param engineId - 搜索引擎ID
   * @returns 搜索引擎详情
   */
  async getEngine(spaceId: string, engineId: number): Promise<{
    search_engine_name: string
    search_url: string
    search_api_key: string
  }> {
    const client = getApiClient()
    const response = await client.get<WebSearchEngineDetailResponse>(
      `/agent/deepsearch/web_search/${spaceId}/${engineId}`
    )
    // 后端返回的数据结构：{code, msg, search_engine_name, search_url}
    // 字段直接在 response.data 中，不在 response.data.data 中
    const data = response.data as any
    return {
      search_engine_name: data.search_engine_name || data.data?.search_engine_name || '',
      search_url: data.search_url || data.data?.search_url || '',
      search_api_key: data.search_api_key || data.data?.search_api_key || ''
    }
  },

  /**
   * 更新搜索引擎配置
   * @param spaceId - 用户空间ID
   * @param engineId - 搜索引擎ID
   * @param engineName - 搜索引擎名称
   * @param apiKey - API密钥
   * @param url - 搜索引擎URL
   */
  async updateEngine(
    spaceId: string,
    engineId: number,
    engineName: string,
    apiKey: string,
    url: string
  ): Promise<void> {
    const client = getApiClient()

    const request: WebSearchEngineUpdateRequest = {
      space_id: spaceId,
      web_search_engine_id: engineId,
      search_engine_name: engineName,
      search_api_key: apiKey,
      search_url: url
    }

    await client.put<WebSearchEngineUpdateResponse>(
      '/agent/deepsearch/web_search/',
      request
    )
  }
}
