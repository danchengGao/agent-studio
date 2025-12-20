/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import styled from 'styled-components'

export const WorkflowOperationContainer = styled.div`
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  justify-content: center;
  min-width: 360px;
  pointer-events: none;
  gap: 8px;

  z-index: 20;
`

export const WorkflowControlSection = styled.div`
  display: flex;
  align-items: center;
  background-color: #fff;
  border: 1px solid rgba(68, 83, 130, 0.25);
  border-radius: 10px;
  box-shadow:
    rgba(0, 0, 0, 0.04) 0px 2px 6px 0px,
    rgba(0, 0, 0, 0.02) 0px 4px 12px 0px;
  column-gap: 2px;
  min-height: 40px;
  padding: 0 4px;
  pointer-events: auto;
`
