/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { customNanoid } from '../../utils/nanoid-custom'

import { WorkflowNodeType } from '../constants'
import { FlowNodeRegistry } from '../../typings'
import { Code } from 'lucide-react'
import { formMeta } from './form-meta'

export const CodeNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.Code,
  info: {
    icon: <Code size={16} className="text-emerald-600" />,
    description: '代码节点，用于运行自定义的 JavaScript 或 Python 代码。',
  },
  meta: {
    defaultPorts: [{ type: 'input' }],
    useDynamicPort: true,
    size: {
      width: 360,
      height: 211,
    },
    nodePanelVisible: true,
    singleComponentDebug: true,
  },
  formMeta,
  onAdd() {
    return {
      id: `code_${customNanoid(5)}`,
      type: WorkflowNodeType.Code,
      data: {
        title: '代码',
        inputs: {
          inputParameters: {
            input: {
              type: 'constant',
              content: 'hello',
              schema: {
                type: 'string',
              },
              extra: {
                index: 0,
              },
            },
          },
          language: 'python',
          code: "def main(args: Args):\n  import time\n  time.sleep(3)\n  return {'result': args.params['input']}",
        },
        outputs: {
          type: 'object',
          properties: {
            result: {
              type: 'string',
              description: '代码执行结果',
            },
          },
          required: ['result'],
        },
        exceptionConfig: {
          retryTimes: 3,
          timeoutSeconds: 30,
          processType: 'break',
          executeStep: {
            defaultStep: '0',
            errorStep: '1',
          },
        },
      },
    }
  },
}
