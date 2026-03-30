/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Field } from '@flowgram.ai/free-layout-editor'

import { useIsSidebar } from '../../../hooks'
import { FormItem } from '../../../form-components'
import { IFlowConstantRefValue } from '../../../form-materials'
import { useTranslation } from '../../../i18n'
import { KeyValueEditor } from './key-value-editor'

export function HeadersConfig() {
  const isSidebar = useIsSidebar()
  const { t } = useTranslation()

  if (!isSidebar) {
    return null
  }

  return (
    <Field<IFlowConstantRefValue> name="inputs.inputParameters.headers">
      {({ field }) => {
        const rawContent = field.value?.content
        const content = (typeof rawContent === 'object' && rawContent !== null ? rawContent : {}) as Record<string, string>

        const handleChange = (val: Record<string, string>) => {
          field.onChange({
            ...field.value,
            type: 'constant',
            content: val,
            schema: (field.value as any)?.schema || { type: 'object' },
          } as IFlowConstantRefValue)
        }

        return (
          <FormItem name={t('workflowCanvas.nodes.httpRequest.headersSection.title') || 'Headers'}>
            <KeyValueEditor value={content} onChange={handleChange} keyPlaceholder="Header name" valuePlaceholder="Header value" addLabel="Add Header" />
          </FormItem>
        )
      }}
    </Field>
  )
}
