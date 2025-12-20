/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { validateFlowValue } from '../../form-materials'
import { FlowNodeEntity } from '@flowgram.ai/free-layout-editor'

interface LoopValidationContext {
  value?: any
  context: {
    node: FlowNodeEntity
  }
  name?: string
  formValues?: any
}

/**
 * Loop 节点的循环次数校验 - 只在NUM_LOOP类型下校验
 */
export const validateLoopNum = ({ value, context, formValues }: LoopValidationContext) => {
  const loopType = formValues?.inputs?.loopParam?.type

  if (loopType !== 'numLoop') {
    return undefined
  }

  const validationResult = validateFlowValue(value, {
    node: context.node,
    required: true,
    includePrivateScope: true,
    errorMessages: {
      required: '循环次数不能为空',
      unknownVariable: '循环次数引用的变量不存在',
    },
  })

  if (validationResult) {
    return validationResult.message
  }

  if (value?.type === 'constant') {
    const loopNum = value.content
    if (typeof loopNum === 'number') {
      if (loopNum < 1) {
        return '循环次数必须大于0'
      }
      if (loopNum > 1000) {
        return '循环次数不能超过1000'
      }
    } else {
      return '循环次数必须为数字'
    }
  }

  return undefined
}

/**
 * Loop 节点的循环数组校验 - 只在ARRAY_LOOP类型下校验
 */
export const validateLoopArray = ({ value, context, name, formValues }: LoopValidationContext) => {
  const loopType = formValues?.inputs?.loopParam?.type

  if (loopType !== 'arrayLoop') {
    return undefined
  }

  if (name === 'inputs.loopParam.loopArray') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return '循环数组配置不能为空'
    }

    const arrayKeys = Object.keys(value)
    if (arrayKeys.length === 0) {
      return '至少需要一个数组变量'
    }

    for (const [key] of Object.entries(value)) {
      if (!key || key.trim() === '') {
        return '数组变量名不能为空'
      }
    }
  }

  return undefined
}

/**
 * Loop 节点的中间变量字段校验
 */
export const validateIntermediateVarField = ({ value, context, name, formValues }: LoopValidationContext) => {
  const fieldName = name?.replace(/^inputs\.loopParam\.intermediateVar\./, '') || ''

  const validationResult = validateFlowValue(value, {
    node: context.node,
    required: true,
    includePrivateScope: true,
    errorMessages: {
      required: `中间变量 "${fieldName}" 不能为空`,
      unknownVariable: `中间变量 "${fieldName}" 引用的变量不存在`,
    },
  })

  return validationResult?.message
}

/**
 * Loop 节点的循环数组字段校验
 */
export const validateLoopArrayField = ({ value, context, name, formValues }: LoopValidationContext) => {
  const fieldName = name?.replace(/^inputs\.loopParam\.loopArray\./, '') || ''
  const loopType = formValues?.inputs?.loopParam?.type

  if (loopType !== 'arrayLoop') {
    return undefined
  }

  if (!value) {
    return `数组变量 "${fieldName}" 的值不能为空`
  }

  const validationResult = validateFlowValue(value, {
    node: context.node,
    required: true,
    includePrivateScope: true,
    errorMessages: {
      required: `数组变量 "${fieldName}" 不能为空`,
      unknownVariable: `数组变量 "${fieldName}" 引用的变量不存在`,
    },
  })

  if (validationResult) {
    return validationResult.message
  }

  if (value?.type === 'constant') {
    if (!Array.isArray(value.content)) {
      return `数组变量 "${fieldName}" 必须是数组类型`
    }
    if (Array.isArray(value.content) && value.content.length === 0) {
      return `数组变量 "${fieldName}" 不能为空数组`
    }
  }

  return undefined
}

/**
 * 校验循环节点内部的连接和节点
 */
export const validateLoopBlocks = ({ value, context }: LoopValidationContext) => {
  const blocks = context.node?.blocks || []

  if (!blocks || blocks.length === 0) {
    return undefined
  }

  const collectAllLines = (blocks: FlowNodeEntity[]) => {
    const allLines: any[] = []
    blocks.forEach(block => {
      if (block.lines) {
        const { inputLines, outputLines } = block.lines
        if (inputLines && Array.isArray(inputLines)) {
          allLines.push(...inputLines)
        }
        if (outputLines && Array.isArray(outputLines)) {
          allLines.push(...outputLines)
        }
      }
    })
    return allLines
  }

  const lines = collectAllLines(blocks)
  const edges = lines
    .map(line => ({
      sourceNodeID: line.from?.id,
      targetNodeID: line.to?.id,
    }))
    .filter(edge => edge.sourceNodeID && edge.targetNodeID)

  const blockStart = blocks.find(block => block.flowNodeType === '15')
  const blockEnd = blocks.find(block => block.flowNodeType === '16')

  if (!blockStart || !blockEnd) {
    return '循环体必须包含开始和结束节点'
  }

  const buildGraph = (nodes: FlowNodeEntity[], edgeList: any[]) => {
    const graph = new Map<string, string[]>()

    nodes.forEach(node => {
      graph.set(node.id, [])
    })

    edgeList.forEach(edge => {
      const neighbors = graph.get(edge.sourceNodeID) || []
      neighbors.push(edge.targetNodeID)
      graph.set(edge.sourceNodeID, neighbors)
    })

    return graph
  }

  const hasPath = (graph: Map<string, string[]>, start: string, end: string): boolean => {
    const visited = new Set<string>()
    const queue = [start]

    while (queue.length > 0) {
      const current = queue.shift()!
      if (current === end) {
        return true
      }

      if (visited.has(current)) {
        continue
      }

      visited.add(current)
      const neighbors = graph.get(current) || []
      queue.push(...neighbors)
    }

    return false
  }

  const graph = buildGraph(blocks, edges)
  const hasCompletePath = hasPath(graph, blockStart.id, blockEnd.id)

  if (!hasCompletePath) {
    return '循环体必须有从开始到结束的完整路径'
  }

  return undefined
}

/**
 * Loop 节点的完整校验配置
 */
export const validation = {
  'inputs.loopParam.loopNum': validateLoopNum,
  'inputs.loopParam.loopArray': validateLoopArray,
  'inputs.loopParam.loopArray.*': validateLoopArrayField,
  'inputs.loopParam.intermediateVar.*': validateIntermediateVarField,
  blocks: validateLoopBlocks,
}
