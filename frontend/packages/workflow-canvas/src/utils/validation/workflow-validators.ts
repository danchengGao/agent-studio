/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import type { ValidationErrorInfo } from '../../components/validation/types'
import { WorkflowDocument } from '@flowgram.ai/free-layout-editor'
import { t } from '../../i18n'

/**
 * Workflow path validation options
 */
export interface WorkflowPathValidationOptions {
  /** Start node type */
  startNodeType?: string
  /** End node type */
  endNodeType?: string
  /** Error message */
  errorMessage?: string
}

/**
 * Validate workflow path completeness
 * @param document - Workflow document
 * @param options - Validation configuration
 * @returns Validation error list
 */
export const validateWorkflowPath = (document: WorkflowDocument, options: WorkflowPathValidationOptions = {}): ValidationErrorInfo[] => {
  const { startNodeType = '1', endNodeType = '2', errorMessage = t('workflowCanvas.validators.workflowMustContainPath') } = options

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

    // Build adjacency list
    const graph = new Map<string, string[]>()
    nodes.forEach(node => graph.set(node.id, []))

    edges.forEach(edge => {
      if (edge.sourceNodeID && edge.targetNodeID) {
        const neighbors = graph.get(edge.sourceNodeID) || []
        neighbors.push(edge.targetNodeID)
        graph.set(edge.sourceNodeID, neighbors)
      }
    })

    // Check if path exists from start to end
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

    // Check if each start node can reach an end node
    startNodes.forEach(startNode => {
      if (!endNodes.some(endNode => hasPath(graph, startNode.id, endNode.id))) {
        workflowErrors.push({
          nodeId: 'workflow',
          nodeTitle: t('workflowCanvas.validators.workflow'),
          error: errorMessage,
          severity: 'error',
          field: 'workflow.path',
        })
      }
    })
  } catch (error) {
    // Ignore validation errors
  }

  return workflowErrors
}

/**
 * Workflow completeness validator collection
 */
export const workflowValidators = {
  validateWorkflowPath,
}
