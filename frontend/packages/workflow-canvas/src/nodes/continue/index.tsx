/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { customNanoid } from '../../utils/nanoid-custom'

import { FlowNodeRegistry } from '../../typings'
import { SkipForward } from 'lucide-react'
import { formMeta } from './form-meta'
import { WorkflowNodeType } from '../constants'

const index = 0
export const ContinueNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.Continue,
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
    icon: <SkipForward size={16} className="text-blue-600" />,
    description: '继续节点，用于在循环中跳过当前迭代并继续下一次迭代。',
  },
  /**
   * Render node via formMeta
   */
  formMeta,
  onAdd() {
    return {
      id: `continue_${customNanoid(5)}`,
      type: WorkflowNodeType.Continue,
      data: {
        title: `继续循环`,
      },
    }
  },
}
