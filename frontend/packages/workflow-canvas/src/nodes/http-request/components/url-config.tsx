/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Field } from '@flowgram.ai/free-layout-editor'

import { useIsSidebar } from '../../../hooks'
import { FormItem } from '../../../form-components'
import { DynamicValueInput, IFlowConstantRefValue } from '../../../form-materials'
import { useTranslation } from '../../../i18n'

export function UrlConfig() {
  const isSidebar = useIsSidebar()
  const { t } = useTranslation()

  if (!isSidebar) {
    return null
  }

  return (
    <Field<IFlowConstantRefValue> name="inputs.inputParameters.url">
      {({ field }) => (
        <FormItem name={t('workflowCanvas.nodes.httpRequest.url.label') || 'URL'}>
          <DynamicValueInput
            value={field.value}
            onChange={(val) => field.onChange(val as IFlowConstantRefValue)}
            schema={{ type: 'string' }}
          />
        </FormItem>
      )}
    </Field>
  )
}
