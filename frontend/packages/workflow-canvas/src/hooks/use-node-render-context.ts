/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useContext } from 'react'

import { NodeRenderContext } from '../context'
import type { NodeRenderReturnType } from '@flowgram.ai/free-layout-editor'

export function useNodeRenderContext(): NodeRenderReturnType {
  return useContext(NodeRenderContext)
}
