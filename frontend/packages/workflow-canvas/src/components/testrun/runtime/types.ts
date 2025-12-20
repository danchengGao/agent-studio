/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

// 流式执行参数接口
export interface StreamExecuteParams {
  id: string
  version: string
  space_id: string
  inputs: Record<string, any>
  conversation_id: string
}

// 工作流执行参数（兼容现有实现）
export interface ExecuteParams {
  workflow_id: string
  space_id: string
  inputs: Record<string, any>
}

// 单节点测试参数接口
export interface ComponentExecuteParams {
  space_id: string
  id: string
  version: string
  inputs: Record<string, any>
  component_id: string
  loop_id?: string
}

// 单节点测试结果接口
export interface ComponentExecuteResult {
  code: number
  data: {
    output: any
  }
  message?: string
}

// 节点状态接口
export interface NodeStatus {
  nodeId: string
  status: string
  outputs?: any
  timestamp: number
}

// 输入中断接口
export interface InputInterruption {
  nodeId: string
  message?: string
  requiredInputs?: string[]
}

export enum NodeExecutionStatus {
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELED = 'canceled',
}

// 执行选项配置
export interface ExecutionOptions {
  // 状态管理策略
  statusManagement?: {
    clearBeforeStart?: boolean
    triggerNodeStatus?: boolean
    triggerGlobalReset?: boolean
  }

  // 事件处理策略
  eventHandling?: {
    enableNodeReport?: boolean
    enableProgressTracking?: boolean
    enableResultBroadcast?: boolean
  }

  // 执行模式
  mode?: 'workflow' | 'single-node' | 'resume'
}

// 统一执行参数
export interface UnifiedExecutionParams {
  // 基础参数
  id: string
  version: string
  space_id: string
  inputs: Record<string, any>
  conversation_id?: string

  // 单节点特有参数
  component_id?: string
  loop_id?: string

  // 执行选项
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

// 流式响应事件
export interface StreamResponse {
  type: 'progress' | 'node_status' | 'input_required' | 'completed' | 'error' | 'stream_message'
  data: any
}

// 工作流保存参数
export interface SaveWorkflowParams {
  workflow_id: string
  space_id: string
  schema: string
  document?: any // WorkflowCanvas document for node validation
}

// 执行结果接口
export interface ExecuteResult {
  success: boolean
  taskId?: string
  message?: string
  error?: string
}

// 执行事件类型，支持当前实际使用的消息格式
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
              interaction_msg?: string
            }
      }
    }

// 节点报告接口
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

// TestRun Runtime 服务接口 - 负责保存和执行
export interface ITestRunRuntimeService {
  // 保存工作流
  saveWorkflow(params: SaveWorkflowParams): Promise<void>

  // 验证工作流
  validateWorkflow(params: SaveWorkflowParams): Promise<{ valid: boolean; errors?: string[] }>

  // 执行工作流（非流式）
  executeWorkflow(params: ExecuteParams): Promise<ExecuteResult>

  // 开始流式执行
  startStreamExecution(params: StreamExecuteParams, onEvent: (event: StreamResponse) => void): Promise<void>

  // 单节点测试
  executeComponent(params: ComponentExecuteParams): Promise<ComponentExecuteResult>

  // 停止流式执行
  stopStreamExecution(): void

  // 恢复流式执行（输入中断后）
  resumeStreamExecution(input: { node_id: string; input_value: Record<string, unknown> }): Promise<void>

  // 取消执行
  cancelExecution(taskId: string): Promise<void>

  // 获取执行报告
  getExecutionReport(taskId: string): Promise<NodeReport[]>

  // 监听执行事件
  onNodeReport?: (report: NodeReport) => void
  onResultChanged?: (result: { inputs?: any; outputs?: any; errors?: string[] }) => void
  onStreamProgress?: (event: { nodeId: string; status: string; progress?: number }) => void
  onStreamStatusChange?: (status: NodeStatus) => void
  onInputInterruption?: (interruption: InputInterruption) => void
  onStreamCompleted?: (result: { inputs: any; outputs: any }) => void
}
