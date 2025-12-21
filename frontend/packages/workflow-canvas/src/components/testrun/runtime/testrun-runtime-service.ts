/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { WorkflowService, ExecutionService, WorkflowExecutionEvent, AgentExecutionEvent } from '@test-agentstudio/api-client'
import { Emitter } from '@flowgram.ai/free-layout-editor'
import {
  ITestRunRuntimeService,
  StreamExecuteParams,
  ExecuteParams,
  ComponentExecuteParams,
  ComponentExecuteResult,
  StreamResponse,
  NodeStatus,
  InputInterruption,
  ExecuteResult,
  NodeReport,
  NodeExecutionStatus,
  ExecutionOptions,
  UnifiedExecutionParams,
  ExecutionEventWrapper,
} from './types'

/**
 * 执行状态管理器 - 负责统一管理执行状态和事件触发
 */
class ExecutionStatusManager {
  private reportEmitter: Emitter<NodeReport>
  private resetEmitter: Emitter<Record<string, never>>

  constructor(reportEmitter: Emitter<NodeReport>, resetEmitter: Emitter<Record<string, never>>) {
    this.reportEmitter = reportEmitter
    this.resetEmitter = resetEmitter
  }

  /**
   * 根据执行选项管理状态
   */
  manageExecutionStart(options?: ExecutionOptions): void {
    const { statusManagement = {} } = options || {}

    // 状态清理策略
    if (statusManagement.clearBeforeStart) {
      this.clearAllStatuses()
    } else if (statusManagement.triggerGlobalReset) {
      this.triggerGlobalReset()
    }

    // 事件处理策略初始化
    // 可以在这里添加其他初始化逻辑
  }

  /**
   * 设置节点状态
   */
  setNodeStatus(nodeId: string, status: NodeExecutionStatus, data?: { inputs?: unknown; outputs?: unknown; error?: string }): void {
    try {
      if (!this.nodeStartTimes) {
        this.nodeStartTimes = new Map<string, number>()
      }

      let startTime = this.nodeStartTimes.get(nodeId)
      let timeCost = 0

      if (status === NodeExecutionStatus.RUNNING) {
        startTime = Date.now()
        this.nodeStartTimes.set(nodeId, startTime)
        timeCost = 0
      } else {
        if (startTime) {
          timeCost = Date.now() - startTime
          this.nodeStartTimes.delete(nodeId)
        } else {
          timeCost = 100
        }
      }

      const nodeReport: NodeReport = {
        nodeID: nodeId,
        id: nodeId,
        status,
        snapshots: [
          {
            inputs: data?.inputs,
            outputs: data?.outputs,
            error: data?.error,
            timestamp: Date.now(),
          },
        ],
        outputs: data?.outputs || { error: data?.error },
        timestamp: Date.now(),
        startTime: startTime || Date.now(),
        timeCost: Math.max(0, timeCost),
        terminated: status === NodeExecutionStatus.FAILED || status === NodeExecutionStatus.CANCELED,
      }

      this.reportEmitter.fire(nodeReport)
    } catch (error) {
      const errorReport: NodeReport = {
        nodeID: nodeId,
        id: nodeId,
        status: NodeExecutionStatus.FAILED,
        snapshots: [
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now(),
          },
        ],
        outputs: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: Date.now(),
        startTime: Date.now(),
        timeCost: 0,
        terminated: true,
      }

      try {
        this.reportEmitter.fire(errorReport)
      } catch (emitError) {
        // Silent fail to avoid infinite loops
      }
    }
  }

  /**
   * 清空所有节点状态
   */
  clearAllStatuses(): void {
    this.resetEmitter.fire({} as Record<string, never>)
  }

  /**
   * 触发全局重置
   */
  triggerGlobalReset(): void {
    this.resetEmitter.fire({} as Record<string, never>)
  }
}

/**
 * TestRun Runtime 服务实现
 * 负责处理所有与后端接口的交互，testrun 组件只关心业务逻辑
 */
export class TestRunRuntimeService implements ITestRunRuntimeService {
  private isExecuting = false
  private executionCount = 0
  private activeExecutions = new Set<string>()
  private eventHandlers: ((event: StreamResponse) => void)[] = []
  private executionController?: AbortController
  private currentTaskId?: string
  private closeExecutionFunction?: () => void
  private currentExecutionParams?: StreamExecuteParams
  private nodeOutputs: Map<string, any> = new Map()
  private finalOutputs: any = null
  private streamMessageOutput: string = ''
  private nodeStartTimes: Map<string, number> = new Map()
  private hasError = false
  private runningNodes: Map<string, NodeReport> = new Map()
  private waitingForInputNodes: Set<string> = new Set() // 记录等待用户输入的节点

  private reportEmitter = new Emitter<NodeReport>()
  private resetEmitter = new Emitter<Record<string, never>>()
  private resultEmitter = new Emitter<{
    errors?: string[]
    result?: {
      inputs: any
      outputs: any
    }
  }>()

  public onNodeReportChange = this.reportEmitter.event
  public onReset = this.resetEmitter.event
  public onResultChanged = this.resultEmitter.event

  private statusManager: ExecutionStatusManager

  constructor() {
    this.statusManager = new ExecutionStatusManager(this.reportEmitter, this.resetEmitter)
  }

  async saveWorkflow(params: { workflow_id: string; space_id: string; schema: string }): Promise<void> {
    const result = await WorkflowService.saveWorkflow(params)

    if (result.code !== 200) {
      throw new Error(result.message || 'Save workflow failed')
    }
  }

  async validateWorkflow(params: {
    workflow_id: string
    space_id: string
    schema: string
    document?: any // WorkflowCanvas document for node validation
  }): Promise<{ valid: boolean; errors?: string[] }> {
    try {
      // 如果没有提供document，跳过节点校验
      if (!params.document) {
        console.warn('[TestRun] No document provided for node validation')
        return { valid: true }
      }

      // 参考提供的实现，校验所有节点的表单
      const allNodes = params.document.getAllNodes()
      const allForms = allNodes.map((node: any) => node.form)

      const formValidations = await Promise.all(
        allForms.map(async (form: any) => {
          try {
            return form?.validate()
          } catch (error) {
            console.warn('[TestRun] Form validation error:', error)
            return false
          }
        }),
      )

      const validations = formValidations.filter(validation => validation !== undefined)
      const isValid = validations.every(validation => validation === true)

      const errors: string[] = []

      // 收集具体的校验错误信息
      allNodes.forEach((node: any, index: number) => {
        const validationResult = formValidations[index]

        if (!validationResult && node?.data?.title) {
          errors.push(`节点 "${node.data.title}" 校验失败`)
        }
      })

      return {
        valid: isValid,
        errors: errors.length > 0 ? errors : undefined,
      }
    } catch (error) {
      console.error('[TestRun] Workflow validation error:', error)
      return { valid: false, errors: [error instanceof Error ? error.message : 'Validation failed'] }
    }
  }

  async executeWorkflow(params: ExecuteParams): Promise<ExecuteResult> {
    try {
      return {
        success: true,
        taskId: `task_${Date.now()}`,
        message: '工作流执行成功',
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
      }
    }
  }

  async execute(params: UnifiedExecutionParams, onEvent?: (event: StreamResponse) => void): Promise<any> {
    const { options = {} } = params

    this.statusManager.manageExecutionStart(options)

    if (params.component_id) {
      return this.executeSingleNode(params, options)
    } else {
      return this.executeWorkflowInternal(params, options, onEvent)
    }
  }

  private async executeSingleNode(params: UnifiedExecutionParams, options: ExecutionOptions): Promise<ComponentExecuteResult> {
    const { eventHandling = {} } = options

    const componentParams: ComponentExecuteParams = {
      space_id: params.space_id,
      id: params.id,
      version: params.version,
      inputs: params.inputs,
      component_id: params.component_id!,
      loop_id: params.loop_id,
    }

    if (eventHandling.enableNodeReport) {
      this.statusManager.setNodeStatus(params.component_id!, NodeExecutionStatus.RUNNING, { inputs: params.inputs })
    }

    try {
      const result = await ExecutionService.executeComponent(componentParams)

      if (result.code === 200 && eventHandling.enableNodeReport) {
        let outputData = null
        if (result.data?.payload?.output) {
          outputData = result.data.payload.output
        } else if (result.data?.output?.result) {
          outputData = result.data.output.result
        } else if (result.data?.output) {
          outputData = result.data.output
        } else {
          outputData = result.data
        }

        this.statusManager.setNodeStatus(params.component_id!, NodeExecutionStatus.SUCCESS, { inputs: params.inputs, outputs: outputData })
      } else if (result.code !== 200 && eventHandling.enableNodeReport) {
        const errorMessage = result.message || 'Component execution failed'
        this.statusManager.setNodeStatus(params.component_id!, NodeExecutionStatus.FAILED, { inputs: params.inputs, error: errorMessage })
      }

      return result
    } catch (error) {
      if (eventHandling.enableNodeReport) {
        const errorMessage = error instanceof Error ? error.message : '执行过程中发生未知错误'
        this.statusManager.setNodeStatus(params.component_id!, NodeExecutionStatus.FAILED, { inputs: params.inputs, error: errorMessage })
      }
      throw error
    }
  }

  private async executeWorkflowInternal(params: UnifiedExecutionParams, options: ExecutionOptions, onEvent?: (event: StreamResponse) => void): Promise<void> {
    // 生成唯一的执行ID
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    this.activeExecutions.add(executionId)
    this.executionCount++

    if (this.executionCount === 1) {
      this.isExecuting = true
    }
    this.eventHandlers = onEvent ? [onEvent] : []
    this.executionController = new AbortController()
    this.currentExecutionParams = {
      id: params.id,
      version: params.version,
      space_id: params.space_id,
      inputs: params.inputs,
      conversation_id: params.conversation_id || '',
    }
    this.nodeOutputs.clear()
    this.finalOutputs = null
    this.streamMessageOutput = ''
    this.nodeStartTimes.clear()
    this.hasError = false
    this.runningNodes.clear()

    try {
      const closeConnection = await ExecutionService.executeWorkflow(
        this.currentExecutionParams,
        executionEvent => {
          const streamEvent = this.convertExecutionEvent(executionEvent)
          if (onEvent) onEvent(streamEvent)
        },
        error => {
          console.error('流式执行错误:', error)
          this.executionCount--
          this.activeExecutions.delete(executionId)

          if (this.executionCount === 0) {
            this.isExecuting = false
          }

          this.hasError = true

          let errorMessage = 'Execution failed'
          if (error.message) {
            errorMessage = error.message
          } else if (typeof error === 'string') {
            errorMessage = error
          }

          if (error.code) {
            errorMessage = `[${error.code}] ${errorMessage}`
          }

          this.eventHandlers.forEach(handler =>
            handler({
              type: 'error',
              data: { message: errorMessage },
            }),
          )

          this.resultEmitter.fire({
            errors: [errorMessage],
          })
        },
        () => {
          this.executionCount--
          this.activeExecutions.delete(executionId)

          if (this.executionCount === 0) {
            this.isExecuting = false
          }

          if (!this.hasError) {
            const finalData = {
              inputs: this.currentExecutionParams?.inputs || {},
              outputs:
                this.finalOutputs ||
                (this.streamMessageOutput
                  ? {
                      responseContent: this.streamMessageOutput,
                    }
                  : {}),
            }

            this.eventHandlers.forEach(handler =>
              handler({
                type: 'completed',
                data: finalData,
              }),
            )

            this.resultEmitter.fire({
              result: finalData,
            })
          }
        },
        this.executionController.signal,
      )

      this.closeExecutionFunction = closeConnection
      this.executionController = undefined
    } catch (error) {
      console.error('流式执行失败:', error)
      this.isExecuting = false
      this.hasError = true

      this.resultEmitter.fire({
        errors: [error instanceof Error ? error.message : 'Execution failed'],
      })

      this.executionController = undefined
      throw error
    }
  }

  /**
   * 单节点测试（向后兼容）
   */
  async executeComponent(params: ComponentExecuteParams): Promise<ComponentExecuteResult> {
    // 记录开始时间
    const startTime = Date.now()
    this.nodeStartTimes.set(params.id, startTime)

    try {
      const result = await ExecutionService.executeComponent(params)

      if (result.code === 200) {
        // 计算真实执行时间
        const timeCost = Date.now() - startTime
        this.nodeStartTimes.delete(params.id)

        const nodeReport: NodeReport = {
          nodeID: params.id,
          id: params.id,
          status: 'success',
          outputs: result.data.output,
          timestamp: Date.now(),
          startTime: startTime,
          timeCost: Math.max(0, timeCost),
          terminated: false,
        }

        this.reportEmitter.fire(nodeReport)
      }

      return result
    } catch (error) {
      console.error('单节点测试失败:', error)

      // 计算真实执行时间
      const timeCost = Date.now() - startTime
      this.nodeStartTimes.delete(params.id)

      // 执行失败时也触发节点报告
      const nodeReport: NodeReport = {
        nodeID: params.id,
        id: params.id,
        status: 'error',
        outputs: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: Date.now(),
        startTime: startTime,
        timeCost: Math.max(0, timeCost),
        terminated: true,
      }

      this.reportEmitter.fire(nodeReport)

      return {
        code: 500,
        data: {
          output: null,
        },
        message: error instanceof Error ? error.message : 'Component execution failed',
      }
    }
  }

  /**
   * 开始流式执行 - 调用 api-client 的 ExecutionService
   */
  async startStreamExecution(params: StreamExecuteParams, onEvent: (event: StreamResponse) => void): Promise<void> {
    // 生成唯一的执行ID
    const executionId = `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    this.activeExecutions.add(executionId)
    this.executionCount++

    if (this.executionCount === 1) {
      this.isExecuting = true
    }
    this.eventHandlers = [onEvent]
    this.executionController = new AbortController()
    this.currentExecutionParams = params
    this.nodeOutputs.clear()
    this.finalOutputs = null
    this.streamMessageOutput = ''
    this.nodeStartTimes.clear()
    this.hasError = false
    this.runningNodes.clear()
    this.waitingForInputNodes.clear()

    this.resetEmitter.fire({} as Record<string, never>)

    try {
      const closeConnection = await ExecutionService.executeWorkflow(
        {
          id: params.id,
          version: params.version,
          space_id: params.space_id,
          inputs: params.inputs,
          conversation_id: params.conversation_id,
        },
        // 将 ExecutionService 的事件转换为我们的 StreamResponse 格式
        executionEvent => {
          const streamEvent = this.convertExecutionEvent(executionEvent)
          onEvent(streamEvent)
        },
        // 错误处理
        error => {
          console.error('流式执行错误:', error)
          this.executionCount--
          this.activeExecutions.delete(executionId)

          if (this.executionCount === 0) {
            this.isExecuting = false
          }

          this.hasError = true

          // 构建详细的错误消息
          let errorMessage = 'Execution failed'

          if (error.message) {
            errorMessage = error.message
          } else if (typeof error === 'string') {
            errorMessage = error
          }

          // 尝试从error对象中提取更多信息
          if (error.code) {
            errorMessage = `[${error.code}] ${errorMessage}`
          }

          onEvent({
            type: 'error',
            data: { message: errorMessage },
          })

          // 发送错误事件
          this.resultEmitter.fire({
            errors: [errorMessage],
          })
        },
        // 完成处理 - 当执行正常结束时调用
        () => {
          this.executionCount--
          this.activeExecutions.delete(executionId)

          if (this.executionCount === 0) {
            this.isExecuting = false
          }

          // 只有在没有错误的情况下才发送成功事件
          if (!this.hasError) {
            const finalData = {
              inputs: params.inputs || {},
              outputs:
                this.finalOutputs ||
                (this.streamMessageOutput
                  ? {
                      responseContent: this.streamMessageOutput,
                    }
                  : Object.fromEntries(this.nodeOutputs)),
            }

            // 发送完成事件给testrun-panel
            onEvent({
              type: 'completed',
              data: finalData,
            })

            // 发送结果变更事件
            this.resultEmitter.fire({ result: finalData })
          }
        },
      )

      // 保存关闭连接的函数，用于停止执行
      this.closeExecutionFunction = closeConnection
    } catch (error) {
      console.error('流式执行失败:', error)
      this.executionCount--

      if (this.executionCount === 0) {
        this.isExecuting = false
        this.activeExecutions.clear()
      }

      throw error
    }
  }

  /**
   * 停止流式执行
   */
  stopStreamExecution(): void {
    // 为所有运行中的节点发送Canceled状态
    for (const [nodeId, nodeReport] of this.runningNodes) {
      // 更新节点状态为Canceled
      const canceledReport = {
        ...nodeReport,
        status: NodeExecutionStatus.CANCELED,
        snapshots: [
          {
            ...nodeReport.snapshots[0],
            error: 'canceled by user',
            timestamp: Date.now(),
            outputs: { canceled: 'canceled by user' }, // 添加取消输出信息
          },
        ],
        outputs: { canceled: 'canceled by user' }, // 添加输出数据
        timeCost: Date.now() - (nodeReport.snapshots[0]?.timestamp || Date.now()),
      }

      // 发送取消状态的节点报告
      this.emitNodeReport(canceledReport)
    }

    // 发送用户取消事件给所有处理器
    this.eventHandlers.forEach(handler =>
      handler({
        type: 'error',
        data: {
          nodeId: 'workflow',
          message: 'canceled by user',
          timestamp: Date.now(),
          isUserCanceled: true,
        },
      }),
    )

    // 发送取消事件给testrun-panel
    this.resultEmitter.fire({
      errors: ['canceled by user'],
    })

    if (this.closeExecutionFunction) {
      this.closeExecutionFunction()
      this.closeExecutionFunction = undefined
    }

    if (this.executionController) {
      this.executionController.abort()
      this.executionController = undefined
    }

    this.isExecuting = false
    this.waitingForInputNodes.clear() // 清除等待输入的节点状态
    this.eventHandlers = []
    this.currentExecutionParams = undefined
    // 注意：不清空runningNodes，让已完成和取消的节点状态保持可见
  }

  /**
   * 恢复流式执行（输入中断后）
   */
  async resumeStreamExecution(input: { node_id: string; input_value: Record<string, unknown> }): Promise<void> {
    if (!this.currentExecutionParams) {
      throw new Error('没有可恢复的执行 - currentExecutionParams 为空')
    }

    // 清除该节点的等待输入标记，因为用户已经输入并继续运行
    this.waitingForInputNodes.delete(input.node_id)

    this.isExecuting = true

    try {
      // 使用 ExecutionService.handleUserInput 恢复执行
      const closeConnection = await ExecutionService.handleUserInput(
        {
          space_id: this.currentExecutionParams.space_id,
          id: this.currentExecutionParams.id,
          version: this.currentExecutionParams.version,
          conversation_id: this.currentExecutionParams.conversation_id,
          inputs: {
            node_id: input.node_id,
            input_value: input.input_value,
          },
        },
        executionEvent => {
          const streamEvent = this.convertExecutionEvent(executionEvent)
          this.eventHandlers.forEach(handler => handler(streamEvent))
        },
        error => {
          console.error('恢复执行错误:', error)
          this.isExecuting = false
          this.hasError = true

          // 构建详细的错误消息
          let errorMessage = 'Resume execution failed'

          if (error.message) {
            errorMessage = error.message
          } else if (typeof error === 'string') {
            errorMessage = error
          }

          // 尝试从error对象中提取更多信息
          if (error.code) {
            errorMessage = `[${error.code}] ${errorMessage}`
          }

          this.eventHandlers.forEach(handler =>
            handler({
              type: 'error',
              data: { message: errorMessage },
            }),
          )

          // 发送错误事件
          this.resultEmitter.fire({
            errors: [errorMessage],
          })
        },
        () => {
          this.isExecuting = false

          // 只有在没有错误的情况下才发送成功事件
          if (!this.hasError) {
            const finalData = {
              inputs: this.currentExecutionParams?.inputs || {},
              outputs:
                this.finalOutputs ||
                (this.streamMessageOutput
                  ? {
                      responseContent: this.streamMessageOutput,
                    }
                  : Object.fromEntries(this.nodeOutputs)),
            }

            // 发送完成事件给testrun-panel
            this.eventHandlers.forEach(handler =>
              handler({
                type: 'completed',
                data: finalData,
              }),
            )

            // 发送结果变更事件
            this.resultEmitter.fire({ result: finalData })
          }
        },
      )

      this.closeExecutionFunction = closeConnection
    } catch (error) {
      console.error('恢复执行失败:', error)
      this.isExecuting = false
      this.hasError = true

      const errorMessage = error instanceof Error ? error.message : 'Resume execution failed'

      // 发送错误事件
      this.eventHandlers.forEach(handler =>
        handler({
          type: 'error',
          data: { message: errorMessage },
        }),
      )

      this.resultEmitter.fire({
        errors: [errorMessage],
      })

      throw error
    }
  }

  /**
   * 取消执行
   */
  async cancelExecution(taskId: string): Promise<void> {
    try {
      this.stopStreamExecution()
    } catch (error) {
      console.error('取消执行失败:', error)
      throw error
    }
  }

  /**
   * 获取执行报告
   */
  async getExecutionReport(taskId: string): Promise<NodeReport[]> {
    try {
      return []
    } catch (error) {
      console.error('获取执行报告失败:', error)
      throw error
    }
  }

  /**
   * 事件监听器 - 可选实现
   */
  onStreamProgress?: (event: { nodeId: string; status: string; progress?: number }) => void
  onStreamStatusChange?: (status: NodeStatus) => void
  onInputInterruption?: (interruption: InputInterruption) => void
  onStreamCompleted?: (result: { inputs: any; outputs: any }) => void

  /**
   * 发送节点报告事件
   */
  private emitNodeReport(nodeReport: NodeReport): void {
    this.reportEmitter.fire(nodeReport)
  }

  /**
   * 公开方法：触发节点报告 - 用于外部组件直接触发状态更新
   */
  triggerNodeReport(nodeReport: NodeReport): void {
    this.emitNodeReport(nodeReport)
  }

  /**
   * 清空所有节点的状态 - 用于单节点测试前的清理
   */
  clearAllNodeStatuses(): void {
    this.statusManager.clearAllStatuses()
  }

  /**
   * 取消单节点测试并发送取消状态
   */
  cancelSingleComponent(componentId: string): void {
    this.statusManager.setNodeStatus(componentId, NodeExecutionStatus.CANCELED, { error: 'canceled by user' })
  }

  /**
   * 设置节点失败状态
   */
  setNodeFailedStatus(componentId: string, errorMessage: string): void {
    this.statusManager.setNodeStatus(componentId, NodeExecutionStatus.FAILED, { error: errorMessage })
  }

  /**
   * 设置所有运行中节点的失败状态（用于工作流级别错误）
   */
  setAllRunningNodesFailed(errorMessage: string): void {
    for (const [nodeId, _] of this.runningNodes) {
      this.statusManager.setNodeStatus(nodeId, NodeExecutionStatus.FAILED, { error: errorMessage })
    }
  }

  /**
   * 重置所有执行状态（用于关闭testrun-panel时）
   */
  resetAllExecutionStates(): void {
    this.isExecuting = false
    this.waitingForInputNodes.clear()
    this.runningNodes.clear()
    this.executionCount = 0
    this.activeExecutions.clear()
    this.eventHandlers = []
    this.currentExecutionParams = undefined
    this.nodeOutputs.clear()
    this.finalOutputs = null
    this.streamMessageOutput = ''
    this.nodeStartTimes.clear()
    this.hasError = false
  }

  /**
   * 获取当前运行中的节点列表
   */
  getRunningNodes(): string[] {
    try {
      if (!this.runningNodes) {
        this.runningNodes = new Map<string, NodeReport>()
      }
      return Array.from(this.runningNodes.keys())
    } catch (error) {
      return []
    }
  }

  /**
   * 检查是否正在执行（包括试运行和流式执行）
   */
  getIsExecuting(): boolean {
    return this.isExecuting
  }

  /**
   * 检查是否有中断等待用户输入
   */
  hasInputInterruption(): boolean {
    return this.waitingForInputNodes.size > 0
  }

  /**
   * 检查是否正在运行或有中断状态（包括等待用户输入）
   */
  getIsRunning(): boolean {
    return this.isExecuting || this.waitingForInputNodes.size > 0
  }

  /**
   * 判断是否为Input节点
   */
  private isInputNode(nodeId: string): boolean {
    return nodeId && (nodeId.toString().includes('input') || nodeId.toString().startsWith('input_') || nodeId.toString().includes('Input'))
  }

  /**
   * 将 ExecutionService 事件转换为 StreamResponse 格式
   */
  private convertExecutionEvent(executionEvent: ExecutionEventWrapper): StreamResponse {
    const isDirectEvent = (event: any): event is WorkflowExecutionEvent | AgentExecutionEvent => {
      return event && typeof event === 'object' && 'id' in event && 'status' in event
    }

    const isDataWrappedEvent = (event: any): event is { data: any } => {
      return event && typeof event === 'object' && 'data' in event
    }

    const getEventProperty = (event: any, property: string): any => {
      if (isDirectEvent(event) && property in event) {
        return (event as any)[property]
      }

      if (isDataWrappedEvent(event) && event.data?.payload && property in event.data.payload) {
        return event.data.payload[property]
      }

      return undefined
    }

    const status = getEventProperty(executionEvent, 'status')
    const description = getEventProperty(executionEvent, 'description')
    const eventId = getEventProperty(executionEvent, 'id')
    const interactionNode = getEventProperty(executionEvent, 'interaction_node')

    if (status === 'error' || (description && description.includes('失败'))) {
      this.hasError = true

      let errorMessage = 'Workflow execution failed'

      const message = getEventProperty(executionEvent, 'message')
      const error = getEventProperty(executionEvent, 'error')
      const code = getEventProperty(executionEvent, 'code')
      const isUserCanceled = getEventProperty(executionEvent, 'isUserCanceled')

      if (error) {
        errorMessage = error
      }else if (message && message !== 'Workflow execution failed') {
        errorMessage = message
      } else if (description && description !== 'Workflow execution failed') {
        errorMessage = description
      }

      if (code) {
        errorMessage = `[${code}] ${errorMessage}`
      }

      const dataStr = getEventProperty(executionEvent, 'dataStr')
      if (dataStr) {
        try {
          const dataObj = JSON.parse(dataStr)
          if (dataObj.message && dataObj.message !== errorMessage) {
            errorMessage = dataObj.message
          }
        } catch (e) {
          console.warn('Failed to parse dataStr:', e)
        }
      }

      const isCanceled = errorMessage === 'canceled by user' || isUserCanceled
      const eventId = getEventProperty(executionEvent, 'id')

      return {
        type: 'error',
        data: {
          nodeId: eventId || 'workflow',
          message: errorMessage,
          timestamp: Date.now(),
          isUserCanceled: isCanceled,
        },
      }
    }

    const interactionMsg = getEventProperty(executionEvent, 'interaction_msg')
    const inputs = getEventProperty(executionEvent, 'inputs')

    if (interactionNode) {
      // 当提问器等待用户输入时，确保节点状态保持为 RUNNING
      const nodeId = interactionNode || eventId

      // 标记节点为等待用户输入
      this.waitingForInputNodes.add(nodeId)

      // 检查节点是否已经在运行中
      let nodeReport = this.runningNodes.get(nodeId)

      if (!nodeReport) {
        // 如果节点不在运行中，创建一个 RUNNING 状态的节点报告
        const startTime = this.nodeStartTimes.get(nodeId) || Date.now()
        if (!this.nodeStartTimes.has(nodeId)) {
          this.nodeStartTimes.set(nodeId, startTime)
        }

        nodeReport = {
          nodeID: nodeId,
          status: NodeExecutionStatus.RUNNING,
          snapshots: [
            {
              inputs: inputs,
              timestamp: startTime,
            },
          ],
          outputs: undefined,
          timeCost: 0,
        }

        this.runningNodes.set(nodeId, nodeReport)
        this.emitNodeReport(nodeReport)
      } else {
        // 如果节点已经在运行中，确保状态保持为 RUNNING
        if (nodeReport.status !== NodeExecutionStatus.RUNNING) {
          nodeReport.status = NodeExecutionStatus.RUNNING
          nodeReport.timeCost = 0
          this.runningNodes.set(nodeId, nodeReport)
          this.emitNodeReport(nodeReport)
        }
      }

      return {
        type: 'input_required',
        data: {
          nodeId: nodeId,
          message: interactionMsg || 'Input required',
          requiredInputs: Object.keys(inputs || {}),
        },
      }
    }

    if (status === 'start') {
      const startTime = getEventProperty(executionEvent, 'start_time') ? new Date(getEventProperty(executionEvent, 'start_time')).getTime() : Date.now()

      const eventId = getEventProperty(executionEvent, 'id')
      this.nodeStartTimes.set(eventId, startTime)

      const inputs = getEventProperty(executionEvent, 'inputs')
      const nodeReport = {
        nodeID: eventId,
        status: NodeExecutionStatus.RUNNING,
        snapshots: [
          {
            inputs: inputs,
            timestamp: startTime,
          },
        ],
        outputs: undefined,
        timeCost: 0,
      }

      this.runningNodes.set(eventId, nodeReport)
      this.emitNodeReport(nodeReport)

      return {
        type: 'progress',
        data: {
          nodeId: eventId,
          status: 'processing',
          progress: 0,
        },
      }
    }

    // 处理节点完成事件
    if (executionEvent.status === 'finish') {
      const finishNodeId = executionEvent.id

      // 检查节点是否正在等待用户输入
      // 如果节点正在等待用户输入，不应该设置为 SUCCESS，应该保持 RUNNING 状态
      if (this.waitingForInputNodes.has(finishNodeId)) {
        // 不处理 finish 事件，保持节点为 RUNNING 状态
        return {
          type: 'progress',
          data: {
            nodeId: finishNodeId,
            status: 'waiting_for_input',
            timestamp: Date.now(),
          },
        }
      }

      // 存储节点输出
      if (executionEvent.outputs && executionEvent.id) {
        this.nodeOutputs.set(executionEvent.id, executionEvent.outputs)
      }

      // 从运行中节点移除
      this.runningNodes.delete(executionEvent.id)

      // 计算节点执行时间 - 使用后端的时间戳
      // 确保 nodeStartTimes 已初始化
      if (!this.nodeStartTimes) {
        this.nodeStartTimes = new Map<string, number>()
      }
      const startTime = this.nodeStartTimes.get(executionEvent.id)
      let timeCost = 0

      if (executionEvent.start_time && executionEvent.end_time) {
        // 使用后端提供的精确时间
        const startMs = new Date(executionEvent.start_time).getTime()
        const endMs = new Date(executionEvent.end_time).getTime()
        timeCost = endMs - startMs
      } else if (startTime) {
        // 回退到我们的计算方式
        timeCost = Date.now() - startTime
      }

      // 对于Input节点，需要特殊处理：在设置output的同时，也要将值赋值给input
      let nodeInputs = executionEvent.inputs
      const nodeOutputs = executionEvent.outputs

      // 如果是Input节点，将output也赋值给input，因为Input节点的输出就是用户的输入
      if (executionEvent.id && this.isInputNode(executionEvent.id) && nodeOutputs && typeof nodeOutputs === 'object') {
        nodeInputs = nodeOutputs
      }

      // 从等待输入集合中移除（如果存在）
      this.waitingForInputNodes.delete(finishNodeId)

      console.log('[TestRunRuntime] finish 事件 - 设置节点状态为 SUCCESS:', {
        nodeId: finishNodeId,
        timeCost,
        hasOutputs: !!nodeOutputs,
        waitingForInputNodes: Array.from(this.waitingForInputNodes),
      })

      // 发送节点状态报告，包含完整的输入输出数据
      this.emitNodeReport({
        nodeID: executionEvent.id,
        status: NodeExecutionStatus.SUCCESS,
        snapshots: [
          {
            inputs: nodeInputs,
            outputs: nodeOutputs,
            timestamp: executionEvent.end_time ? new Date(executionEvent.end_time).getTime() : Date.now(),
          },
        ],
        outputs: nodeOutputs,
        timeCost: Math.max(0, timeCost),
      })

      if (executionEvent.id && executionEvent.id.toString().startsWith('end_')) {
        if (this.streamMessageOutput) {
          this.finalOutputs = {
            responseContent: this.streamMessageOutput,
          }
        } else {
          this.finalOutputs = executionEvent.outputs || {}
        }

        return {
          type: 'completed',
          data: {
            inputs: this.currentExecutionParams?.inputs || {},
            outputs: this.finalOutputs,
          },
        }
      }

      return {
        type: 'node_status',
        data: {
          nodeId: executionEvent.id,
          status: 'completed',
          outputs: executionEvent.outputs,
          timestamp: executionEvent.timestamp || Date.now(),
        },
      }
    }

    // 处理错误事件
    if (executionEvent.status === 'failed' || executionEvent.status === 'error') {
      // 设置错误标志
      this.hasError = true

      // 从运行中节点移除
      this.runningNodes.delete(executionEvent.id)

      const errorMessage = executionEvent.error || 'Execution failed'

      // 发送错误节点报告
      this.emitNodeReport({
        nodeID: executionEvent.id,
        status: NodeExecutionStatus.FAILED,
        snapshots: [
          {
            error: errorMessage,
            timestamp: executionEvent.timestamp || Date.now(),
          },
        ],
        outputs: undefined,
        timeCost: 0,
      })

      return {
        type: 'error',
        data: {
          nodeId: executionEvent.id,
          message: errorMessage,
          timestamp: executionEvent.timestamp || Date.now(),
        },
      }
    }

    if (executionEvent.id === 'workflow_stream' && executionEvent.output_text && (executionEvent as any)._streamPayload?.node_id) {
      const streamPayload = (executionEvent as any)._streamPayload
      return {
        type: 'stream_message',
        data: {
          type: 'workflow',
          payload: {
            node_id: streamPayload.node_id,
            node_name: streamPayload.node_name,
            output: streamPayload.output || executionEvent.output_text,
            result_type: streamPayload.result_type || 'answer',
          },
        },
      }
    }

    return {
      type: 'progress',
      data: {
        nodeId: executionEvent.id,
        status: executionEvent.status || 'unknown',
        timestamp: executionEvent.timestamp || Date.now(),
      },
    }
  }
}

// 创建单例实例
export const testRunRuntimeService = new TestRunRuntimeService()
