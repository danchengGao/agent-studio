/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import type { FlowNodeEntity } from '@flowgram.ai/free-layout-editor'
import type { ValidationErrorInfo } from '../../components/validation/types'

/**
 * 获取节点显示名称
 * @param node 节点实体
 * @returns 节点显示名称
 */
export const getNodeDisplayName = (node: any): string => {
  if (node?.data?.title) {
    return node.data.title
  }

  const nodeType = node?.type || node?.data?.type

  const nodeTypeNames: Record<string, string> = {
    '1': '开始',
    '2': '结束',
    '3': '大模型',
    '4': '选择器',
    '5': '循环',
    '6': '代码执行',
    '7': '输入',
    '8': '输出',
    '9': '意图识别',
    '10': '提问器',
    '11': '文本编辑',
    '12': '继续',
    '13': '跳出',
    '14': '变量',
    '15': '开始',
    '16': '结束',
    comment: '注释',
  }

  return nodeTypeNames[nodeType] || `节点 (${node?.id || '未知'})`
}

/**
 * 检查节点是否有连接
 * @param node 节点实体
 * @returns 是否有连接
 */
export const hasConnections = (node: FlowNodeEntity): boolean => {
  // 检查输入输出线
  if (node.lines?.inputLines?.length || node.lines?.outputLines?.length) {
    return true
  }

  // 检查可用线
  if (node.lines?.availableLines?.length) {
    return true
  }

  // 检查端口
  if (node.ports?.inputPorts || node.ports?.outputPorts) {
    const ports = [...(node.ports.inputPorts || []), ...(node.ports.outputPorts || [])]
    return ports.some((port: any) => port.availableLines?.length || port.lines?.length)
  }

  return false
}

/**
 * 提取属性名的辅助函数
 * @param name 完整属性名
 * @param pattern 匹配模式
 * @returns 提取后的属性名
 */
export const extractPropertyName = (name: string, pattern: RegExp = /^inputs\.inputParameters\./): string => {
  return name.replace(pattern, '')
}

/**
 * 创建验证错误对象
 * @param nodeId 节点ID
 * @param nodeTitle 节点标题
 * @param error 错误消息
 * @param field 字段路径
 * @param severity 严重程度
 * @returns 验证错误对象
 */
export const createValidationError = (
  nodeId: string,
  nodeTitle: string,
  error: string,
  field?: string,
  severity: 'error' | 'warning' = 'error',
): ValidationErrorInfo => {
  return {
    nodeId,
    nodeTitle,
    error,
    severity,
    field,
  }
}

/**
 * 验证常量值是否为空
 * @param value 值对象
 * @returns 是否为空
 */
export const isConstantValueEmpty = (value: any): boolean => {
  return value?.type === 'constant' && (value?.content === undefined || value?.content === null || value?.content === '')
}

/**
 * 提取模板内容的辅助函数
 * @param value 模板值对象
 * @returns 提取的内容
 */
export const extractTemplateContent = (value?: any): string => {
  return value?.content ?? ''
}

/**
 * 检查输出数量是否符合要求
 * @param outputs 输出配置
 * @param minCount 最小数量
 * @returns 是否符合要求
 */
export const hasMinimumOutputs = (outputs: any, minCount: number): boolean => {
  if (!outputs?.properties) return false
  const outputCount = Object.keys(outputs.properties).length
  return outputCount >= minCount
}
