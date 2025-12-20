/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useMemo, useCallback } from 'react'
import { useWorkflowCanvas, useSaveWorkflow } from '@test-agentstudio/api-client'
import { Toast } from '@douyinfe/semi-ui'
import { FlowDocumentJSON } from '../typings/node'

// 数据解析和验证工具函数
const parseWorkflowSchema = (schema: string | object): FlowDocumentJSON | null => {
  try {
    if (typeof schema === 'string') {
      return JSON.parse(schema)
    }
    if (typeof schema === 'object' && schema !== null) {
      return schema
    }
    return null
  } catch (error) {
    console.error('Failed to parse workflow schema:', error)
    return null
  }
}

export const useWorkflowCanvasData = (
  workflowId: string | undefined,
  spaceId?: string,
  version?: string,
): {
  canvasData: any
  isLoading: boolean
  error: unknown
} => {
  if (!spaceId) {
    return {
      canvasData: null,
      isLoading: false,
      error: new Error('缺少空间ID (spaceId)，请确保URL参数中包含正确的空间ID'),
    }
  }

  const {
    data: canvasResponse,
    isLoading,
    error,
  } = useWorkflowCanvas({
    workflow_id: workflowId || '',
    space_id: spaceId,
    version: version, // 传递版本参数
  })

  const canvasData = canvasResponse?.data?.workflow || null
  const actualLoading = isLoading && !!workflowId
  return { canvasData, isLoading: actualLoading, error }
}

export const useWorkflowData = (
  workflowId?: string,
  spaceId?: string,
  version?: string,
): {
  canvasData: any
  initialCanvasData: FlowDocumentJSON | null
  isLoading: boolean
  error: unknown
  handleAutoSave: (workflowData: any) => Promise<void>
} => {
  const { canvasData, isLoading, error } = useWorkflowCanvasData(workflowId, spaceId, version)
  const saveWorkflowMutation = useSaveWorkflow()

  // 使用 useMemo 优化数据解析，避免重复计算
  const initialCanvasData = useMemo((): FlowDocumentJSON | null => {
    if (!canvasData?.schema) {
      // 为没有 schema 的工作流提供默认的空画布结构
      console.log('No schema found, providing empty canvas structure')
      return {
        nodes: [],
        edges: [],
      }
    }

    const parsedData = parseWorkflowSchema(canvasData.schema)
    if (!parsedData) {
      console.log('Failed to parse schema, providing empty canvas structure')
      return {
        nodes: [],
        edges: [],
      }
    }

    return parsedData
  }, [canvasData?.schema, canvasData?.name, canvasData?.workflow_version])

  // 自动保存函数
  const handleAutoSave = useCallback(
    async (workflowData: any) => {
      if (!spaceId || !workflowId || !canvasData) {
        console.error('Auto-save failed: missing workflowId or canvasData')
        return
      }

      // 获取 space_id：优先使用 canvasData.space_id，其次使用 URL 传入的 spaceId
      const finalSpaceId = canvasData?.space_id || spaceId

      if (!finalSpaceId) {
        console.error('Auto-save failed: missing space_id (canvasData/URL)')
        Toast.error({
          content: '自动保存失败：缺少空间ID，请确保工作空间信息正确',
          duration: 3,
        })
        return
      }

      try {
        await saveWorkflowMutation.mutateAsync({
          workflow_id: workflowId,
          workflow_version: 'draft',
          space_id: finalSpaceId,
          schema: JSON.stringify(workflowData),
        })
      } catch (error: any) {
        console.error('Auto-save failed:', error)

        // 根据错误类型提供更准确的错误提示
        let errorMessage = '自动保存失败，请检查网络连接'

        // 检查是否是网络错误（请求未发出或超时）
        if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
          errorMessage = '自动保存失败：请求超时，请稍后重试'
        } else if (error?.response) {
          // 服务器返回了响应
          const status = error.response.status
          const responseData = error.response.data

          if (status === 403) {
            errorMessage = '自动保存失败：没有权限保存此工作流'
          } else if (status === 500 || status >= 502) {
            errorMessage = '自动保存失败：服务器错误，请稍后重试'
          } else if (status === 400) {
            errorMessage = responseData?.message || responseData?.msg || '自动保存失败：数据格式错误'
          } else if (status === 503) {
            errorMessage = '自动保存失败：服务暂时不可用，请稍后重试'
          } else {
            errorMessage = responseData?.message || responseData?.msg || `自动保存失败：服务器错误 (${status})`
          }
        } else if (error?.request && !error?.response) {
          // 请求已发出但没有收到响应（网络断开或服务器未响应）
          errorMessage = '自动保存失败：无法连接到服务器，请检查网络连接'
        } else if (error?.name === 'CanceledError' || error?.message?.includes('canceled')) {
          // 请求被取消（可能是并发请求冲突或组件卸载）
          console.warn('Auto-save request was canceled, skipping error notification')
          return // 取消的请求不需要显示错误提示
        }

        Toast.error({
          content: errorMessage,
          duration: 3,
        })
      }
    },
    [workflowId, canvasData, saveWorkflowMutation, spaceId],
  )

  return {
    canvasData,
    initialCanvasData,
    isLoading,
    error,
    handleAutoSave,
  }
}
