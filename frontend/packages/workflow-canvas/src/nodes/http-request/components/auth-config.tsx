/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Field } from '@flowgram.ai/free-layout-editor'
import { Select, Input } from '@douyinfe/semi-ui'

import { useIsSidebar } from '../../../hooks'
import { FormItem } from '../../../form-components'
import { IFlowConstantRefValue } from '../../../form-materials'
import { useTranslation } from '../../../i18n'

interface AuthContent {
  type: string
  username?: string
  password?: string
  token?: string
  api_key?: string
  api_key_location?: string
  api_key_param_name?: string
}

const AUTH_OPTIONS = [
  { label: 'None', value: 'none' },
  { label: 'Basic Auth', value: 'basic' },
  { label: 'Bearer Token', value: 'bearer' },
  { label: 'API Key', value: 'api_key' },
]

const API_KEY_LOCATION_OPTIONS = [
  { label: 'Header', value: 'header' },
  { label: 'Query Parameter', value: 'query' },
  { label: 'Body', value: 'body' },
]

export function AuthConfig() {
  const isSidebar = useIsSidebar()
  const { t } = useTranslation()

  if (!isSidebar) {
    return null
  }

  return (
    <Field<IFlowConstantRefValue> name="inputs.inputParameters.auth">
      {({ field }) => {
        const val = field.value
        const content = (val?.content as AuthContent) || { type: 'none' }
        const authType = content.type || 'none'

        const updateContent = (updates: Partial<AuthContent>) => {
          field.onChange({
            ...val,
            type: 'constant',
            content: { ...content, ...updates },
            schema: (val as any)?.schema || { type: 'object' },
          })
        }

        return (
          <FormItem name={t('workflowCanvas.nodes.httpRequest.authSection.title') || 'Authentication'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Select
                size="small"
                value={authType}
                onChange={(value) => {
                  const newType = value as string
                  const newContent: AuthContent = { type: newType }
                  if (newType === 'basic') {
                    newContent.username = content.username || ''
                    newContent.password = content.password || ''
                  } else if (newType === 'bearer') {
                    newContent.token = content.token || ''
                  } else if (newType === 'api_key') {
                    newContent.api_key = content.api_key || ''
                    newContent.api_key_location = content.api_key_location || 'header'
                    newContent.api_key_param_name = content.api_key_param_name || 'X-API-Key'
                  }
                  field.onChange({
                    ...val,
                    type: 'constant',
                    content: newContent,
                    schema: (val as any)?.schema || { type: 'object' },
                  })
                }}
                style={{ width: '100%' }}
              >
                {AUTH_OPTIONS.map((opt) => (
                  <Select.Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Select.Option>
                ))}
              </Select>

              {authType === 'basic' && (
                <>
                  <Input
                    size="small"
                    placeholder={t('workflowCanvas.nodes.httpRequest.auth.username') || 'Username'}
                    value={content.username || ''}
                    onChange={(val) => updateContent({ username: val })}
                  />
                  <Input
                    size="small"
                    mode="password"
                    placeholder={t('workflowCanvas.nodes.httpRequest.auth.password') || 'Password'}
                    value={content.password || ''}
                    onChange={(val) => updateContent({ password: val })}
                  />
                </>
              )}

              {authType === 'bearer' && (
                <Input
                  size="small"
                  placeholder={t('workflowCanvas.nodes.httpRequest.auth.token') || 'Bearer Token'}
                  value={content.token || ''}
                  onChange={(val) => updateContent({ token: val })}
                />
              )}

              {authType === 'api_key' && (
                <>
                  <Input
                    size="small"
                    placeholder={t('workflowCanvas.nodes.httpRequest.auth.apiKey') || 'API Key'}
                    value={content.api_key || ''}
                    onChange={(val) => updateContent({ api_key: val })}
                  />
                  <Select
                    size="small"
                    value={content.api_key_location || 'header'}
                    onChange={(val) => updateContent({ api_key_location: val as string })}
                    style={{ width: '100%' }}
                  >
                    {API_KEY_LOCATION_OPTIONS.map((opt) => (
                      <Select.Option key={opt.value} value={opt.value}>
                        {opt.label}
                      </Select.Option>
                    ))}
                  </Select>
                  <Input
                    size="small"
                    placeholder={t('workflowCanvas.nodes.httpRequest.auth.paramName') || 'Parameter Name (e.g. X-API-Key)'}
                    value={content.api_key_param_name || ''}
                    onChange={(val) => updateContent({ api_key_param_name: val })}
                  />
                </>
              )}
            </div>
          </FormItem>
        )
      }}
    </Field>
  )
}
