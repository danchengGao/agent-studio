/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Merge } from 'lucide-react'

import { WorkflowNodeType } from '../constants'
import { FlowNodeRegistry } from '../../typings'
import { formMeta } from './form-meta'
import { customNanoid } from '../../utils/nanoid-custom'

export const VariableMergeNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.VariableMerge,
  info: {
    icon: <Merge size={16} className="text-purple-600" />,
    description: '工作流的变量聚合节点，用于将多个分组的变量进行聚合',
  },
  meta: {
    size: {
      width: 360,
      height: 211,
    },
  },
  onAdd() {
    return {
      id: `variable_merge_${customNanoid(5)}`,
      type: 'variable_merge',
      data: {
        title: '变量聚合',
        inputs: {
          variableMerge: [
            {
              name: 'Group1',
              type: 'string',
              items: ['input1'],
            },
          ],
          mergeStrategy: 'firstNonNull',
          inputParameters: {
            input1: {
              type: 'ref',
              content: [''],
              extra: {
                index: 0,
              },
            },
          },
        },
        outputs: {
          type: 'object',
          properties: {
            Group1: {
              type: 'string',
              extra: { index: 0 },
            },
          },
        },
      },
    }
  },
  formMeta: formMeta,
}
