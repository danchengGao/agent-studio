import { getApiClient } from '../utils/apiClientFactory'
import { API_ENDPOINTS } from '../config'
import type {
  TraceSummaryBriefWithStatus,
  ActiveExecution,
  ExecutionLogSummary,
  ExecutionLogCreateInfo,
} from '../types'

export interface TraceSummaryBySpaceResponse {
  code: number
  message: string
  data: TraceSummaryBriefWithStatus[]
}

export interface ActiveExecutionsResponse {
  code: number
  message: string
  data: ActiveExecution[]
}

export interface TraceSummaryDetailResponse {
  code: number
  message: string
  data: ExecutionLogSummary
}

export interface ExecutionDebugEnterResponse {
  code: number
  message: string
  data: {
    logSummary?: ExecutionLogSummary
    log_summary?: ExecutionLogSummary
    logsCreateList?: ExecutionLogCreateInfo[]
    logs_create_list?: ExecutionLogCreateInfo[]
  }
}

export class ExecutionPanelService {
  static async getTraceSummariesBySpace(
    space_id: string,
    business_type?: string,
    limit?: number
  ): Promise<TraceSummaryBySpaceResponse> {
    try {
      const response = await getApiClient().post<TraceSummaryBySpaceResponse>(
        API_ENDPOINTS.EXECUTION.GET_ALL_TRACE_SUMMARIES,
        { space_id, business_type, limit: limit || 50 }
      )
      return response.data
    } catch (e: any) {
      if (e?.response?.status === 404) {
        return { code: 200, message: 'No data', data: [] }
      }
      throw e
    }
  }

  static async getTraceSummaryByTraceId(
    space_id: string,
    trace_id: string
  ): Promise<TraceSummaryDetailResponse> {
    const response = await getApiClient().post<TraceSummaryDetailResponse>(
      API_ENDPOINTS.EXECUTION.GET_TRACE_SUMMARY_BY_TRACE_ID,
      { space_id, trace_id }
    )
    return response.data
  }

  static async getActiveExecutions(
    space_id: string
  ): Promise<ActiveExecutionsResponse> {
    const response = await getApiClient().post<ActiveExecutionsResponse>(
      API_ENDPOINTS.EXECUTION.LIST_ACTIVE_EXECUTIONS,
      { space_id }
    )
    return response.data
  }

  /**
   * Find running executions from TraceDetail that don't have a completed TraceSummary.
   * Works for both agents and workflows.
   */
  static async getRunningTraces(
    space_id: string,
    business_type?: string
  ): Promise<TraceSummaryBySpaceResponse> {
    try {
      const response = await getApiClient().post<TraceSummaryBySpaceResponse>(
        API_ENDPOINTS.EXECUTION.GET_RUNNING_TRACES,
        { space_id, business_type }
      )
      return response.data
    } catch (e: any) {
      if (e?.response?.status === 404) {
        return { code: 200, message: 'No data', data: [] }
      }
      throw e
    }
  }

  /**
   * Get the latest execution debug data for a workflow (works for running executions too).
   */
  static async getWorkflowExecutionDebug(
    space_id: string,
    workflow_id: string
  ): Promise<ExecutionDebugEnterResponse> {
    try {
      const response = await getApiClient().post<ExecutionDebugEnterResponse>(
        API_ENDPOINTS.WORKFLOWS.ENTER_EXECUTION_DEBUG,
        { space_id, workflow_id }
      )
      return response.data
    } catch (e: any) {
      if (e?.response?.status === 404) {
        return { code: 200, message: 'No data', data: { logsCreateList: [], logSummary: undefined } }
      }
      throw e
    }
  }

  /**
   * Get the latest execution debug data for an agent.
   */
  static async getAgentExecutionDebug(
    space_id: string,
    agent_id: string
  ): Promise<ExecutionDebugEnterResponse> {
    try {
      const response = await getApiClient().post<ExecutionDebugEnterResponse>(
        '/agents/enter_execution_logs_debug',
        { space_id, business_id: agent_id, business_type: 'AGENT' }
      )
      return response.data
    } catch (e: any) {
      if (e?.response?.status === 404) {
        return { code: 200, message: 'No data', data: { logsCreateList: [], logSummary: undefined } }
      }
      throw e
    }
  }
}
