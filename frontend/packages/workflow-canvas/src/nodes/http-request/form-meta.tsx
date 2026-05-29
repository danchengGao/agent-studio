/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FormMeta, ValidateTrigger } from '@flowgram.ai/free-layout-editor'

import {
  provideJsonSchemaOutputs,
  syncVariableTitle,
  autoRenameRefEffect,
  validateWhenVariableSync,
} from '../../form-materials'
import { FormHeader, FormContent, FormInput, FormOutput } from '../../form-components'
import { HttpRequestNodeData } from './types'
import { MethodSelector, UrlConfig, HeadersConfig, QueryParamsConfig, BodyConfig, AuthConfig } from './components'
import { useIsSidebar } from '../../hooks'

export const FormRender = () => {
  const isSidebar = useIsSidebar()

  return (
    <>
      <FormHeader />
      <FormContent>
        {isSidebar ? (
          <>
            <FormInput />
            <MethodSelector />
            <UrlConfig />
            <HeadersConfig />
            <QueryParamsConfig />
            <BodyConfig />
            <AuthConfig />
          </>
        ) : (
          <FormInput showAddButton={false} deleteable={false} nameEditable={false} />
        )}
        <FormOutput showAddButton={false} readonly={true} />
      </FormContent>
    </>
  )
}

export const formMeta: FormMeta<HttpRequestNodeData> = {
  render: () => <FormRender />,
  validateTrigger: ValidateTrigger.onChange,
  validate: {},
  plugins: [],
  effect: {
    title: syncVariableTitle,
    outputs: provideJsonSchemaOutputs,
    'inputs.inputParameters.*': [...autoRenameRefEffect, ...validateWhenVariableSync({ scope: 'public' })],
  },
}
