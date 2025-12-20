/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FC } from 'react'
import { IconButton, Tooltip } from '@douyinfe/semi-ui'
import { Play } from 'lucide-react'
import { usePanelManager } from '@flowgram.ai/panel-manager-plugin'
import { FlowNodeEntity } from '@flowgram.ai/free-layout-editor'

import { testDebugPanelFactory, type NodeTestData } from '../test-debug-panel'

interface TestDebugButtonProps {
  node: FlowNodeEntity
  workflowId?: string
  spaceId?: string
}

export const TestDebugButton: FC<TestDebugButtonProps> = ({ node, workflowId, spaceId }) => {
  const panelManager = usePanelManager()

  const getNodeData = (): NodeTestData | null => {
    try {
      return {
        id: node.id,
        space_id: spaceId || '',
        version: '',
        loop_id: '',
      }
    } catch (error) {
      return null
    }
  }

  const handleTestNode = (e: React.MouseEvent) => {
    e.stopPropagation() // 防止事件冒泡

    const nodeData = getNodeData()

    if (!nodeData) {
      return
    }

    panelManager.open(testDebugPanelFactory.key, 'right', {
      props: {
        nodeData,
        workflowId,
        spaceId,
      },
    })
  }

  return (
    <Tooltip content="测试节点">
      <IconButton theme="borderless" icon={<Play size={16} />} onClick={handleTestNode} />
    </Tooltip>
  )
}
