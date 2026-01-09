/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { commonValidators } from '../../utils/validation'
import { validateFlowValue, ConditionPresetOp, checkPortConnection } from '../../form-materials'

/**
 * 验证常量值是否符合其 schema 定义的类型
 */
const validateConstantValueSchema = (value: any): string | undefined => {
  if (value?.type !== 'constant' || !value?.schema) {
    return undefined
  }

  const { schema, content } = value
  const originalExpectedType = schema.type

  if (!originalExpectedType || originalExpectedType === 'any') {
    return undefined
  }

  // Map format types to base types (e.g., "date-time" → "string")
  const formatToBaseType: Record<string, string> = {
    'date-time': 'string',
  }
  const expectedType = formatToBaseType[originalExpectedType] || originalExpectedType

  let actualType: string
  if (content === null || content === undefined) {
    actualType = 'null'
  } else if (Array.isArray(content)) {
    actualType = 'array'
  } else if (typeof content === 'object') {
    actualType = 'object'
  } else {
    actualType = typeof content
  }

  if (actualType === 'number' && Number.isInteger(content) && expectedType === 'integer') {
    actualType = 'integer'
  }

  if (actualType !== expectedType) {
    const typeMap: Record<string, string> = {
      array: '数组',
      object: '对象',
      string: '字符串',
      number: '数字',
      integer: '整数',
      boolean: '布尔值',
    }

    const expectedTypeName = typeMap[expectedType] || expectedType
    const actualTypeName = typeMap[actualType] || actualType

    return `期望${expectedTypeName}类型，但输入的是${actualTypeName}类型`
  }

  // Validate format types
  if (originalExpectedType === 'date-time') {
    // ISO 8601 date-time format: YYYY-MM-DDTHH:mm:ss.sssZ
    const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/
    if (!dateTimeRegex.test(content)) {
      return '期望日期时间格式（ISO 8601），例如：2026-01-09T15:44:53.043Z'
    }
  }

  return undefined
}

export const validateBranch = ({ value }: any) => {
  if (value?.conditions && value.conditions.length === 0) {
    return undefined
  }
  return undefined
}

export const validateConditionValue = ({ value, context }: any) => {
  if (!value) {
    return undefined
  }

  if (value?.type === 'constant') {
    if (value?.content === undefined || value?.content === null || value?.content === '') {
      return '条件值不能为空'
    }

    // 验证常量值是否符合其 schema 定义的类型
    const schemaValidationError = validateConstantValueSchema(value)
    if (schemaValidationError) {
      return schemaValidationError
    }
  }

  const validationResult = validateFlowValue(value, {
    node: context.node,
    required: true,
    includePrivateScope: false,
    errorMessages: {
      required: '条件值是必需的',
      unknownVariable: '引用的变量不存在',
    },
  })

  return validationResult?.message
}

export const validateCondition = ({ value, context }: any) => {
  if (!value) {
    return undefined
  }

  const { operator, left, right } = value

  if (operator === ConditionPresetOp.IS_EMPTY || operator === ConditionPresetOp.IS_NOT_EMPTY) {
    if (!left) {
      return '请选择要判断的变量'
    }
    return validateConditionValue({ value: left, context })
  }

  if (!left) {
    return '请选择左值'
  }
  if (!right) {
    return '请选择右值'
  }

  const leftError = validateConditionValue({ value: left, context })
  if (leftError) {
    return leftError
  }

  const rightError = validateConditionValue({ value: right, context })
  if (rightError) {
    return rightError
  }

  return undefined
}

export const validateBranchConnections = ({ value, context }: any) => {
  if (!value || !Array.isArray(value) || value.length === 0) {
    return undefined
  }

  const node = context.node
  if (!node) {
    return undefined
  }

  const branchPorts = value.map((branch: any) => branch.branchId).filter(Boolean)

  const connectionStatus = branchPorts.map(branchId => ({
    branchId,
    hasConnection: checkPortConnection(node, branchId, 'output'),
  }))

  const unconnectedBranches = connectionStatus.filter(status => !status.hasConnection)

  if (unconnectedBranches.length > 0) {
    const unconnectedBranchInfo = unconnectedBranches.map(({ branchId }) => {
      const index = value.findIndex((branch: any) => branch.branchId === branchId)
      const isElseBranch = value[index]?.conditions?.length === 0

      if (isElseBranch) {
        return { type: 'else', index }
      } else if (index === 0) {
        return { type: 'if', index }
      } else {
        return { type: 'elseIf', index }
      }
    })

    if (unconnectedBranchInfo.length === 1) {
      const { type } = unconnectedBranchInfo[0]
      switch (type) {
        case 'if':
          return '"如果"分支必须连线到节点'
        case 'else':
          return '"否则"分支必须连线到节点'
        case 'elseIf':
          return '"否则如果"分支必须连线到节点'
      }
    } else {
      const branchTypes = unconnectedBranchInfo.map(({ type }) => {
        switch (type) {
          case 'if':
            return '"如果"'
          case 'else':
            return '"否则"'
          case 'elseIf':
            return '"否则如果"'
        }
      })

      if (branchTypes.length === unconnectedBranches.length) {
        return `以下分支必须连线到节点: ${branchTypes.join(', ')}`
      }
    }
  }

  return undefined
}

export const validation = {
  title: commonValidators.title,
  'branches.*': validateBranch,
  'branches.*.conditions.*': validateCondition,
  branches: validateBranchConnections,
}
