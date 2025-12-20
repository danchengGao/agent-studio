/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FormMeta, FormRenderProps, ValidateTrigger } from '@flowgram.ai/free-layout-editor'

import { provideJsonSchemaOutputs, syncVariableTitle, autoRenameRefEffect, validateWhenVariableSync, listenRefSchemaChange } from '../../form-materials'
import { validation } from './validation'
import { FormHeader, FormContent, FormInput, FormOutput } from '../../form-components'
import { FormData } from './types'
import { Code, ErrorHandler } from './components'

export const FormRender = (_props: FormRenderProps<FormData>) => (
  <>
    <FormHeader />
    <FormContent>
      <FormInput />
      <Code />
      <FormOutput expandable={false} />
      <ErrorHandler />
    </FormContent>
  </>
)

export const formMeta: FormMeta<FormData> = {
  render: props => <FormRender {...props} />,
  validateTrigger: ValidateTrigger.onChange,
  validate: validation,
  plugins: [],
  effect: {
    title: syncVariableTitle,
    outputs: provideJsonSchemaOutputs,
    'inputs.inputParameters.*': [...autoRenameRefEffect, ...validateWhenVariableSync({ scope: 'public' })],
  },
}
