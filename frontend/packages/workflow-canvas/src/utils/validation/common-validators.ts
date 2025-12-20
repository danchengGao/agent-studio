/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { validateFlowValue } from '../../form-materials'

/**
 * 验证器配置选项
 */
export interface ValidatorOptions {
  /** 错误消息 */
  message?: string
  /** 是否必需 */
  required?: boolean
  /** 包含私有作用域 */
  includePrivateScope?: boolean
  /** 自定义错误消息 */
  errorMessages?: {
    required?: string
    unknownVariable?: string
  }
  /** 空消息（用于返回内容验证） */
  emptyMessage?: string
  /** 结果消息（用于返回内容验证） */
  resultMessage?: string
}

/**
 * 输入参数验证器配置
 */
export interface InputParametersValidatorOptions extends ValidatorOptions {
  /** 必需参数列表 */
  requiredParams?: string[]
  /** 参数名提取正则表达式 */
  namePattern?: RegExp
  /** 是否检查空内容 */
  checkEmptyContent?: boolean
}

/**
 * 创建标题验证器
 * @param options 验证器配置
 * @returns 标题验证函数
 */
export const createTitleValidator = (options: ValidatorOptions = {}) => {
  const { message = '标题是必需的' } = options

  return ({ value }: { value: string }) => (value ? undefined : message)
}

/**
 * 创建输入参数验证器
 * @param options 验证器配置
 * @returns 输入参数验证函数
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

  const { required: requiredMessage = '是必需的', unknownVariable: unknownVariableMessage = '引用的变量不存在' } = errorMessages

  return ({ value, context, name, formValues }: any) => {
    // 提取属性名
    const valuePropertyKey = name.replace(namePattern, '')

    // 检查是否为必需参数
    const isRequired = required || requiredParams.includes(valuePropertyKey)

    // 如果参数存在，检查其值是否为空
    if (value && checkEmptyContent) {
      if (value?.type === 'constant' && (value?.content === undefined || value?.content === null || value?.content === '')) {
        return `${valuePropertyKey} 参数不能为空`
      }
    }

    // 使用 validateFlowValue 进行变量引用校验
    return validateFlowValue(value, {
      node: context.node,
      required: isRequired,
      includePrivateScope,
      errorMessages: {
        required: `${valuePropertyKey} ${requiredMessage}`,
        unknownVariable: `${valuePropertyKey} ${unknownVariableMessage}`,
      },
    })
  }
}

/**
 * 创建提示词验证器
 * @param options 验证器配置
 * @returns 提示词验证函数
 */
export const createPromptValidator = (options: ValidatorOptions = {}) => {
  const { message = '提示词不能为空' } = options

  return ({ value }: any) => {
    const content = value?.content ?? ''
    return !content || content.trim().length === 0 ? message : undefined
  }
}

/**
 * 创建输出数量验证器
 * @param minCount 最小输出数量
 * @param options 验证器配置
 * @returns 输出数量验证函数
 */
export const createOutputCountValidator = (minCount: number, options: ValidatorOptions = {}) => {
  const { message = `输出至少需要有${minCount}个变量` } = options

  return ({ value }: any) => {
    if (!value?.properties) return message
    const outputCount = Object.keys(value.properties).length
    return outputCount >= minCount ? undefined : message
  }
}

/**
 * 创建条件完整性验证器
 * @param options 验证器配置
 * @returns 条件完整性验证函数
 */
export const createConditionValidator = (options: ValidatorOptions = {}) => {
  const { message = '条件不完整' } = options

  return ({ value }: any) => {
    // 处理 is_empty 和 is_not_empty 操作符
    if (value?.operator === 'is_empty' || value?.operator === 'is_not_empty') {
      return !value?.left ? message : undefined
    }

    // 处理其他需要左右值的操作符
    return !value?.left || !value?.right ? message : undefined
  }
}

/**
 * 创建返回内容配置验证器
 * @param options 验证器配置
 * @returns 返回内容配置验证函数
 */
export const createReturnContentValidator = (options: ValidatorOptions = {}) => {
  const { emptyMessage = '返回内容配置不能为空', resultMessage = '返回结果(result)是必需的' } = options

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
 * 创建模型验证器
 * @param options 验证器配置
 * @returns 模型验证函数
 */
export const createModelValidator = (options: ValidatorOptions = {}) => {
  const { message = '请选择模型' } = options

  return ({ value }: any) => {
    // 检查模型是否已配置
    if (!value || !value.id || value.id === '') {
      return message
    }
    return undefined
  }
}

/**
 * 创建流式输出模板验证器
 * @param options 验证器配置
 * @returns 流式输出模板验证函数
 */
export const createStreamingTemplateValidator = (options: ValidatorOptions = {}) => {
  const { message = '开启流式输出时，输出模板不能为空' } = options

  return ({ value, formValues }: any) => {
    // 如果开启了流式输出，检查输出模板是否为空
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
 * 预定义的通用验证器
 */
export const commonValidators = {
  /** 默认标题验证器 */
  title: createTitleValidator(),

  /** 默认输入参数验证器 */
  inputParameters: createInputParametersValidator(),

  /** 非必需输入参数验证器 */
  optionalInputParameters: createInputParametersValidator({ required: false }),

  /** 双输出验证器 */
  dualOutput: createOutputCountValidator(2, { message: '输出至少需要有两个变量' }),

  /** 条件完整性验证器 */
  condition: createConditionValidator(),

  /** 返回内容配置验证器 */
  returnContent: createReturnContentValidator(),

  /** 模型验证器 */
  model: createModelValidator(),

  /** 流式输出模板验证器 */
  streamingTemplate: createStreamingTemplateValidator(),
}
