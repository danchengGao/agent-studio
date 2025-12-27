/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Emitter } from '@flowgram.ai/free-layout-editor'
import { NodeExecutionStatus, NodeReport } from '../types'

export class ExecutionStatusManager {
  private nodeStartTimes: Map<string, number> = new Map()
  private runningNodes: Map<string, NodeReport> = new Map()
  private waitingForInputNodes: Set<string> = new Set()

  constructor(
    private reportEmitter: Emitter<NodeReport>,
    private resetEmitter: Emitter<Record<string, never>>,
  ) {}

  setNodeStatus(
    nodeId: string,
    status: NodeExecutionStatus,
    data?: { inputs?: unknown; outputs?: unknown; error?: string },
  ): void {
    try {
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

      if (status === NodeExecutionStatus.RUNNING) {
        this.runningNodes.set(nodeId, nodeReport)
      } else {
        this.runningNodes.delete(nodeId)
      }

      this.reportEmitter.fire(nodeReport)
    } catch (error) {
      this.reportEmitter.fire({
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
      })
    }
  }

  clearAllStatuses(): void {
    this.nodeStartTimes.clear()
    this.runningNodes.clear()
    this.waitingForInputNodes.clear()
    this.resetEmitter.fire({} as Record<string, never>)
  }

  addWaitingForInput(nodeId: string): void {
    this.waitingForInputNodes.add(nodeId)
  }

  removeWaitingForInput(nodeId: string): void {
    this.waitingForInputNodes.delete(nodeId)
  }

  getRunningNodes(): string[] {
    return Array.from(this.runningNodes.keys())
  }

  hasInputInterruption(): boolean {
    return this.waitingForInputNodes.size > 0
  }

  clearWaitingForInput(): void {
    this.waitingForInputNodes.clear()
  }

  triggerGlobalReset(): void {
    this.resetEmitter.fire({} as Record<string, never>)
  }

  manageExecutionStart(options?: { statusManagement?: { clearBeforeStart?: boolean; triggerGlobalReset?: boolean } }): void {
    const { statusManagement = {} } = options || {}

    if (statusManagement.clearBeforeStart) {
      this.clearAllStatuses()
    } else if (statusManagement.triggerGlobalReset) {
      this.triggerGlobalReset()
    }
  }
}
