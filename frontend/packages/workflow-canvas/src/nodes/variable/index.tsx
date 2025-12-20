/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { nanoid } from 'nanoid'

import { WorkflowNodeType } from '../constants'
import { FlowNodeRegistry } from '../../typings'
import { Key } from 'lucide-react'
import { formMeta } from './form-meta'
import { customNanoid } from '../../utils/nanoid-custom'

export const VariableNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.Variable,
  info: {
    icon: <Key size={16} className="text-blue-600" />,
    description: '用于重置循环变量的值，使其下次循环使用重置后的值',
  },
  meta: {
    size: {
      width: 360,
      height: 390,
    },
    onlyInContainer: WorkflowNodeType.Loop,
  },
  onAdd() {
    return {
      id: `variable__${customNanoid(5)}`,
      type: WorkflowNodeType.Variable,
      data: {
        title: `变量`,
        assign: [
          {
            operator: 'assign',
            left: '',
          },
        ],
      },
    }
  },
  formMeta: formMeta,
}
