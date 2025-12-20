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

  useEffect(() => {
    // 构建包含所有默认值的完整对象
    const defaultValues: Record<string, unknown> = {}
    formMeta.forEach(meta => {
      if (meta.defaultValue !== undefined) {
        defaultValues[meta.name] = getDefaultValue(meta)
      }
    })

    // 始终将默认值合并到现有值中
    // 用户编辑的值（在 values 中）会覆盖默认值
    setValues(prevValues => {
      const mergedValues = { ...defaultValues }

      // 保留用户已编辑的值
      Object.keys(prevValues).forEach(key => {
        if (prevValues[key] !== undefined && prevValues[key] !== null && prevValues[key] !== '') {
          mergedValues[key] = prevValues[key]
        }
      })

      return mergedValues
    })
  }, [formMeta])
}
