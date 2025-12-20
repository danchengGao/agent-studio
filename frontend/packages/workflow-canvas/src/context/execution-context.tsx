/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react'
import { NodeExecutionStatus } from '@test-agentstudio/api-client'

interface ExecutionContextType {
  nodeStatuses: Map<string, NodeExecutionStatus>
  isExecuting: boolean
  updateNodeStatus: (nodeId: string, status: NodeExecutionStatus) => void
  setExecuting: (executing: boolean) => void
  clearExecution: () => void
  getNodeStatus: (nodeId: string) => NodeExecutionStatus | undefined
}

const ExecutionContext = createContext<ExecutionContextType | undefined>(undefined)

export const useExecutionContext = () => {
  const context = useContext(ExecutionContext)
  if (!context) {
    throw new Error('useExecutionContext must be used within an ExecutionProvider')
  }
  return context
}

interface ExecutionProviderProps {
  children: ReactNode
}

export const ExecutionProvider: React.FC<ExecutionProviderProps> = ({ children }) => {
  const [nodeStatuses, setNodeStatuses] = useState<Map<string, NodeExecutionStatus>>(new Map())
  const [isExecuting, setIsExecuting] = useState(false)

  const updateNodeStatus = useCallback((nodeId: string, status: NodeExecutionStatus) => {
    setNodeStatuses(prev => {
      const newMap = new Map(prev)
      newMap.set(nodeId, status)
      return newMap
    })
  }, [])

  const setExecuting = useCallback((executing: boolean) => {
    setIsExecuting(executing)
  }, [])

  const clearExecution = useCallback(() => {
    setNodeStatuses(new Map())
    setIsExecuting(false)
  }, [])

  const getNodeStatus = useCallback(
    (nodeId: string) => {
      return nodeStatuses.get(nodeId)
    },
    [nodeStatuses],
  )

  const value: ExecutionContextType = useMemo(
    () => ({
      nodeStatuses,
      isExecuting,
      updateNodeStatus,
      setExecuting,
      clearExecution,
      getNodeStatus,
    }),
    [nodeStatuses, isExecuting, updateNodeStatus, setExecuting, clearExecution, getNodeStatus],
  )

  return <ExecutionContext.Provider value={value}>{children}</ExecutionContext.Provider>
}
