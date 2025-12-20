/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FormMeta, ValidateTrigger, FlowNodeJSON } from '@flowgram.ai/free-layout-editor'

import { provideJsonSchemaOutputs, syncVariableTitle } from '../../form-materials'
import { validation } from './validation'
import { FormHeader, FormContent, FormOutput } from '../../form-components'

export const renderForm = () => {
  return (
    <>
      <FormHeader titleEditable={false} menuVisible={false} />
      <FormContent>
        <FormOutput name={'输入'} expandable={true} />
      </FormContent>
    </>
  )
}

export const formMeta: FormMeta<FlowNodeJSON> = {
  render: renderForm,
  validateTrigger: ValidateTrigger.onChange,
  validate: validation,
  effect: {
    title: syncVariableTitle,
    outputs: provideJsonSchemaOutputs,
  },
}
