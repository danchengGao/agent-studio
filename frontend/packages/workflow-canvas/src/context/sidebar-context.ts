/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import React from 'react'

export interface SidebarContextValue {
  visible: boolean
  nodeId?: string
  setNodeId: (node: string | undefined) => void
  setVisible: (visible: boolean) => void
}

// TODO: maybe delete it
export const SidebarContext = React.createContext<SidebarContextValue>({
  visible: false,
  setNodeId: () => {},
  setVisible: () => {},
})

export const IsSidebarContext = React.createContext<boolean>(false)
