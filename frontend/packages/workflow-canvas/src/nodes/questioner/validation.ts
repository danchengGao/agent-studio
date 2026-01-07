/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { commonValidators } from '../../utils/validation'
import { t } from '../../i18n'

const maxResponseValidator = ({ value }: { value: any }) => {
  if (value === undefined || value === null || value === '') return t('workflowCanvas.nodes.questioner.maxResponseRequired')
  const num = Number(value)
  if (!Number.isInteger(num)) return t('workflowCanvas.nodes.questioner.mustBeInteger')
  if (num <= 0 || num > 10) return t('workflowCanvas.nodes.questioner.mustBePositiveInteger')
  return undefined
}

export const validation = {
  'inputs.inputParameters.*': commonValidators.optionalInputParameters,
  'inputs.llmParam.model': commonValidators.model,
  'inputs.max_response': maxResponseValidator,
  outputs: commonValidators.dualOutput,
}
