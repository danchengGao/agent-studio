/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import styled from 'styled-components'

// 条件卡片容器（非sidebar模式）
export const ConditionCardContainer = styled.div`
  position: relative;
  margin-bottom: 8px;
  background: transparent;
  border-radius: 6px;
`

// 条件卡片标签
export const ConditionCardLabel = styled.div`
  font-size: 13px;
  color: #1f2329;
  font-weight: 500;
  margin-bottom: 4px;
  padding: 4px 8px;
  background: #f5f5f5;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
`

// 条件内容容器
export const ConditionContentContainer = styled.div`
  padding: 8px;
  background: #fafafa;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  min-height: 32px;
  margin-bottom: 4px;

  &.empty {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #999;
    font-size: 12px;
    min-height: 32px;
  }
`

// 单个条件显示
export const ConditionItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
  font-size: 12px;
  color: #333;
  line-height: 1.4;

  &:last-child {
    margin-bottom: 0;
  }
`

// 条件标签（半标签样式）
export const ConditionTag = styled.div`
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  background: white;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 12px;
  color: #333;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

// 逻辑操作符显示
export const LogicOperator = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 20px;
  background: #f0f0f0;
  border: 1px solid #d0d0d0;
  border-radius: 3px;
  font-size: 12px;
  color: #666;
  margin: 0 4px;
  font-weight: 500;
`

// 端口容器
export const PortContainer = styled.div<{ top?: number; style?: React.CSSProperties }>`
  position: absolute;
  right: -12px;
  top: ${props => props.top || 0}px;
  z-index: 10;
  ${props => props.style && { ...props.style }}
`

// 分割线
export const Divider = styled.div`
  height: 1px;
  background: #e0e0e0;
  margin: 4px 0;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 16px;
    right: 16px;
    height: 1px;
    background: #e0e0e0;
  }
`

// 操作符图标容器
export const OperatorIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin: 0 4px;
  color: #666;
  font-size: 14px;
`
