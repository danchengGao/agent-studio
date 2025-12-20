/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Select as SemiSelect, Input } from '@douyinfe/semi-ui'
import styled from 'styled-components'

// 自定义紧凑型 Select 组件
export const CompactSelect = styled(SemiSelect)`
  height: 24px;
  font-size: 12px;

  /* 选中项样式 */
  .semi-select-selection {
    font-size: 12px !important;
    margin-left: 4px !important;
  }

  .semi-select-selection-text {
    font-size: 12px !important;
  }

  /* 下拉选项样式 */
  .semi-select-option {
    font-size: 12px !important;
    line-height: 18px !important;
    padding: 4px 12px !important;
  }

  .semi-select-option-text {
    font-size: 12px !important;
  }

  /* 箭头图标大小 */
  .semi-select-arrow {
    width: 24px !important;
  }
`

// 自定义紧凑型 Input 组件
export const CompactInput = styled(Input)`
  height: 24px;
  font-size: 12px;

  .semi-input-wrapper {
    height: 24px !important;
    font-size: 12px !important;
  }

  .semi-input {
    height: 24px !important;
    font-size: 12px !important;
    padding: 0 8px !important;
  }

  .semi-input-suffix {
    font-size: 12px !important;
  }
`

// Code组件相关样式
export const LanguageSelectContainer = styled.div`
  margin-bottom: 12px;
`

// ErrorHandler组件相关样式
export const ErrorHandlerContainer = styled.div`
  padding: 8px;
`

export const DescriptionRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`

export const ConfigurationRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`

export const FlexItem = styled.div`
  flex: 1;
`

export const MarginLeftItem = styled(FlexItem)`
  margin-left: 12px;
`

export const SmallText = styled.span`
  font-size: 12px;
  color: #999;
`

export const ReturnContentContainer = styled.div`
  margin-top: 16px;
`

export const ReturnContentLabel = styled.div`
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
`

export const CodeEditorContainer = styled.div`
  border-radius: 4px;
  overflow: hidden;
`

export const CodeEditorText = styled.div`
  border: 1px solid #e5e7eb;
  border-radius: 4px;
`
