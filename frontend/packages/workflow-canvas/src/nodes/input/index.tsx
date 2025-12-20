/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FlowNodeRegistry } from '../../typings'
import { MousePointerClick } from 'lucide-react'
import { formMeta } from './form-meta'
import { WorkflowNodeType } from '../constants'
import { customNanoid } from '../../utils/nanoid-custom'

export const InputNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.Input,
  meta: {
    defaultPorts: [{ type: 'input' }, { type: 'output' }],
    size: {
      width: 360,
      height: 211,
    },
  },
  info: {
    icon: <MousePointerClick size={16} className="text-blue-600" />,
    description: '输入节点，用于在工作流执行过程中暂停并等待用户输入。',
  },
  /**
   * Render node via formMeta
   */
  formMeta,
  /**
   * Input Node can be added
   */
  canAdd() {
    return true
  },
  /**
   * 添加输入节点时的默认配置
   */
  onAdd() {
    return {
      id: `input_${customNanoid(5)}`,
      type: WorkflowNodeType.Input,
      data: {
        title: '输入',
        outputs: {
          type: 'object',
          properties: {
            userInput: {
              type: 'string',
              extra: {
                index: 1,
              },
            },
          },
          required: ['userInput'],
        },
      },
    }
  },
}
