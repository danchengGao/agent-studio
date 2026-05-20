/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Field } from '@flowgram.ai/free-layout-editor'
import { Select, Input } from '@douyinfe/semi-ui'

import { useIsSidebar } from '../../../hooks'
import { FormItem } from '../../../form-components'
import { useTranslation } from '../../../i18n'

interface AuthContent {
  authType: string
  username?: string
  password?: string
  token?: string
  apiKey?: string
  apiKeyLocation?: string
  apiKeyParamName?: string
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
    <Field<AuthContent> name="inputs.httpRequestParam.auth">
      {({ field }) => {
        const content = field.value || { authType: 'none' }
        const authType = content.authType || 'none'

        const updateContent = (updates: Partial<AuthContent>) => {
          field.onChange({ ...content, ...updates })
        }

        return (
          <FormItem name={t('workflowCanvas.nodes.httpRequest.authSection.title') || 'Authentication'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Select
                size="small"
                value={authType}
                onChange={(value) => {
                  const newType = value as string
                  const newContent: AuthContent = { authType: newType }
                  if (newType === 'basic') {
                    newContent.username = content.username || ''
                    newContent.password = content.password || ''
                  } else if (newType === 'bearer') {
                    newContent.token = content.token || ''
                  } else if (newType === 'api_key') {
                    newContent.apiKey = content.apiKey || ''
                    newContent.apiKeyLocation = content.apiKeyLocation || 'header'
                    newContent.apiKeyParamName = content.apiKeyParamName || 'X-API-Key'
                  }
                  field.onChange(newContent)
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
                    value={content.apiKey || ''}
                    onChange={(val) => updateContent({ apiKey: val })}
                  />
                  <Select
                    size="small"
                    value={content.apiKeyLocation || 'header'}
                    onChange={(val) => updateContent({ apiKeyLocation: val as string })}
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
                    placeholder={t('workflowCanvas.nodes.httpRequest.auth.paramName')
                      || 'Parameter Name (e.g. X-API-Key)'}
                    value={content.apiKeyParamName || ''}
                    onChange={(val) => updateContent({ apiKeyParamName: val })}
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
