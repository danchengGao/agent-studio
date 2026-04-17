import { apiUtils } from '../client'
import { getApiClient } from '../utils/apiClientFactory'
import type {
  VLMModelApiError,
  VLMModelConfigCreate,
  VLMModelConfigList,
  VLMModelConfigQueryParams,
  VLMModelConfigResponse,
  VLMModelTestRequest,
  VLMModelTestResponse,
  VLMModelConfigUpdate,
} from '../types/vlmModelTypes'

export interface FrontendVLMModelConfig {
  id: string
  name: string
  provider: string
  modelId: string
  apiKey: string
  baseUrl: string
  description: string
  tags: string[]
  timeout: number
  retryCount: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

function backendToFrontend(backend: VLMModelConfigResponse): FrontendVLMModelConfig {
  return {
    id: backend.id.toString(),
    name: backend.name,
    provider: backend.provider,
    modelId: backend.model_id,
    apiKey: backend.api_key_masked || '',
    baseUrl: backend.base_url,
    description: backend.description || '',
    tags: backend.tags || [],
    timeout: backend.timeout,
    retryCount: backend.retry_count,
    isActive: backend.is_active,
    createdAt: backend.created_at,
    updatedAt: backend.updated_at,
  }
}

function frontendToBackendCreate(frontend: Partial<FrontendVLMModelConfig>, spaceId: string): VLMModelConfigCreate {
  return {
    name: frontend.name || '',
    provider: (frontend.provider || 'openai') as VLMModelConfigCreate['provider'],
    space_id: spaceId,
    model_id: frontend.modelId || '',
    api_key: frontend.apiKey || '',
    base_url: frontend.baseUrl || '',
    description: frontend.description || '',
    tags: frontend.tags || [],
    timeout: frontend.timeout ?? 60,
    retry_count: frontend.retryCount ?? 3,
    is_active: frontend.isActive ?? true,
  }
}

function frontendToBackendUpdate(frontend: Partial<FrontendVLMModelConfig>): VLMModelConfigUpdate {
  const update: VLMModelConfigUpdate = {}

  if (frontend.name !== undefined) update.name = frontend.name
  if (frontend.provider !== undefined) update.provider = frontend.provider as VLMModelConfigUpdate['provider']
  if (frontend.modelId !== undefined) update.model_id = frontend.modelId
  if (frontend.apiKey !== undefined && frontend.apiKey !== '') {
    const isMaskedKey = frontend.apiKey.includes('*')
    if (!isMaskedKey) {
      update.api_key = frontend.apiKey
    }
  }
  if (frontend.baseUrl !== undefined) update.base_url = frontend.baseUrl
  if (frontend.description !== undefined) update.description = frontend.description
  if (frontend.tags !== undefined) update.tags = frontend.tags
  if (frontend.timeout !== undefined) update.timeout = frontend.timeout
  if (frontend.retryCount !== undefined) update.retry_count = frontend.retryCount
  if (frontend.isActive !== undefined) update.is_active = frontend.isActive

  return update
}

export class VLMModelService {
  private readonly basePath = '/vlm-models/'

  async getVLMModelConfigs(
    spaceId: string,
    params?: VLMModelConfigQueryParams,
  ): Promise<{ items: FrontendVLMModelConfig[]; total: number; page: number; size: number }> {
    try {
      if (!spaceId) {
        throw new Error('spaceId is required to fetch VLM models')
      }

      const queryString = params && Object.keys(params).length > 0 ? `?${apiUtils.buildQueryString(params)}` : ''
      const apiClient = getApiClient()
      const response = await apiClient.get<{ code: number; message: string; data: VLMModelConfigList }>(`${this.basePath}${spaceId}${queryString}`)

      return {
        items: response.data.data.items.map(backendToFrontend),
        total: response.data.data.total,
        page: response.data.data.page,
        size: response.data.data.size,
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async getVLMModelConfig(configId: string, spaceId: string): Promise<FrontendVLMModelConfig> {
    try {
      const apiClient = getApiClient()
      const requestParams = { config_id: parseInt(configId, 10), space_id: spaceId }
      const response = await apiClient.get<{ code: number; message: string; data: VLMModelConfigResponse }>(this.basePath, { params: requestParams })
      return backendToFrontend(response.data.data)
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async createVLMModelConfig(model: Partial<FrontendVLMModelConfig>, spaceId: string): Promise<FrontendVLMModelConfig> {
    try {
      const payload = frontendToBackendCreate(model, spaceId)
      const apiClient = getApiClient()
      const response = await apiClient.post<{ code: number; message: string; data: VLMModelConfigResponse }>(this.basePath, payload)
      return backendToFrontend(response.data.data)
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async updateVLMModelConfig(configId: string, model: Partial<FrontendVLMModelConfig>, spaceId: string): Promise<FrontendVLMModelConfig> {
    try {
      const payload = {
        config_id: parseInt(configId, 10),
        space_id: spaceId,
        ...frontendToBackendUpdate(model),
      }
      const apiClient = getApiClient()
      const response = await apiClient.post<{ code: number; message: string; data: VLMModelConfigResponse }>(`${this.basePath}update`, payload)
      return backendToFrontend(response.data.data)
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async deleteVLMModelConfig(configId: string, spaceId: string): Promise<void> {
    try {
      const apiClient = getApiClient()
      const requestBody = { config_id: parseInt(configId, 10), space_id: spaceId }
      await apiClient.delete(this.basePath, { data: requestBody })
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async toggleVLMModelStatus(configId: string, spaceId: string): Promise<FrontendVLMModelConfig> {
    try {
      const apiClient = getApiClient()
      const requestBody = { config_id: parseInt(configId, 10), space_id: spaceId }
      const response = await apiClient.post<{ code: number; message: string; data: VLMModelConfigResponse }>(`${this.basePath}toggle`, requestBody)
      return backendToFrontend(response.data.data)
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async testVLMModel(
    configId: string,
    prompt: string,
    spaceId: string,
    parameters?: { temperature?: number; top_p?: number; max_tokens?: number },
    imageBase64?: string,
    mimeType?: string,
  ): Promise<VLMModelTestResponse> {
    try {
      const apiClient = getApiClient()
      const testRequest: VLMModelTestRequest = {
        prompt,
        image_base64: imageBase64,
        mime_type: mimeType,
        parameters: parameters
          ? {
              temperature: parameters.temperature ?? 0.7,
              top_p: parameters.top_p ?? 0.9,
              max_tokens: parameters.max_tokens ?? 4096,
            }
          : undefined,
      }
      const response = await apiClient.post<{ code: number; message: string; data: VLMModelTestResponse }>(
        `${this.basePath}${configId}/test?space_id=${encodeURIComponent(spaceId)}`,
        testRequest,
      )
      return response.data.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  private handleError(error: unknown): VLMModelApiError {
    const apiError = error as { response?: { data?: VLMModelApiError }; message?: string; toString(): string }
    if (apiError.response?.data) {
      return apiError.response.data
    }

    return {
      code: 500,
      message: apiError.message || 'Unknown error occurred',
      error: apiError.toString(),
    }
  }
}

export const vlmModelService = new VLMModelService()
