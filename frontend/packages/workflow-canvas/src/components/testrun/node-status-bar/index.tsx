/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useEffect, useState } from 'react'

import { NodeReport } from '../runtime/types'
import { useCurrentEntity } from '@flowgram.ai/free-layout-editor'

import { testRunRuntimeService } from '../runtime/testrun-runtime-service'
import { NodeStatusRender } from './render'

const useNodeReport = () => {
  const node = useCurrentEntity()
  const [report, setReport] = useState<NodeReport>()

  useEffect(() => {
    const reportDisposer = testRunRuntimeService.onNodeReportChange(nodeReport => {
      if (nodeReport.nodeID === node.id) {
        setReport(nodeReport)
        return
      }

      if (nodeReport.nodeID.includes('.')) {
        const [loopId, blockId] = nodeReport.nodeID.split('.')
        if (node.id === blockId) {
          if (blockId.startsWith('block_start_') || blockId.startsWith('block_end_')) {
            return
          }
          setReport(nodeReport)
          return
        }
      }
    })
    const resetDisposer = testRunRuntimeService.onReset(() => {
      setReport(undefined)
    })
    return () => {
      reportDisposer?.dispose()
      resetDisposer?.dispose()
    }
  }, [node.id])

  return report
}

export const NodeStatusBar = () => {
  const report = useNodeReport()

  if (!report) {
    return null
  }

  return <NodeStatusRender report={report} />
}
