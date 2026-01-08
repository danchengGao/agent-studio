/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { isNil } from 'lodash-es'
import { FeedbackLevel, FlowNodeEntity, getNodeScope, getNodePrivateScope } from '@flowgram.ai/editor'

import { t } from '../../../i18n'
import { type IFlowValue, FlowValueUtils } from '../../'

/**
 * Validate variable name contains only letters, numbers, underscores
 * @param variableName - Variable name
 * @returns Validation result
 */
export function validateVariableName(variableName: string): { isValid: boolean; message?: string } {
  if (!variableName || variableName.trim() === '') {
    return {
      isValid: false,
      message: t('workflowCanvas.formMaterials.validate.variableNameEmpty'),
    }
  }

  // Variable name can only contain letters, numbers, underscores, and must start with a letter
  const variableNamePattern = /^[a-zA-Z][a-zA-Z0-9_]*$/

  if (!variableNamePattern.test(variableName)) {
    return {
      isValid: false,
      message: t('workflowCanvas.formMaterials.validate.variableNamePattern'),
    }
  }

  return {
    isValid: true,
  }
}

interface Context {
  node: FlowNodeEntity
  required?: boolean
  includePrivateScope?: boolean
  errorMessages?: {
    required?: string
    unknownVariable?: string
  }
}

export function validateFlowValue(value: IFlowValue | undefined, ctx: Context) {
  const { node, required, includePrivateScope = false, errorMessages } = ctx

  const {
    required: requiredMessage = t('workflowCanvas.formMaterials.validate.fieldRequired'),
    unknownVariable: unknownVariableMessage = t('workflowCanvas.formMaterials.validate.unknownVariable'),
  } = errorMessages || {}

  if (required && (isNil(value) || isNil(value?.content) || value?.content === '')) {
    return {
      level: FeedbackLevel.Error,
      message: requiredMessage,
    }
  }

  const checkVariableExists = (keyPath: string[]) => {
    let variable = getNodeScope(node).available.getByKeyPath(keyPath)

    if (!variable && includePrivateScope) {
      const privateScope = getNodePrivateScope(node)
      variable = privateScope?.available?.getByKeyPath(keyPath)
    }

    return variable
  }

  if (value?.type === 'ref') {
    const variable = checkVariableExists(value?.content || [])
    if (!variable) {
      return {
        level: FeedbackLevel.Error,
        message: unknownVariableMessage,
      }
    }
  }

  if (value?.type === 'template') {
    const allRefs = FlowValueUtils.getTemplateKeyPaths(value)

    for (const ref of allRefs) {
      const variable = checkVariableExists(ref)
      if (!variable) {
        return {
          level: FeedbackLevel.Error,
          message: unknownVariableMessage,
        }
      }
    }
  }

  return undefined
}
