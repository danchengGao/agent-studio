/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { nanoid } from 'nanoid'
import { Target } from 'lucide-react'

import { FlowNodeRegistry } from '../../typings'
import { WorkflowNodeType } from '../constants'
import { formMeta } from './form-meta'
import { generateIntentId } from './components/utils'

export const IntentNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.Intent,
  meta: {
    defaultPorts: [{ type: 'input' }],
    useDynamicPort: true,
    size: {
      width: 360,
      height: 280,
    },
  },
  info: {
    icon: <Target size={16} className="text-blue-600" />,
    description: '意图识别节点，用于根据用户不同的输入匹配不同的意图。',
  },
  /**
   * 通过 formMeta 渲染节点
   */
  formMeta,
  /**
   * 意图识别节点可以添加
   */
  canAdd() {
    return true
  },
  /**
   * 添加意图识别节点时的默认配置
   */
  onAdd() {
    const defaultIntents = [
      {
        name: '',
        id: generateIntentId(),
      },
    ]

    return {
      id: `intent_${nanoid(5)}`,
      type: WorkflowNodeType.Intent,
      data: {
        title: '意图识别',
        inputs: {
          llmParam: {
            systemPrompt: {
              type: 'template',
              content: '',
            },
            prompt: {
              type: 'template',
              content: '',
            },
          },
          intents: defaultIntents,
          default_intent: '0',
          inputParameters: {
            query: {
              type: 'constant',
              content: '',
              schema: {
                type: 'string',
              },
              extra: {
                index: 0,
              },
            },
          },
        },
        outputs: {
          type: 'object',
          properties: {
            classification_id: {
              type: 'integer',
              extra: {
                index: 1,
              },
            },
          },
          required: ['classification_id'],
        },
      },
    }
  },
}
