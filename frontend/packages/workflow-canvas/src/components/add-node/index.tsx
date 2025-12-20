/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Button } from '@douyinfe/semi-ui'
import { Plus } from 'lucide-react'

import { useAddNode } from './use-add-node'

export const AddNode = () => {
  const addNode = useAddNode()

  return (
    <Button
      data-testid="add-node"
      icon={<Plus />}
      color="highlight"
      style={{ backgroundColor: 'rgba(171,181,255,0.3)', borderRadius: '8px' }}
      onClick={e => {
        const rect = e.currentTarget.getBoundingClientRect()
        addNode(rect)
      }}
    >
      添加节点
    </Button>
  )
}
