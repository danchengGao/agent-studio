/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { commonValidators } from '../../utils/validation'

const maxResponseValidator = ({ value }: { value: any }) => {
  if (value === undefined || value === null || value === '') return '最大提问次数不能为空'
  const num = Number(value)
  if (!Number.isInteger(num)) return '必须是整数'
  if (num <= 0 || num > 10) return '必须是大于0且不大于10的整数'
  return undefined
}

export const validation = {
  'inputs.inputParameters.*': commonValidators.optionalInputParameters,
  'inputs.llmParam.model': commonValidators.model,
  'inputs.max_response': maxResponseValidator,
  outputs: commonValidators.dualOutput,
}
