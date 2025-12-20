/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { commonValidators } from '../../utils/validation'

/**
 * 校验变量聚合分组配置 - 只校验 items 数组不为空
 */
export const validateVariableMerge = ({ value }: any) => {
  if (!value || !Array.isArray(value)) {
    return '变量聚合配置不能为空'
  }

  // 检查是否有分组
  if (value.length === 0) {
    return '至少需要添加一个变量分组'
  }

  // 校验每个分组
  for (let i = 0; i < value.length; i++) {
    const group = value[i]

    // 检查分组名称
    if (!group.name || group.name.trim() === '') {
      return `第 ${i + 1} 个分组的名称不能为空`
    }

    // 检查分组是否至少有一个变量
    if (!group.items || !Array.isArray(group.items) || group.items.length === 0) {
      return `分组 "${group.name}" 至少需要包含一个变量`
    }
  }

  return undefined
}

/**
 * Variable-merge 节点的完整校验配置
 */
export const validation = {
  'inputs.inputParameters.*': commonValidators.optionalInputParameters,
  'inputs.variableMerge': validateVariableMerge,
}
