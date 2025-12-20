/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import styled from 'styled-components'

export const ValueDisplayStyle = styled.div`
  padding: 4px;
  width: 100%;
  height: 20px;
  font-size: 12px;
  line-height: 16px;
  display: flex;
  align-items: center;
  &.has-error {
    outline: red solid 1px;
  }
`
