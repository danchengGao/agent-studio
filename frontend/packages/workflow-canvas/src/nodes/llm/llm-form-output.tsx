/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useEffect, useRef } from 'react'

import { Field, FieldRenderProps } from '@flowgram.ai/free-layout-editor'

import { FormOutput } from '../../form-components'
import { OutputFormat } from './type'
import { LLMOutputFormatSelector } from './llm-output-format-selector'
import { IJsonSchema } from '@flowgram.ai/json-schema'

// Default output schema for Text/Markdown format
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

function LLMFormOutputInner({ formatField, outputsField }: { formatField: FieldRenderProps<string>['field']; outputsField: FieldRenderProps<IJsonSchema>['field'] }) {
  const prevFormatRef = useRef<string | undefined>(undefined)
  const currentFormat = formatField.value
  const isJsonFormat = currentFormat === OutputFormat.JSON

  // Track previous format and reset outputs when switching formats
  useEffect(() => {
    if (prevFormatRef.current !== undefined && prevFormatRef.current !== currentFormat) {
      // If switching from JSON to Text/Markdown, reset outputs to default
      if (prevFormatRef.current === OutputFormat.JSON && currentFormat !== OutputFormat.JSON) {
        outputsField.onChange(DEFAULT_OUTPUT_SCHEMA)
      }
      // If switching from Text/Markdown to JSON, also reset to default for clean state
      else if (prevFormatRef.current !== OutputFormat.JSON && currentFormat === OutputFormat.JSON) {
        outputsField.onChange(DEFAULT_OUTPUT_SCHEMA)
      }
    }
    prevFormatRef.current = currentFormat
  }, [currentFormat, outputsField])

  return (
    <FormOutput
      showAddButton={isJsonFormat}
      defaultFields={isJsonFormat ? undefined : ['output']}
      minProperties={isJsonFormat ? 1 : undefined}
      readonly={!isJsonFormat}
      labelExtra={<LLMOutputFormatSelector />}
      excludeTypes={isJsonFormat ? ['date-time'] : undefined}
      maxNameBytes={isJsonFormat ? 20 : undefined}
    />
  )
}

export function LLMFormOutput() {
  return (
    <Field<string> name="output_format">
      {({ field: formatField }) => (
        <Field<IJsonSchema> name="outputs">
          {({ field: outputsField }) => <LLMFormOutputInner formatField={formatField} outputsField={outputsField} />}
        </Field>
      )}
    </Field>
  )
}
