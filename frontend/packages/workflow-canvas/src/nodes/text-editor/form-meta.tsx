/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FormMeta, ValidateTrigger, FlowNodeJSON } from '@flowgram.ai/free-layout-editor'

import { provideJsonSchemaOutputs, syncVariableTitle } from '../../form-materials'
import { FormHeader, FormContent, FormOutput } from '../../form-components'
import { SplittingSelector, Input, TypeSelector, ConcatenationTemplate } from './components'
import { validation } from './validation'

export const renderForm = () => {
  return (
    <>
      <FormHeader />
      <FormContent>
        <TypeSelector />
        <Input />
        <SplittingSelector />
        <ConcatenationTemplate />
        <FormOutput showAddButton={false} defaultFields={['output']} />
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
