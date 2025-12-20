/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import styled from 'styled-components'

// 工作流画布包装器样式
export const WorkflowCanvasWrapper = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
`

export const DocFreeFeatureOverview = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
`

export const EditorContainer = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
`

// 历史版本胶囊标签样式（与 Agents 页面一致的黄色样式）
export const HistoryVersionTag = styled.span`
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid #FDE68A; /* tailwind border-yellow-300 */
  background-color: #FFFBEB; /* tailwind bg-yellow-50 */
  color: #B45309; /* tailwind text-yellow-800 */
  font-size: 12px;
  line-height: 1;
`
