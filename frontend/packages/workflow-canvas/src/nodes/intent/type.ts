/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { JsonSchema } from '../../typings'

/**
 * 意图匹配规则接口
 */
export interface IntentRule {
  id: string
  name: string
  pattern: string
  type: 'exact' | 'contains' | 'regex'
  confidence: number
}

/**
 * 意图识别结果接口
 */
export interface IntentRecognitionResult {
  matchedIntent: string | null
  confidence: number
  matchedPattern: string | null
}

/**
 * 意图识别配置接口
 */
export interface IntentRecognitionConfig {
  // 意图匹配的输入参数
  inputKey: string
  // 意图列表
  intents: IntentRule[]
  // 匹配模式：first (首个匹配) 或 best (最高置信度)
  matchMode: 'first' | 'best'
  // 最低置信度阈值
  minConfidence: number
  // 未匹配到意图时的默认处理
  fallbackIntent?: string
}

/**
 * 表单数据接口
 */
export type FormData = {
  title: string
  inputs: {
    inputParameters: JsonSchema
    llmParam: JsonSchema
    fcParamVar: JsonSchema
  }
  outputs: JsonSchema
  [key: string]: any
}

export interface IModelValue {
  modelName?: string
  modelType?: number
}
