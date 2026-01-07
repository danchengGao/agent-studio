/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { commonValidators } from '../../utils/validation'
import { t } from '../../i18n'

export const validateVariableMerge = ({ value }: any) => {
  if (!value || !Array.isArray(value)) {
    return t('workflowCanvas.nodes.variableMerge.configCannotBeEmpty')
  }

  if (value.length === 0) {
    return t('workflowCanvas.nodes.variableMerge.atLeastOneGroup')
  }

  for (let i = 0; i < value.length; i++) {
    const group = value[i]

    if (!group.name || group.name.trim() === '') {
      return t('workflowCanvas.nodes.variableMerge.groupNameRequired', { index: i + 1 })
    }

    if (!group.items || !Array.isArray(group.items) || group.items.length === 0) {
      return t('workflowCanvas.nodes.variableMerge.groupAtLeastOneVariable', { name: group.name })
    }
  }

  return undefined
}

export const validation = {
  'inputs.inputParameters.*': commonValidators.optionalInputParameters,
  'inputs.variableMerge': validateVariableMerge,
}
