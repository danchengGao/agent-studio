/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { customNanoid } from '../../../utils/nanoid-custom'

// 意图选项接口 - 兼容原始IntentRule结构
export interface IntentOption {
  name: string
  id: string // 添加唯一ID用于端口绑定
  [key: string]: any
}

/**
 * 生成唯一的意图ID
 */
export const generateIntentId = (): string => {
  return `intent_${customNanoid(8)}`
}

/**
 * 安全地处理意图数据，确保返回标准化的IntentOption数组
 */
export const normalizeIntents = (value: any): IntentOption[] => {
  if (!Array.isArray(value)) return []

  return value.map((intent, index) => {
    if (typeof intent === 'string' && intent !== null) {
      return { name: intent, id: intent.id || generateIntentId() }
    } else if (intent && typeof intent === 'object') {
      return {
        name: intent.name || '',
        id: intent.id || generateIntentId(),
      }
    } else {
      return { name: '', id: generateIntentId() }
    }
  })
}

/**
 * 获取意图的显示标签
 */
export const getIntentLabel = (index: number): string => {
  return `意图${index + 1}`
}

/**
 * 获取意图的端口ID
 */
export const getIntentPortId = (intent: IntentOption, index: number): string => {
  // 确保始终返回有效的ID，如果intent没有id则生成一个
  return intent.id || generateIntentId()
}
