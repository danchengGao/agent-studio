/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useEffect } from 'react'

import { TestRunFormMeta, TestRunFormMetaItem } from '../testrun-form/type'

const getDefaultValue = (meta: TestRunFormMetaItem) => {
  if (['object', 'array', 'map'].includes(meta.type) && typeof meta.defaultValue === 'string') {
    try {
      return JSON.parse(meta.defaultValue)
    } catch {
      // 解析失败时返回原字符串，避免运行时错误
      return meta.defaultValue
    }
  }
  return meta.defaultValue
}

export const useSyncDefault = (params: {
  formMeta: TestRunFormMeta
  values: Record<string, unknown>
  setValues: (values: Record<string, unknown>) => void
}) => {
  const { formMeta, values, setValues } = params

  // 添加对 formMeta 长度的依赖，确保数组内容变化时也能触发
  const formMetaKey = JSON.stringify(formMeta.map(m => ({ name: m.name, defaultValue: m.defaultValue })))

  useEffect(() => {
    // 如果没有 formMeta，跳过
    if (!formMeta || formMeta.length === 0) {
      return
    }

    // 构建包含所有默认值的完整对象和字段名集合
    const defaultValues: Record<string, unknown> = {}
    const fieldNames = new Set<string>()
    formMeta.forEach(meta => {
      fieldNames.add(meta.name)
      if (meta.defaultValue !== undefined) {
        defaultValues[meta.name] = getDefaultValue(meta)
      }
    })

    // 始终将默认值合并到现有值中
    // 用户编辑的值（在 values 中）会覆盖默认值
    // 但只保留在新 formMeta 中定义的字段的值
    setValues(prevValues => {
      const mergedValues = { ...defaultValues }

      // 只保留用户已编辑的、且在新 formMeta 中定义的字段的值
      Object.keys(prevValues).forEach(key => {
        if (fieldNames.has(key) && prevValues[key] !== undefined && prevValues[key] !== null && prevValues[key] !== '') {
          mergedValues[key] = prevValues[key]
        }
      })

      return mergedValues
    })
  }, [formMetaKey])
}
