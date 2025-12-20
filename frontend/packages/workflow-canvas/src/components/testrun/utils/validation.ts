/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { TestRunFormMetaItem } from '../testrun-form/type'

/**
 * 验证必填字段是否都已填写
 * @param values 当前表单值
 * @param formMeta 表单元数据
 * @returns 缺失的必填字段名称数组
 */
export const validateRequiredFields = (values: Record<string, unknown>, formMeta: TestRunFormMetaItem[]): string[] => {
  const missingRequired: string[] = []

  for (const field of formMeta) {
    if (field.required) {
      const value = values[field.name]

      // 检查是否为空值
      if (value === undefined || value === null || value === '') {
        missingRequired.push(field.name)
      } else if (Array.isArray(value) && value.length === 0) {
        // 空数组也算未填写
        missingRequired.push(field.name)
      } else if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
        // 空对象也算未填写
        missingRequired.push(field.name)
      }
    }
  }

  return missingRequired
}

/**
 * 验证输入参数的类型是否正确
 * @param values 当前表单值
 * @param formMeta 表单元数据
 * @returns 类型验证错误信息数组
 */
export const validateBasicTypes = (values: Record<string, unknown>, formMeta: TestRunFormMetaItem[]): string[] => {
  const typeErrors: string[] = []

  for (const field of formMeta) {
    const value = values[field.name]

    // 如果值为空，跳过类型验证（留作required字段验证）
    if (value === undefined || value === null || value === '') {
      continue
    }

    // 根据字段类型进行验证
    switch (field.type) {
      case 'array':
        if (!Array.isArray(value)) {
          typeErrors.push(`字段 "${field.name}" 类型不匹配，期望数组类型，请输入有效的数组格式，例如：[] 或 ["item1", "item2"]`)
        }
        break
      case 'object':
        if (typeof value !== 'object' || Array.isArray(value)) {
          typeErrors.push(`字段 "${field.name}" 类型不匹配，期望对象类型，请输入有效的对象格式，例如：{} 或 {"key": "value"}`)
        }
        break
      case 'boolean':
        if (typeof value !== 'boolean') {
          typeErrors.push(`字段 "${field.name}" 类型不匹配，期望布尔值类型`)
        }
        break
      case 'integer':
        if (typeof value !== 'number' || !Number.isInteger(value)) {
          typeErrors.push(`字段 "${field.name}" 类型不匹配，期望整数类型`)
        }
        break
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          typeErrors.push(`字段 "${field.name}" 类型不匹配，期望数字类型`)
        }
        break
      case 'string':
        if (typeof value !== 'string') {
          typeErrors.push(`字段 "${field.name}" 类型不匹配，期望字符串类型`)
        }
        break
      // 对于复杂类型（array的itemsType等），可以进行更深入的验证
      default:
        // 对于未知类型，暂时不进行严格验证
        break
    }

    // 对于数组类型，如果指定了itemsType，验证数组元素类型
    if (field.type === 'array' && Array.isArray(value) && field.itemsType) {
      for (let i = 0; i < value.length; i++) {
        const element = value[i]
        let isValid = true

        switch (field.itemsType) {
          case 'boolean':
            isValid = typeof element === 'boolean'
            break
          case 'integer':
            isValid = typeof element === 'number' && Number.isInteger(element)
            break
          case 'number':
            isValid = typeof element === 'number' && !isNaN(element)
            break
          case 'string':
            isValid = typeof element === 'string'
            break
          case 'object':
            isValid = typeof element === 'object' && element !== null && !Array.isArray(element)
            break
          case 'array':
            isValid = Array.isArray(element)
            break
          default:
            // 对于未知类型，允许任何值
            isValid = true
            break
        }

        if (!isValid) {
          const typeName =
            field.itemsType === 'boolean'
              ? '布尔值'
              : field.itemsType === 'integer'
                ? '整数'
                : field.itemsType === 'number'
                  ? '数字'
                  : field.itemsType === 'string'
                    ? '字符串'
                    : field.itemsType === 'object'
                      ? '对象'
                      : field.itemsType === 'array'
                        ? '数组'
                        : field.itemsType

          typeErrors.push(`字段 "${field.name}" 数组第${i + 1}个元素类型不匹配，期望${typeName}类型，实际为${typeof element}类型`)
        }
      }
    }
  }

  return typeErrors
}
