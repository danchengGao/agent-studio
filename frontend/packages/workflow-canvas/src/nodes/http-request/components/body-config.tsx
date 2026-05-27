/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Field } from '@flowgram.ai/free-layout-editor'
import { TextArea } from '@douyinfe/semi-ui'

import { useIsSidebar } from '../../../hooks'
import { FormItem } from '../../../form-components'
import { DynamicValueInput, IFlowConstantRefValue } from '../../../form-materials'
import { useTranslation } from '../../../i18n'

const BODY_METHODS = ['POST', 'PUT', 'PATCH']

const jsonBodyStrategy = {
  hit: (schema: { type?: string }) => schema?.type === 'string',
  Renderer: ({ value, onChange }: { value?: string; onChange?: (val: string) => void }) => (
    <TextArea
      placeholder="{}"
      autosize={{ minRows: 3, maxRows: 8 } as any}
      value={value || ''}
      onChange={(val: string) => onChange?.(val)}
    />
  ),
}

function BodyField() {
  const { t } = useTranslation()

  return (
    <Field<IFlowConstantRefValue> name="inputs.inputParameters.body">
      {({ field }) => (
        <FormItem name={t('workflowCanvas.nodes.httpRequest.bodySection.title') || 'Request Body'}>
          <DynamicValueInput
            value={field.value}
            onChange={(val) => field.onChange(val as IFlowConstantRefValue)}
            schema={{ type: 'string' }}
            constantProps={{
              strategies: [jsonBodyStrategy],
            }}
          />
        </FormItem>
      )}
    </Field>
  )
}

export function BodyConfig() {
  const isSidebar = useIsSidebar()

  if (!isSidebar) {
    return null
  }

  return (
    <Field<{ type: string; content: string }> name="inputs.method">
      {({ field: methodField }) => {
        const method = methodField.value?.content || 'GET'
        if (!BODY_METHODS.includes(method)) {
          return <></>
        }

        return <BodyField />
      }}
    </Field>
  )
}
