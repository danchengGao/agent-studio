/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FlowNodeRegistry } from '../../typings'
import { Power } from 'lucide-react'
import { formMeta } from './form-meta'
import { WorkflowNodeType } from '../constants'

export const EndNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.End,
  meta: {
    deleteDisable: true,
    copyDisable: true,
    defaultPorts: [{ type: 'input' }],
    size: {
      width: 360,
      height: 211,
    },
  },
  info: {
    icon: <Power size={16} className="text-red-600" />,
    description: '工作流的最终节点，用于返回工作流运行后的结果信息。',
  },
  onAdd() {
    return {
      id: `end`,
      type: WorkflowNodeType.End,
      data: {
        title: `结束`,
        inputs: {
          inputParameters: {
            result: {
              type: 'ref',
              content: ['start_0', 'query'],
            },
          },
          content: {
            type: 'template',
            content: '{{result}}',
          },
          streaming: false,
        },
      },
    }
  },
  /**
   * Render node via formMeta
   */
  formMeta,
  /**
   * End Node cannot be added
   */
  canAdd() {
    return false
  },
}
