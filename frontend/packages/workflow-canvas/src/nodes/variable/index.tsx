/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { nanoid } from 'nanoid'
import { I18n } from '@flowgram.ai/editor'

import { WorkflowNodeType } from '../constants'
import { FlowNodeRegistry } from '../../typings'
import { Key } from 'lucide-react'
import { formMeta } from './form-meta'
import { customNanoid } from '../../utils/nanoid-custom'

export const VariableNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.Variable,
  info: {
    icon: <Key size={16} className="text-blue-600" />,
    description: I18n.t('Used to reset the value of a loop variable for the next iteration'),
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
        title: I18n.t('Variable'),
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
