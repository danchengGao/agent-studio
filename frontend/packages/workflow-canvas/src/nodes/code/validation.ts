/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { commonValidators, createInputParametersValidator } from '../../utils/validation'

/**
 * Code 节点的完整校验配置
 */
export const validation = {
  title: commonValidators.title,
  'inputs.inputParameters.*': ({ value, context, name, formValues }: any) => {
    const valuePropertyKey = name.replace(/^inputs\.inputParameters\./, '')
    const required = formValues.inputs?.inputParameters?.required || []

    // 创建动态验证器
    const validator = createInputParametersValidator({
      requiredParams: required,
      errorMessages: {
        required: '是必需的',
        unknownVariable: '引用的变量不存在',
      },
    })

    return validator({ value, context, name, formValues })
  },
  'exceptionConfig.returnContent': commonValidators.returnContent,
}
