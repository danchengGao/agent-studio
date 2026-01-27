/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */
import { FormMeta, ValidateTrigger } from '@flowgram.ai/free-layout-editor'

import { provideJsonSchemaOutputs, syncVariableTitle, autoRenameRefEffect, validateWhenVariableSync, listenRefSchemaChange } from '../../form-materials'
import { validation } from './validation'
import { FormContent, FormHeader, FormInput, FormModel, FormPrompt } from '../../form-components'
import { FormData } from './type'
import { LLMFormOutput } from './llm-form-output'

export const renderForm = () => {
  return (
    <>
      <FormHeader />
      <FormContent>
        <FormInput />
        <FormModel />
        <FormPrompt />
        <LLMFormOutput />
      </FormContent>
    </>
  )
}

export const formMeta: FormMeta<FormData> = {
  render: renderForm,
  validateTrigger: ValidateTrigger.onChange,
  validate: validation,
  // plugins: [
  //   createInferInputsPlugin({
  //     sourceKey: 'inputParameters',
  //     targetKey: 'inputs',
  //     scope: 'public'
  //   })
  // ],
  effect: {
    title: syncVariableTitle,
    outputs: provideJsonSchemaOutputs,
    inputsValues: [...autoRenameRefEffect, ...validateWhenVariableSync({ scope: 'public' })],
    'inputsValues.*': listenRefSchemaChange(params => {
      console.log(`[${params.context.node.id}][${params.name}] Schema Of Ref Updated`)
    }),
  },
}
