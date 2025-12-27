/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import type { WorkflowExecutionEvent } from '@test-agentstudio/api-client'
import type { AgentExecutionEvent as AgentExecutionEventType } from '@test-agentstudio/api-client/src/types'

export type AgentExecutionEvent = AgentExecutionEventType

export interface StreamExecuteParams {
  id: string
  version: string
  space_id: string
  inputs: Record<string, any>
  conversation_id: string
}

export interface ExecuteParams {
  workflow_id: string
  space_id: string
  inputs: Record<string, any>
}

export interface ComponentExecuteParams {
  space_id: string
  id: string
  version: string
  inputs: Record<string, any>
  component_id: string
  loop_id?: string
}

export interface ComponentExecuteResult {
  code: number
  data: {
    output: any
  }
  message?: string
}

export interface NodeStatus {
  nodeId: string
  status: string
  outputs?: any
  timestamp: number
}

export interface InputInterruption {
  nodeId: string
  message?: InteractionMessage
  requiredInputs?: string[]
}

export enum NodeExecutionStatus {
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELED = 'canceled',
}

export interface ExecutionOptions {
  statusManagement?: {
    clearBeforeStart?: boolean
    triggerNodeStatus?: boolean
    triggerGlobalReset?: boolean
  }

  eventHandling?: {
    enableNodeReport?: boolean
    enableProgressTracking?: boolean
    enableResultBroadcast?: boolean
  }

  mode?: 'workflow' | 'single-node' | 'resume'
}

export interface UnifiedExecutionParams {
  id: string
  version: string
  space_id: string
  inputs: Record<string, any>
  conversation_id?: string

  component_id?: string
  loop_id?: string

  options?: ExecutionOptions
}

export const normalizeNodeStatus = (status: string | any): NodeExecutionStatus => {
  const statusStr = (status || '').toString().toLowerCase()

  switch (statusStr) {
    case 'processing':
    case 'running':
      return NodeExecutionStatus.RUNNING

    case 'succeeded':
    case 'success':
    case 'completed':
      return NodeExecutionStatus.SUCCESS

    case 'failed':
    case 'error':
      return NodeExecutionStatus.FAILED

    case 'cancelled':
    case 'canceled':
      return NodeExecutionStatus.CANCELED

    default:
      return NodeExecutionStatus.RUNNING
  }
}

export interface StreamResponse {
  type: 'progress' | 'node_status' | 'input_required' | 'completed' | 'error' | 'stream_message'
  data: any
}

export interface SaveWorkflowParams {
  workflow_id: string
  version: string
  space_id: string
  schema: string
  document?: any
}

export interface ExecuteResult {
  success: boolean
  taskId?: string
  message?: string
  error?: string
}

export interface InteractionMessageItem {
  input_name?: string
  description?: string
  type?: string
  required?: boolean
}

export type InteractionMessage = string | InteractionMessageItem[]

export type ExecutionEventWrapper =
  | WorkflowExecutionEvent
  | AgentExecutionEvent
  | {
      data: {
        type: 'trace' | 'interaction' | 'agent'
        payload:
          | WorkflowExecutionEvent
          | AgentExecutionEvent
          | {
              interaction_node?: string
              interaction_msg?: InteractionMessage
            }
      }
    }

export interface NodeReport {
  nodeID: string
  status: string
  outputs?: any
  snapshots?: any[]
  timestamp?: number
  id?: string
  terminated?: boolean
  startTime?: number
  timeCost?: number
}

export interface ITestRunRuntimeService {
  saveWorkflow(params: SaveWorkflowParams): Promise<void>

  validateWorkflow(params: SaveWorkflowParams): Promise<{ valid: boolean; errors?: string[] }>

  executeWorkflow(params: ExecuteParams): Promise<ExecuteResult>

  startStreamExecution(params: StreamExecuteParams, onEvent: (event: StreamResponse) => void): Promise<void>

  executeComponent(params: ComponentExecuteParams): Promise<ComponentExecuteResult>

  stopStreamExecution(): void

  resumeStreamExecution(input: { node_id: string; input_value: Record<string, unknown> }): Promise<void>

  cancelExecution(taskId: string): Promise<void>

  getExecutionReport(taskId: string): Promise<NodeReport[]>

  onNodeReport?: (report: NodeReport) => void
  onResultChanged?: ((result: { inputs?: any; outputs?: any; errors?: string[] }) => void) | any
  onStreamProgress?: (event: { nodeId: string; status: string; progress?: number }) => void
  onStreamStatusChange?: (status: NodeStatus) => void
  onInputInterruption?: (interruption: InputInterruption) => void
  onStreamCompleted?: (result: { inputs: any; outputs: any }) => void
}
