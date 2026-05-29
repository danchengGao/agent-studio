/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { commonValidators } from '../../utils/validation'
import { t } from '../../i18n'

const VALID_MODES = new Set(['firstNonNull', 'append', 'combine', 'chooseBranch', 'sqlQuery'])
const VALID_COMBINE_BY = new Set(['matchingFields', 'position', 'allCombinations'])
const VALID_OUTPUT_TYPES = new Set(['keepMatches', 'enrichInput1', 'keepEverything'])

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

    const mode = group.mode || 'firstNonNull'
    if (!VALID_MODES.has(mode)) {
      return t('workflowCanvas.nodes.variableMerge.unknownMode', { mode })
    }

    if (mode === 'combine') {
      const combineBy = group.combineBy || 'matchingFields'
      if (!VALID_COMBINE_BY.has(combineBy)) {
        return t('workflowCanvas.nodes.variableMerge.unknownCombineBy', { combineBy })
      }
      if (combineBy === 'matchingFields') {
        if (!group.matchField1 || !group.matchField1.trim() || !group.matchField2 || !group.matchField2.trim()) {
          return t('workflowCanvas.nodes.variableMerge.matchFieldRequired', { name: group.name })
        }
        const outputType = group.outputType || 'keepMatches'
        if (!VALID_OUTPUT_TYPES.has(outputType)) {
          return t('workflowCanvas.nodes.variableMerge.unknownOutputType', { outputType })
        }
      }
    }

    if (mode === 'chooseBranch') {
      const idx = group.chooseIndex ?? 0
      if (idx !== -1 && (idx < 0 || idx >= group.items.length)) {
        return t('workflowCanvas.nodes.variableMerge.chooseIndexInvalid', { name: group.name })
      }
    }

  }

  return undefined
}

export const validation = {
  'inputs.inputParameters.*': commonValidators.optionalInputParameters,
  'inputs.variableMerge': validateVariableMerge,
}
