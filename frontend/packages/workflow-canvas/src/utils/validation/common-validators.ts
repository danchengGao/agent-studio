/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { validateFlowValue } from '../../form-materials'
import { t } from '../../i18n'

/**
 * Validator configuration options
 */
export interface ValidatorOptions {
  /** Error message */
  message?: string
  /** Whether required */
  required?: boolean
  /** Include private scope */
  includePrivateScope?: boolean
  /** Custom error messages */
  errorMessages?: {
    required?: string
    unknownVariable?: string
  }
  /** Empty message (for return content validation) */
  emptyMessage?: string
  /** Result message (for return content validation) */
  resultMessage?: string
}

/**
 * Input parameters validator configuration
 */
export interface InputParametersValidatorOptions extends ValidatorOptions {
  /** Required parameters list */
  requiredParams?: string[]
  /** Parameter name extraction regex */
  namePattern?: RegExp
  /** Whether to check empty content */
  checkEmptyContent?: boolean
}

/**
 * Create title validator
 * @param options - Validator configuration
 * @returns Title validator function
 */
export const createTitleValidator = (options: ValidatorOptions = {}) => {
  const { message = t('workflowCanvas.validation.titleRequired') } = options

  return ({ value }: { value: string }) => (value ? undefined : message)
}

/**
 * Create input parameters validator
 * @param options - Validator configuration
 * @returns Input parameters validator function
 */
export const createInputParametersValidator = (options: InputParametersValidatorOptions = {}) => {
  const {
    requiredParams = [],
    namePattern = /^inputs\.inputParameters\./,
    checkEmptyContent = true,
    required = false,
    includePrivateScope = false,
    errorMessages = {},
  } = options

  const { required: requiredMessage = t('workflowCanvas.validation.paramRequired'), unknownVariable: unknownVariableMessage = t('workflowCanvas.validation.variableUnknown') } = errorMessages

  return ({ value, context, name, formValues }: any) => {
    // Extract property name
    const valuePropertyKey = name.replace(namePattern, '')

    // Check if it's a required parameter
    const isRequired = required || requiredParams.includes(valuePropertyKey)

    // If parameter exists, check if its value is empty
    if (value && checkEmptyContent) {
      if (value?.type === 'constant' && (value?.content === undefined || value?.content === null || value?.content === '')) {
        return t('workflowCanvas.validation.paramEmpty', { param: valuePropertyKey })
      }
    }

    // Use validateFlowValue for variable reference validation
    return validateFlowValue(value, {
      node: context.node,
      required: isRequired,
      includePrivateScope,
      errorMessages: {
        required: t('workflowCanvas.validation.paramRequired', { param: valuePropertyKey }),
        unknownVariable: t('workflowCanvas.validation.paramEmpty', { param: valuePropertyKey }),
      },
    })
  }
}

/**
 * Create prompt validator
 * @param options - Validator configuration
 * @returns Prompt validator function
 */
export const createPromptValidator = (options: ValidatorOptions = {}) => {
  const { message = t('workflowCanvas.validation.promptRequired') } = options

  return ({ value }: any) => {
    const content = value?.content ?? ''
    return !content || content.trim().length === 0 ? message : undefined
  }
}

/**
 * Create output count validator
 * @param minCount - Minimum output count
 * @param options - Validator configuration
 * @returns Output count validator function
 */
export const createOutputCountValidator = (minCount: number, options: ValidatorOptions = {}) => {
  const { message = t('workflowCanvas.validation.outputCountMin', { count: minCount }) } = options

  return ({ value }: any) => {
    if (!value?.properties) return message
    const outputCount = Object.keys(value.properties).length
    return outputCount >= minCount ? undefined : message
  }
}

/**
 * Create condition validator
 * @param options - Validator configuration
 * @returns Condition validator function
 */
export const createConditionValidator = (options: ValidatorOptions = {}) => {
  const { message = t('workflowCanvas.validation.conditionIncomplete') } = options

  return ({ value }: any) => {
    // Handle is_empty and is_not_empty operators
    if (value?.operator === 'is_empty' || value?.operator === 'is_not_empty') {
      return !value?.left ? message : undefined
    }

    // Handle other operators that require left and right values
    return !value?.left || !value?.right ? message : undefined
  }
}

/**
 * Create return content validator
 * @param options - Validator configuration
 * @returns Return content validator function
 */
export const createReturnContentValidator = (options: ValidatorOptions = {}) => {
  const { emptyMessage = t('workflowCanvas.validation.returnContentEmpty'), resultMessage = t('workflowCanvas.validation.resultRequired') } = options

  return ({ value, formValues }: any) => {
    if (formValues?.exceptionConfig?.processType === 'return_content') {
      if (!value || Object.keys(value).length === 0) {
        return emptyMessage
      }
      if (!value.result) {
        return resultMessage
      }
    }
    return undefined
  }
}

/**
 * Create model validator
 * @param options - Validator configuration
 * @returns Model validator function
 */
export const createModelValidator = (options: ValidatorOptions = {}) => {
  const { message = t('workflowCanvas.validation.modelRequired') } = options

  return ({ value }: any) => {
    // Check if model is configured
    if (!value || !value.id || value.id === '') {
      return message
    }
    return undefined
  }
}

/**
 * Create streaming template validator
 * @param options - Validator configuration
 * @returns Streaming template validator function
 */
export const createStreamingTemplateValidator = (options: ValidatorOptions = {}) => {
  const { message = t('workflowCanvas.validation.streamingTemplateEmpty') } = options

  return ({ value, formValues }: any) => {
    // If streaming is enabled, check if output template is empty
    if (formValues?.inputs?.streaming === true) {
      const content = formValues?.inputs?.content?.content ?? ''
      if (!content || content.trim().length === 0) {
        return message
      }
    }
    return undefined
  }
}

/**
 * Predefined common validators
 */
export const commonValidators = {
  /** Default title validator */
  title: createTitleValidator(),

  /** Default input parameters validator */
  inputParameters: createInputParametersValidator(),

  /** Optional input parameters validator */
  optionalInputParameters: createInputParametersValidator({ required: false }),

  /** Dual output validator */
  dualOutput: createOutputCountValidator(2, { message: t('workflowCanvas.validation.outputCountDual') }),

  /** Condition validator */
  condition: createConditionValidator(),

  /** Return content validator */
  returnContent: createReturnContentValidator(),

  /** Model validator */
  model: createModelValidator(),

  /** Streaming template validator */
  streamingTemplate: createStreamingTemplateValidator(),
}
