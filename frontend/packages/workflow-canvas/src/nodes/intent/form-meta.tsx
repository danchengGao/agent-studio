/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FormMeta, ValidateTrigger } from '@flowgram.ai/free-layout-editor'

import { autoRenameRefEffect, listenRefSchemaChange, provideJsonSchemaOutputs, syncVariableTitle, validateWhenVariableSync } from '../../form-materials'
import { validation } from './validation'
import { FormContent, FormHeader, FormInput, FormModel, FormOutput, FormPrompt } from '../../form-components'
import { Intents } from './components'
import { FormData } from './type'
import { useIsSidebar } from '../../hooks'

export const renderForm = () => {
  const isSidebar = useIsSidebar()

  if (!isSidebar) {
    return (
      <>
        <FormHeader />
        <FormContent>
          <FormInput showAddButton={false} defaultFields={['query']} schema={{ type: 'string' }} />
          <FormModel />
          <FormPrompt mode="userOnly" />
          <FormOutput showAddButton={false} defaultFields={['classification_id']} />
          <Intents />
        </FormContent>
      </>
    )
  }

  return (
    <>
      <FormHeader />
      <FormContent>
        <FormInput showAddButton={false} defaultFields={['query']} schema={{ type: 'string' }} />
        <FormModel />
        <FormPrompt mode="userOnly" />
        <Intents />
        <FormOutput showAddButton={false} defaultFields={['classification_id']} />
      </FormContent>
    </>
  )
}

export const formMeta: FormMeta<FormData> = {
  render: renderForm,
  validateTrigger: ValidateTrigger.onChange,
  validate: validation,
  effect: {
    title: syncVariableTitle,
    outputs: provideJsonSchemaOutputs,
    inputsValues: [...autoRenameRefEffect, ...validateWhenVariableSync({ scope: 'public' })],
    'inputsValues.*': listenRefSchemaChange(() => {}),
  },
}
