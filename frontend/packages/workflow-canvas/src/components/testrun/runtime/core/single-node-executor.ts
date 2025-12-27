/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { ExecutionService } from '@test-agentstudio/api-client'
import { Emitter } from '@flowgram.ai/free-layout-editor'

import {
  ComponentExecuteParams,
  ComponentExecuteResult,
  ExecutionOptions,
  NodeReport,
  NodeExecutionStatus,
} from '../types'
import { ExecutionStatusManager } from './execution-status-manager'

export class SingleNodeExecutor {
  private nodeStartTimes = new Map<string, number>()
  private reportEmitter = new Emitter<NodeReport>()

  public onNodeReportChange = this.reportEmitter.event

  constructor(private statusManager: ExecutionStatusManager) {}

  async execute(params: ComponentExecuteParams, options: ExecutionOptions): Promise<ComponentExecuteResult> {
    const { eventHandling = {} } = options
    const startTime = Date.now()
    this.nodeStartTimes.set(params.id, startTime)

    if (eventHandling.enableNodeReport) {
      this.statusManager.setNodeStatus(params.component_id!, NodeExecutionStatus.RUNNING, {
        inputs: params.inputs,
      })
    }

    try {
      const result = await ExecutionService.executeComponent(params)

      if (result.code === 200 && eventHandling.enableNodeReport) {
        let outputData = null
        if (result.data?.output?.result) {
          outputData = result.data.output.result
        } else if (result.data?.responseContent) {
          outputData = result.data.responseContent
        } else {
          outputData = result.data
        }

        this.statusManager.setNodeStatus(params.component_id!, NodeExecutionStatus.SUCCESS, {
          inputs: params.inputs,
          outputs: outputData,
        })
      } else if (result.code !== 200 && eventHandling.enableNodeReport) {
        const errorMessage = result.message || 'Component execution failed'
        this.statusManager.setNodeStatus(params.component_id!, NodeExecutionStatus.FAILED, {
          inputs: params.inputs,
          error: errorMessage,
        })
      }

      return result
    } catch (error) {
      if (eventHandling.enableNodeReport) {
        const errorMessage = error instanceof Error ? error.message : '执行过程中发生未知错误'
        this.statusManager.setNodeStatus(params.component_id!, NodeExecutionStatus.FAILED, {
          inputs: params.inputs,
          error: errorMessage,
        })
      }
      throw error
    }
  }

  cancel(nodeId: string): void {
    this.statusManager.setNodeStatus(nodeId, NodeExecutionStatus.CANCELED, {
      error: 'canceled by user',
    })
  }
}
