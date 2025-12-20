/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import type { ValidationErrorInfo } from '../../components/validation/types'
import { WorkflowDocument } from '@flowgram.ai/free-layout-editor'

/**
 * 工作流路径验证配置
 */
export interface WorkflowPathValidationOptions {
  /** 开始节点类型 */
  startNodeType?: string
  /** 结束节点类型 */
  endNodeType?: string
  /** 错误消息 */
  errorMessage?: string
}

/**
 * 验证工作流路径完整性
 * @param document 工作文档
 * @param options 验证配置
 * @returns 验证错误列表
 */
export const validateWorkflowPath = (document: WorkflowDocument, options: WorkflowPathValidationOptions = {}): ValidationErrorInfo[] => {
  const { startNodeType = '1', endNodeType = '2', errorMessage = '工作流必须包含从开始节点到结束节点的完整路径' } = options

  const workflowErrors: ValidationErrorInfo[] = []

  try {
    const workflowData = document.toJSON()
    const { nodes, edges } = workflowData

    if (!nodes?.length || !edges) {
      return workflowErrors
    }

    const startNodes = nodes.filter(node => node.type === startNodeType)
    const endNodes = nodes.filter(node => node.type === endNodeType)

    if (!startNodes.length || !endNodes.length) {
      return workflowErrors
    }

    // 构建邻接表
    const graph = new Map<string, string[]>()
    nodes.forEach(node => graph.set(node.id, []))

    edges.forEach(edge => {
      if (edge.sourceNodeID && edge.targetNodeID) {
        const neighbors = graph.get(edge.sourceNodeID) || []
        neighbors.push(edge.targetNodeID)
        graph.set(edge.sourceNodeID, neighbors)
      }
    })

    // 检查是否存在从开始到结束的路径
    const hasPath = (graph: Map<string, string[]>, start: string, end: string): boolean => {
      const visited = new Set<string>()
      const queue = [start]

      while (queue.length) {
        const current = queue.shift()!
        if (current === end) return true

        if (visited.has(current)) continue

        visited.add(current)
        const neighbors = graph.get(current) || []
        queue.push(...neighbors)
      }

      return false
    }

    // 检查每个开始节点是否都能到达某个结束节点
    startNodes.forEach(startNode => {
      if (!endNodes.some(endNode => hasPath(graph, startNode.id, endNode.id))) {
        workflowErrors.push({
          nodeId: 'workflow',
          nodeTitle: '工作流',
          error: errorMessage,
          severity: 'error',
          field: 'workflow.path',
        })
      }
    })
  } catch (error) {
    // 忽略验证过程中的错误
  }

  return workflowErrors
}

/**
 * 工作流完整性验证器集合
 */
export const workflowValidators = {
  validateWorkflowPath,
}
