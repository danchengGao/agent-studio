/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { WorkflowService, ExecutionService } from '@test-agentstudio/api-client'
import { Emitter } from '@flowgram.ai/free-layout-editor'

import {
  ITestRunRuntimeService,
  SaveWorkflowParams,
  ExecuteParams,
  ExecuteResult,
  StreamExecuteParams,
  ComponentExecuteParams,
  ComponentExecuteResult,
  NodeReport,
  NodeExecutionStatus,
  UnifiedExecutionParams,
  StreamResponse,
} from './types'

import {
  ExecutionStatusManager,
  EventConverter,
  WorkflowExecutor,
  SingleNodeExecutor,
} from './core'

export class TestRunRuntimeService implements ITestRunRuntimeService {
  private reportEmitter = new Emitter<NodeReport>()
  private resetEmitter = new Emitter<Record<string, never>>()
  private resultEmitter = new Emitter<{
    errors?: string[]
    result?: {
      inputs: any
      outputs: any
    }
  }>()

  private statusManager: ExecutionStatusManager
  private eventConverter: EventConverter
  private workflowExecutor: WorkflowExecutor
  private singleNodeExecutor: SingleNodeExecutor

  public onNodeReportChange = this.reportEmitter.event
  public onReset = this.resetEmitter.event
  public onResultChanged = this.resultEmitter.event

  constructor() {
    this.statusManager = new ExecutionStatusManager(this.reportEmitter, this.resetEmitter)
    this.eventConverter = new EventConverter()
    this.workflowExecutor = new WorkflowExecutor(this.eventConverter, this.statusManager)
    this.singleNodeExecutor = new SingleNodeExecutor(this.statusManager)
  }

  async saveWorkflow(params: SaveWorkflowParams): Promise<void> {
    const result = await WorkflowService.saveWorkflow({
      workflow_id: params.workflow_id,
      workflow_version: params.version,
      space_id: params.space_id,
      schema: params.schema,
    })

    if (result.code !== 200) {
      throw new Error(result.msg || 'Save workflow failed')
    }
  }

  async validateWorkflow(params: SaveWorkflowParams): Promise<{ valid: boolean; errors?: string[] }> {
    try {
      if (!params.document) {
        console.warn('[TestRun] No document provided for node validation')
        return { valid: true }
      }

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
      return this.singleNodeExecutor.execute(
        {
          space_id: params.space_id,
          id: params.id,
          version: params.version,
          inputs: params.inputs,
          component_id: params.component_id!,
          loop_id: params.loop_id,
          conversation_id: params.conversation_id,
        },
        options,
      )
    } else {
      return this.workflowExecutor.execute(
        {
          id: params.id,
          version: params.version,
          space_id: params.space_id,
          inputs: params.inputs,
          conversation_id: params.conversation_id,
        },
        options,
        onEvent,
      )
    }
  }

  async executeComponent(params: ComponentExecuteParams): Promise<ComponentExecuteResult> {
    const startTime = Date.now()
    const nodeReport: NodeReport = {
      nodeID: params.id,
      id: params.id,
      status: 'success',
      outputs: null,
      timestamp: Date.now(),
      startTime: startTime,
      timeCost: 0,
      terminated: false,
    }

    try {
      const result = await ExecutionService.executeComponent(params)

      if (result.code === 200) {
        const timeCost = Date.now() - startTime
        nodeReport.outputs = result.data?.payload?.output ?? result.data?.output?.result ?? result.data?.output ?? result.data
        nodeReport.timeCost = Math.max(0, timeCost)
        this.reportEmitter.fire(nodeReport)
      }

      return result
    } catch (error) {
      console.error('单节点测试失败:', error)

      const timeCost = Date.now() - startTime

      const errorReport: NodeReport = {
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

      this.reportEmitter.fire(errorReport)

      return {
        code: 500,
        data: {
          output: null,
        },
        message: error instanceof Error ? error.message : 'Component execution failed',
      }
    }
  }

  async startStreamExecution(params: StreamExecuteParams, onEvent: (event: StreamResponse) => void): Promise<void> {
    return this.workflowExecutor.execute(params, {}, onEvent)
  }

  stopStreamExecution(): void {
    this.workflowExecutor.stop()
  }

  async resumeStreamExecution(input: { node_id: string; input_value: Record<string, unknown> }): Promise<void> {
    return this.workflowExecutor.resume(input)
  }

  async cancelExecution(taskId: string): Promise<void> {
    try {
      this.stopStreamExecution()
    } catch (error) {
      console.error('取消执行失败:', error)
      throw error
    }
  }

  async getExecutionReport(taskId: string): Promise<NodeReport[]> {
    try {
      return []
    } catch (error) {
      console.error('获取执行报告失败:', error)
      throw error
    }
  }

  triggerNodeReport(nodeReport: NodeReport): void {
    this.reportEmitter.fire(nodeReport)
  }

  clearAllNodeStatuses(): void {
    this.statusManager.clearAllStatuses()
  }

  async cancelSingleComponent(componentId: string): Promise<void> {
    await this.singleNodeExecutor.cancel(componentId)
  }

  setNodeFailedStatus(componentId: string, errorMessage: string): void {
    this.statusManager.setNodeStatus(componentId, NodeExecutionStatus.FAILED, { error: errorMessage })
  }

  setAllRunningNodesFailed(errorMessage: string): void {
    const runningNodes = this.statusManager.getRunningNodes()
    for (const nodeId of runningNodes) {
      this.statusManager.setNodeStatus(nodeId, NodeExecutionStatus.FAILED, { error: errorMessage })
    }
  }

  resetAllExecutionStates(): void {
    this.workflowExecutor.reset()
    this.statusManager.clearAllStatuses()
  }

  getRunningNodes(): string[] {
    return this.statusManager.getRunningNodes()
  }

  getIsExecuting(): boolean {
    return this.workflowExecutor.getIsExecuting()
  }

  hasInputInterruption(): boolean {
    return this.statusManager.hasInputInterruption()
  }

  getIsRunning(): boolean {
    return this.workflowExecutor.getIsExecuting() || this.statusManager.hasInputInterruption()
  }
}

export const testRunRuntimeService = new TestRunRuntimeService()
