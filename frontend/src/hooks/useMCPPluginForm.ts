import { useState } from 'react'

interface MCPPluginForm {
  name: string
  description: string
  desc_mk?: string
  url: string
  transport: number
  command: string
  argsText: string
  envText: string
  authMethod: string
  apiKeyLocation: 'header' | 'query'
  apiKeyParamName: string
  apiKeyValue: string
  oauthEndpointUrl: string
  oauthClientId: string
  oauthClientSecret: string
  oauthScope?: string
}

interface Plugin {
  id: string
  plugin_id?: string
  name: string
  description: string
  icon: string
  category: string
  status: 'active' | 'inactive' | 'error' | 'updating'
  version: string
  author: string
  installDate: string
  lastUpdate: string
  usageCount: number
  rating: number
  downloadCount: number
  tags: string[]
  dependencies: string[]
  config: {
    apiKey?: string
    baseUrl?: string
    timeout?: number
    retryCount?: number
    url?: string
    authMethod?: string
  }
  permissions: string[]
  size: string
}

export const useMCPPluginForm = (initialPlugin?: Plugin | null) => {
  const [form, setForm] = useState<MCPPluginForm>({
    name: initialPlugin?.name || '',
    description: initialPlugin?.description || '',
    desc_mk: '',
    url: initialPlugin?.config?.url || '',
    transport: 2,
    command: '',
    argsText: '',
    envText: '',
    authMethod: 'none',
    apiKeyLocation: 'header',
    apiKeyParamName: '',
    apiKeyValue: '',
    oauthEndpointUrl: '',
    oauthClientId: '',
    oauthClientSecret: '',
    oauthScope: '',
  })

  const handleFormChange = (field: string, value: unknown) => {
    setForm(prev => ({ ...prev, [field as keyof MCPPluginForm]: value as string | number }))
  }

  const resetForm = (plugin?: Plugin | null) => {
    setForm({
      name: plugin?.name || '',
      description: plugin?.description || '',
      desc_mk: '',
      url: plugin?.config?.url || '',
      transport: 2,
      command: '',
      argsText: '',
      envText: '',
      authMethod: 'none',
      apiKeyLocation: 'header',
      apiKeyParamName: '',
      apiKeyValue: '',
      oauthEndpointUrl: '',
      oauthClientId: '',
      oauthClientSecret: '',
      oauthScope: '',
    })
  }

  const validateForm = () => {
    const errors: string[] = []
    const transportNum = Number(form.transport)
    const isStdio = transportNum === 1
    const envLines = (form.envText || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
    const hasInvalidEnvLine = envLines.some(line => !line.includes('=') || line.startsWith('='))

    if (!form.name.trim()) {
      errors.push('请输入插件名称')
    }
    if (!form.description.trim()) {
      errors.push('请输入插件描述')
    }
    if (isStdio) {
      if (!form.command.trim()) {
        errors.push('请输入可执行命令')
      }
      if (hasInvalidEnvLine) {
        errors.push('环境变量格式必须为 KEY=VALUE')
      }
    } else if (!form.url.trim()) {
      errors.push('请输入MCP服务器URL')
    }
    if (!isStdio && form.authMethod === 'api_key') {
      if (!form.apiKeyParamName.trim()) {
        errors.push('Parameter name 不能为空')
      }
      if (!form.apiKeyValue.trim()) {
        errors.push('Service token / API key 不能为空')
      }
    }
    if (!isStdio && form.authMethod === 'oauth2') {
      if (!form.oauthEndpointUrl.trim()) {
        errors.push('OAuth2 Endpoint URL 不能为空')
      }
      if (!form.oauthClientId.trim()) {
        errors.push('OAuth2 Client ID 不能为空')
      }
      if (!form.oauthClientSecret.trim()) {
        errors.push('OAuth2 Client Secret 不能为空')
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  return {
    form,
    handleFormChange,
    resetForm,
    validateForm,
  }
}
