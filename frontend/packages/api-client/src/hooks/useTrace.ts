import { useState, useCallback, useRef } from 'react'
import { traceService } from '../services/traceService'
import type {
  TraceListRequest,
  TraceListResponse,
  TraceRecord,
  TraceFilterParams,
  TraceApiError,
  TraceTreeRequest,
  TraceTreeResponse,
} from '../types/traceTypes'

/**
 * Trace数据获取Hook
 */
export const useTrace = () => {
  const [traces, setTraces] = useState<TraceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [pageToken, setPageToken] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)

  // 用于存储当前请求的引用，以便取消请求
  const currentRequestRef = useRef<AbortController | null>(null)

  /**
   * 获取Trace列表
   * @param params 查询参数
   * @param append 是否追加到现有数据（用于分页）
   */
  const fetchTraces = useCallback(async (params: TraceListRequest, append: boolean = false) => {
    try {
      setLoading(true)
      setError(null)

      // 取消之前的请求
      if (currentRequestRef.current) {
        currentRequestRef.current.abort()
      }

      // 创建新的AbortController
      currentRequestRef.current = new AbortController()

      const response = await traceService.getTraceList(params)

      if (response.code === 0) {
        const transformedTraces = traceService.transformSpansToRecords(response.spans)

        if (append) {
          setTraces(prev => [...prev, ...transformedTraces])
        } else {
          setTraces(transformedTraces)
        }

        setHasMore(response.has_more)
        setPageToken(response.next_page_token)
        setTotalCount(transformedTraces.length)
      } else {
        throw new Error(response.msg || '获取Trace列表失败')
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // 请求被取消，不设置错误状态
        return
      }

      const errorMessage = err instanceof Error ? err.message : '获取Trace列表失败'
      setError(errorMessage)
      console.error('获取Trace列表失败:', err)
    } finally {
      setLoading(false)
      currentRequestRef.current = null
    }
  }, [])

  /**
   * 根据筛选条件获取Trace列表
   * @param filterParams 筛选参数
   * @param workspaceId 工作空间ID
   * @param append 是否追加到现有数据
   */
  const fetchTracesWithFilter = useCallback(
    async (filterParams: TraceFilterParams, workspaceId: string, append: boolean = false) => {
      const apiParams = traceService.convertFilterToApiParams(filterParams, workspaceId)
      await fetchTraces(apiParams, append)
    },
    [fetchTraces],
  )

  /**
   * 加载更多数据（分页）
   * @param filterParams 筛选参数
   * @param workspaceId 工作空间ID
   */
  const loadMore = useCallback(
    async (filterParams: TraceFilterParams, workspaceId: string) => {
      if (!hasMore || !pageToken || loading) {
        return
      }

      const apiParams = traceService.convertFilterToApiParams(filterParams, workspaceId)
      apiParams.page_token = pageToken

      await fetchTraces(apiParams, true)
    },
    [hasMore, pageToken, loading, fetchTraces],
  )

  /**
   * 刷新数据
   * @param filterParams 筛选参数
   * @param workspaceId 工作空间ID
   */
  const refresh = useCallback(
    async (filterParams: TraceFilterParams, workspaceId: string) => {
      setTraces([])
      setPageToken(null)
      setHasMore(false)
      await fetchTracesWithFilter(filterParams, workspaceId, false)
    },
    [fetchTracesWithFilter],
  )

  /**
   * 清空数据
   */
  const clear = useCallback(() => {
    setTraces([])
    setError(null)
    setHasMore(false)
    setPageToken(null)
    setTotalCount(0)
  }, [])

  /**
   * 取消当前请求
   */
  const cancelRequest = useCallback(() => {
    if (currentRequestRef.current) {
      currentRequestRef.current.abort()
      currentRequestRef.current = null
    }
  }, [])

  return {
    // 数据状态
    traces,
    loading,
    error,
    hasMore,
    pageToken,
    totalCount,

    // 操作方法
    fetchTraces,
    fetchTracesWithFilter,
    loadMore,
    refresh,
    clear,
    cancelRequest,
  }
}

/**
 * Trace统计信息Hook
 */
export const useTraceStats = () => {
  const [stats, setStats] = useState({
    totalTraces: 0,
    successTraces: 0,
    failedTraces: 0,
    pendingTraces: 0,
    averageLatency: 0,
    totalTokens: 0,
  })

  /**
   * 计算统计数据
   * @param traces Trace数据列表
   */
  const calculateStats = useCallback((traces: TraceRecord[]) => {
    const totalTraces = traces.length
    const successTraces = traces.filter(t => t.status === 'success').length
    const failedTraces = traces.filter(t => t.status === 'failed').length
    const pendingTraces = traces.filter(t => t.status === 'pending').length
    const averageLatency = traces.length > 0 ? Math.round(traces.reduce((sum, t) => sum + t.latency, 0) / traces.length) : 0
    const totalTokens = traces.reduce((sum, t) => sum + (typeof t.tokens === 'number' ? t.tokens : 0), 0)

    setStats({
      totalTraces,
      successTraces,
      failedTraces,
      pendingTraces,
      averageLatency,
      totalTokens,
    })
  }, [])

  return {
    stats,
    calculateStats,
  }
}

/**
 * 调试追踪Hook
 */
export const useDebugTrace = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 获取调用树详情
   * @param traceIdOrDebugId trace_id 或 debug_id
   * @param workspaceId 工作空间ID
   * @param msgTime 消息时间戳
   * @param useDebugId 是否使用debug_id，默认为false（使用trace_id）
   * @returns Promise<TraceTreeResponse | null>
   */
  const getTraceTree = useCallback(async (traceIdOrDebugId: string, workspaceId: string, msgTime: number, useDebugId: boolean = false): Promise<TraceTreeResponse | null> => {
    try {
      setLoading(true)
      setError(null)

      // 计算时间范围
      const startTime = (msgTime - 365 * 24 * 60 * 60 * 1000).toString() // 消息时间-1年
      const endTime = Date.now().toString() // 当前时间

      // 查询调用树详情，支持trace_id或debug_id
      const treeRequest: TraceTreeRequest = {
        workspace_id: workspaceId,
        start_time: startTime,
        end_time: endTime,
        ...(useDebugId ? { debug_id: traceIdOrDebugId } : { trace_id: traceIdOrDebugId }),
      }

      const treeResponse = await traceService.getTraceTree(treeRequest)
      return treeResponse
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取调用树详情失败'
      setError(errorMessage)
      console.error('获取调用树详情失败:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 完整的调试追踪流程：根据debug_id查询调用树
   * @param debugId debug_id
   * @param workspaceId 工作空间ID
   * @param msgTime 消息时间戳
   * @returns Promise<{ traceId: string; treeData: TraceTreeResponse } | null>
   */
  const getDebugTrace = useCallback(
    async (debugId: string, workspaceId: string, msgTime: number): Promise<{ traceId: string; treeData: TraceTreeResponse } | null> => {
      try {
        // 直接使用debug_id获取调用树详情
        const treeData = await getTraceTree(debugId, workspaceId, msgTime, true)
        if (!treeData) {
          return null
        }

        // 从响应中获取trace_id（如果响应中包含）
        const traceId = treeData.traces_advance_info?.trace_id || debugId

        return { traceId, treeData }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '获取调试追踪失败'
        setError(errorMessage)
        console.error('获取调试追踪失败:', err)
        return null
      }
    },
    [getTraceTree],
  )

  /**
   * 清空错误状态
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    loading,
    error,
    getTraceTree,
    getDebugTrace,
    clearError,
  }
}
