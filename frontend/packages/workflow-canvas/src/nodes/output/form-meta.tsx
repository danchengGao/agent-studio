/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FormMeta, ValidateTrigger } from '@flowgram.ai/free-layout-editor'

import { FormHeader, FormContent, FormInput, FormContentEditor } from '../../form-components'
import { syncVariableTitle, provideJsonSchemaOutputs, autoRenameRefEffect, validateWhenVariableSync, listenRefSchemaChange } from '../../form-materials'
import { validation } from './validation'
import { FormData } from './type'

export const renderForm = () => {
  return (
    <>
      <FormHeader />
      <FormContent>
        <FormInput />
        <FormContentEditor />
      </FormContent>
    </>
  )
}

export const formMeta: FormMeta<FormData> = {
  validateTrigger: ValidateTrigger.onChange,
  validate: validation,
  render: renderForm,
  effect: {
    title: syncVariableTitle,
    outputs: provideJsonSchemaOutputs,
    inputsValues: [...autoRenameRefEffect, ...validateWhenVariableSync({ scope: 'public' })],
    'inputsValues.*': listenRefSchemaChange(params => {
      console.log(`[${params.context.node.id}][${params.name}] Schema Of Ref Updated`)
    }),
  },
}
