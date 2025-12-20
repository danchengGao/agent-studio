/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useQuery, useMutation, UseQueryOptions } from 'react-query'
import { WorkflowService } from '../services/workflowService'
import {
  ExecutionLogsListRequest,
  ExecutionLogsListResponse,
  ExecutionLogDetailRequest,
  ExecutionLogDetailResponse,
  ExecutionDebugRequest,
  ExecutionDebugResponse,
} from '../types'

// 获取执行日志列表的hook
export const useExecutionLogsList = (
  request: ExecutionLogsListRequest,
  options?: Omit<UseQueryOptions<ExecutionLogsListResponse, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery(
    ['executionLogsList', request],
    () => WorkflowService.getExecutionLogsList(request),
    {
      staleTime: 5 * 60 * 1000, // 5分钟缓存
      cacheTime: 10 * 60 * 1000, // 10分钟缓存
      ...options,
    }
  )
}

// 获取执行日志详情的hook
export const useExecutionLogDetail = (
  request: ExecutionLogDetailRequest,
  options?: Omit<UseQueryOptions<ExecutionLogDetailResponse, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery(
    ['executionLogDetail', request.trace_id, request],
    () => WorkflowService.getExecutionLogDetail(request),
    {
      enabled: !!request.trace_id, // 只有当trace_id存在时才执行查询
      staleTime: 5 * 60 * 1000, // 5分钟缓存
      cacheTime: 10 * 60 * 1000, // 10分钟缓存
      ...options,
    }
  )
}

// 进入执行调试模式的hook
export const useExecutionDebug = (
  request: ExecutionDebugRequest,
  options?: Omit<UseQueryOptions<ExecutionDebugResponse, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery(
    ['executionDebug', request.workflow_id, request.trace_id],
    () => WorkflowService.enterExecutionDebug(request),
    {
      enabled: !!(request.workflow_id || request.trace_id), // 只有当workflow_id或trace_id存在时才执行查询
      staleTime: 1 * 60 * 1000, // 1分钟缓存
      cacheTime: 5 * 60 * 1000, // 5分钟缓存
      ...options,
    }
  )
}

// 手动获取执行日志详情的mutation hook
export const useFetchExecutionLogDetail = () => {
  return useMutation(
    (request: ExecutionLogDetailRequest) => WorkflowService.getExecutionLogDetail(request)
  )
}

// 手动进入执行调试模式的mutation hook
export const useEnterExecutionDebug = () => {
  return useMutation(
    (request: ExecutionDebugRequest) => WorkflowService.enterExecutionDebug(request)
  )
}