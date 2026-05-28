import { getApiClient } from '../utils/apiClientFactory'
import { API_ENDPOINTS } from '../config'

const BASE = '/triggers'

// Generic API response shape
export interface TriggerApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

// ── Service ──────────────────────────────────────────────────────────────────

export class TriggerService {
  static async createTrigger(req: Record<string, unknown>): Promise<TriggerApiResponse> {
    const apiClient = getApiClient()
    const response = await apiClient.post<TriggerApiResponse>(API_ENDPOINTS.TRIGGERS.CREATE, req)
    return response.data
  }

  static async listTriggers(req: Record<string, unknown>): Promise<TriggerApiResponse> {
    const apiClient = getApiClient()
    const response = await apiClient.post<TriggerApiResponse>(API_ENDPOINTS.TRIGGERS.LIST, req)
    return response.data
  }

  static async getTrigger(req: { space_id: string; trigger_id: string }): Promise<TriggerApiResponse> {
    const apiClient = getApiClient()
    const response = await apiClient.post<TriggerApiResponse>(API_ENDPOINTS.TRIGGERS.GET, req)
    return response.data
  }

  static async updateTrigger(req: Record<string, unknown>): Promise<TriggerApiResponse> {
    const apiClient = getApiClient()
    const response = await apiClient.post<TriggerApiResponse>(API_ENDPOINTS.TRIGGERS.UPDATE, req)
    return response.data
  }

  static async deleteTrigger(req: { space_id: string; trigger_id: string }): Promise<TriggerApiResponse> {
    const apiClient = getApiClient()
    const response = await apiClient.post<TriggerApiResponse>(API_ENDPOINTS.TRIGGERS.DELETE, req)
    return response.data
  }

  static async activateTrigger(req: { space_id: string; trigger_id: string }): Promise<TriggerApiResponse> {
    const apiClient = getApiClient()
    const response = await apiClient.post<TriggerApiResponse>(API_ENDPOINTS.TRIGGERS.ACTIVATE, req)
    return response.data
  }

  static async deactivateTrigger(req: { space_id: string; trigger_id: string }): Promise<TriggerApiResponse> {
    const apiClient = getApiClient()
    const response = await apiClient.post<TriggerApiResponse>(API_ENDPOINTS.TRIGGERS.DEACTIVATE, req)
    return response.data
  }

  static async runTrigger(req: { space_id: string; trigger_id: string }): Promise<TriggerApiResponse> {
    const apiClient = getApiClient()
    const response = await apiClient.post<TriggerApiResponse>(API_ENDPOINTS.TRIGGERS.RUN, req)
    return response.data
  }

  static async getExecutionLogs(req: Record<string, unknown>): Promise<TriggerApiResponse> {
    const apiClient = getApiClient()
    const response = await apiClient.post<TriggerApiResponse>(API_ENDPOINTS.TRIGGERS.EXECUTION_LOGS, req)
    return response.data
  }

  static async getExecutionLogDetail(req: { space_id: string; log_id: number }): Promise<TriggerApiResponse> {
    const apiClient = getApiClient()
    const response = await apiClient.post<TriggerApiResponse>(API_ENDPOINTS.TRIGGERS.EXECUTION_LOG_DETAIL, req)
    return response.data
  }
}
