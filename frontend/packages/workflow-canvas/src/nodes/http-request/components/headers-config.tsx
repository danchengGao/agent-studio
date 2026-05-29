/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Field } from '@flowgram.ai/free-layout-editor'

import { useIsSidebar } from '../../../hooks'
import { FormItem } from '../../../form-components'
import { useTranslation } from '../../../i18n'
import { KeyValueEditor } from './key-value-editor'

export function HeadersConfig() {
  const isSidebar = useIsSidebar()
  const { t } = useTranslation()

  if (!isSidebar) {
    return null
  }

  return (
    <Field<Record<string, string>> name="inputs.httpRequestParam.headers">
      {({ field }) => {
        const content = 
          (typeof field.value === 'object' && field.value !== null ? field.value : {}) as Record<string, string>

        const handleChange = (val: Record<string, string>) => {
          field.onChange(val)
        }

        return (
          <FormItem name={t('workflowCanvas.nodes.httpRequest.headersSection.title') || 'Headers'}>
            <KeyValueEditor 
              value={content} 
              onChange={handleChange} 
              keyPlaceholder="Header name" 
              valuePlaceholder="Header value" 
              addLabel="Add Header" />
          </FormItem>
        )
      }}
    </Field>
  )
}
