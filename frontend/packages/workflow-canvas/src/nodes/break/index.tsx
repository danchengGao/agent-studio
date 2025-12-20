/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { customNanoid } from '../../utils/nanoid-custom'

import { FlowNodeRegistry } from '../../typings'
import { XCircle } from 'lucide-react'
import { formMeta } from './form-meta'
import { WorkflowNodeType } from '../constants'

const index = 0
export const BreakNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.Break,
  meta: {
    defaultPorts: [{ type: 'input' }],
    sidebarDisabled: true,
    size: {
      width: 360,
      height: 54,
    },
    onlyInContainer: WorkflowNodeType.Loop,
  },
  info: {
    icon: <XCircle size={16} className="text-red-600" />,
    description: '中断节点，用于在循环中立即退出循环。',
  },
  /**
   * Render node via formMeta
   */
  formMeta,
  onAdd() {
    return {
      id: `break_${customNanoid(5)}`,
      type: WorkflowNodeType.Break,
      data: {
        title: `跳出循环`,
      },
    }
  },
}
