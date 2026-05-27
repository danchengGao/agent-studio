/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FormOutput } from '../../form-components'
import { ReactAgentOutputFormatSelector } from './react-agent-output-format-selector'
import { IJsonSchema } from '@flowgram.ai/json-schema'

// Default output schema for Text format (React Agent only supports text)
const DEFAULT_OUTPUT_SCHEMA: IJsonSchema = {
  type: 'object',
  properties: {
    output: {
      type: 'string',
      extra: {
        index: 1,
      },
    },
  },
  required: ['output'],
}

export function ReactAgentFormOutput() {
  return (
    <FormOutput
      showAddButton={false}
      defaultFields={['output']}
      minProperties={1}
      readonly={true}
      labelExtra={<ReactAgentOutputFormatSelector />}
      excludeTypes={undefined}
      maxNameBytes={undefined}
      excludeNestedArray={undefined}
      expandable={false}
      showDefaultValue={false}
      maxDescBytes={undefined}
    />
  )
}
