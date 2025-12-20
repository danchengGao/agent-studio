/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { ReactNode, useMemo } from 'react'

import { FormDisplayStyle } from './styles'

export interface FormDisplayProps {
  label: string
  content: ReactNode
}

export function FormDisplay(props: FormDisplayProps) {
  // 智能判断是否应该截断显示
  const shouldTruncate = useMemo(() => {
    if (typeof props.content !== 'string') {
      return false // 非字符串内容不截断
    }

    // 检查是否包含换行符
    if (props.content.includes('\n')) {
      return false // 包含换行符的内容不截断
    }

    // 检查字符串长度，超过一定长度且没有自然换行时才考虑截断
    return props.content.length > 50
  }, [props.content])

  return (
    <FormDisplayStyle>
      <span className="form-label">{props.label}</span>
      <span
        className="form-content"
        data-is-long-string={shouldTruncate}
        title={typeof props.content === 'string' && shouldTruncate ? props.content : undefined}
      >
        {props.content}
      </span>
    </FormDisplayStyle>
  )
}
