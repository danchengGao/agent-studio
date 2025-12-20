/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FlowNodeJSON } from '@flowgram.ai/free-layout-editor'
import { IJsonSchema } from '../form-materials'
import { JsonSchema } from '../../typings'

export interface FormData extends FlowNodeJSON {
  data: {
    title: string
    inputs: {
      inputParameters: JsonSchema
      language: 'javascript' | 'python'
      code: string
    }
    outputs: IJsonSchema<'object'>
    exceptionConfig: {
      retryTimes: number
      timeoutSeconds: number
      processType: 'break' | 'execute_exception_step' | 'ignore' | 'return_content'
      returnContent?: Record<string, any>
      executeStep?: {
        defaultStep?: string
        errorStep?: string
      }
    }
  }
}
