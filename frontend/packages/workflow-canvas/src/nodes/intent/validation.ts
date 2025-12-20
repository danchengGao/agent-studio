/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { commonValidators, createInputParametersValidator, createTitleValidator } from '../../utils/validation'
import { checkPortConnection } from '../../form-materials'

export const validateTitle = createTitleValidator({ message: '标题不能为空' })

export const validateInputParameters = createInputParametersValidator({
  requiredParams: ['query'],
  errorMessages: {
    required: '参数是必需的',
    unknownVariable: '引用的变量不存在',
  },
})

export const validateIntents = ({ value, context }: any) => {
  if (!value || !Array.isArray(value) || value.length === 0) {
    return '至少需要添加一个意图'
  }

  for (let i = 0; i < value.length; i++) {
    const intent = value[i]
    if (!intent.name || intent.name.trim() === '') {
      return `意图 ${i + 1} 的名称不能为空`
    }
    if (intent.name.length > 50) {
      return `意图 ${i + 1} 的名称长度不能超过50个字符`
    }
  }

  const intentPorts = value.map((intent: any) => intent.id)
  const node = context.node

  if (!node) {
    return undefined
  }

  const connectionStatus = intentPorts.map(portId => ({
    portId,
    hasConnection: checkPortConnection(node, portId, 'output'),
  }))

  const unconnectedIntents = connectionStatus.filter(status => !status.hasConnection)

  if (unconnectedIntents.length > 0) {
    const unconnectedIntentNames = value
      .filter((intent: any) => unconnectedIntents.some(status => status.portId === intent.id))
      .map((intent: any) => intent.name)

    if (unconnectedIntentNames.length === 1) {
      return `意图"${unconnectedIntentNames[0]}"必须连线到节点`
    } else {
      return `以下意图必须连线到节点: ${unconnectedIntentNames.join(', ')}`
    }
  }

  const hasOtherIntentConnection = checkPortConnection(node, '0', 'output')

  if (!hasOtherIntentConnection) {
    return '其他意图端口必须连线到节点'
  }

  return undefined
}

export const validation = {
  title: validateTitle,
  'inputs.inputParameters.*': validateInputParameters,
  'inputs.llmParam.model': commonValidators.model,
  'inputs.intents': validateIntents,
}
