/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FormMeta, ValidateTrigger } from '@flowgram.ai/free-layout-editor'

import { autoRenameRefEffect } from '../../form-materials'
import { validation } from './validation'
import { FlowNodeJSON } from '../../typings'
import { FormHeader, FormContent } from '../../form-components'
import { MultiConditionInputs } from './condition-inputs'

export const renderForm = () => (
  <>
    <FormHeader />
    <FormContent>
      <MultiConditionInputs />
    </FormContent>
  </>
)

export const formMeta: FormMeta<FlowNodeJSON> = {
  render: renderForm,
  validateTrigger: ValidateTrigger.onChange,
  validate: validation,
  effect: {
    branches: autoRenameRefEffect,
  },
}
