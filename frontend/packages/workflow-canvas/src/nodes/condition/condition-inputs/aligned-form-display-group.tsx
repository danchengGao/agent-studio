/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import React from 'react'
import styled from 'styled-components'

// 对齐的FormDisplay组容器 - 使用CSS Grid实现自动对齐
const AlignedFormDisplayGroupContainer = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  width: 100%;
  align-items: start;

  /* label列 */
  .label-column {
    color: #999;
    font-weight: 500;
    font-size: 12px;
    line-height: 16px;
    text-align: right;
    padding-right: 8px;
    min-width: 30px;
    white-space: nowrap;
    align-self: center;
  }

  /* content列 */
  .content-column {
    color: #333;
    font-size: 12px;
    line-height: 16px;
    min-width: 0;
    overflow: hidden;
    white-space: pre-wrap;
    word-wrap: break-word;
    word-break: break-word;
    overflow-wrap: break-word;

    /* 只有在内容确实很长且是单行时才截断 */
    &[data-is-long-string='true'] {
      white-space: nowrap;
      text-overflow: ellipsis;
      max-height: 20px;
      align-self: center;
    }
  }
`

// 对齐的FormDisplay项接口
interface AlignedFormDisplayItemProps {
  label: string
  content: React.ReactNode
}

// 对齐的FormDisplay项组件
const AlignedFormDisplayItem: React.FC<AlignedFormDisplayItemProps> = ({ label, content }) => {
  // 智能判断是否应该截断显示
  const shouldTruncate = React.useMemo(() => {
    if (typeof content !== 'string') {
      return false // 非字符串内容不截断
    }

    // 检查是否包含换行符
    if (content.includes('\n')) {
      return false // 包含换行符的内容不截断
    }

    // 检查字符串长度，超过一定长度且没有自然换行时才考虑截断
    return content.length > 50
  }, [content])

  return (
    <>
      <div className="label-column">{label}</div>
      <div className="content-column" data-is-long-string={shouldTruncate} title={typeof content === 'string' && shouldTruncate ? content : undefined}>
        {content}
      </div>
    </>
  )
}

// 对齐的FormDisplay组接口
interface AlignedFormDisplayGroupProps {
  children: React.ReactNode
}

// 对齐的FormDisplay组组件
export const AlignedFormDisplayGroup: React.FC<AlignedFormDisplayGroupProps> = ({ children }) => {
  return (
    <AlignedFormDisplayGroupContainer>
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement(child)) {
          const { label, content } = child.props

          return <AlignedFormDisplayItem key={child.key || index} label={label} content={content} />
        }
        return null
      })}
    </AlignedFormDisplayGroupContainer>
  )
}
