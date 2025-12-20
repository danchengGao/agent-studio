/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import styled from 'styled-components'

export const FONT_FAMILY = 'HarmonyOS Sans, HarmonyOS Sans SC, system-ui, sans-serif'

// 加载容器样式
export const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  flex-direction: column;
  gap: 20px;
  font-family: ${FONT_FAMILY};
`

export const LoadingText = styled.div`
  font-size: 16px;
  color: #666;
  font-family: ${FONT_FAMILY};
`

// 错误容器样式
export const ErrorContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  font-family: ${FONT_FAMILY};
`
