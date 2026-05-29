import { useState } from 'react'

interface CloudPluginForm {
  name: string
  description: string
  desc_mk?: string
  url: string
  authMethod: string
  apiKeyLocation: 'header' | 'query'
  apiKeyParamName: string
  apiKeyValue: string
  oauthEndpointUrl: string
  oauthClientId: string
  oauthClientSecret: string
  oauthScope?: string
  header_configuration: Array<{ name: string; value: string; description?: string }>
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

interface CloudPluginFormValues {
  name?: string
  description?: string
  desc_mk?: string
  url?: string
  authMethod?: string
  apiKeyLocation?: 'header' | 'query'
  apiKeyParamName?: string
  apiKeyValue?: string
  oauthEndpointUrl?: string
  oauthClientId?: string
  oauthClientSecret?: string
  oauthScope?: string
  header_configuration?: Array<{ name: string; value: string; description?: string }>
}

export const useCloudPluginForm = (initialPlugin?: Plugin | null) => {
  const [form, setForm] = useState<CloudPluginForm>({
    name: initialPlugin?.name || '',
    description: initialPlugin?.description || '',
    desc_mk: '',
    url: initialPlugin?.config?.url || '',
    authMethod: initialPlugin?.config?.authMethod || 'none',
    apiKeyLocation: 'header',
    apiKeyParamName: '',
    apiKeyValue: '',
    oauthEndpointUrl: '',
    oauthClientId: '',
    oauthClientSecret: '',
    oauthScope: '',
    header_configuration: [],
  })

  const handleFormChange = (field: keyof CloudPluginForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const resetForm = (plugin?: Plugin | null, values?: CloudPluginFormValues) => {
    setForm({
      name: values?.name ?? plugin?.name ?? '',
      description: values?.description ?? plugin?.description ?? '',
      desc_mk: values?.desc_mk ?? '',
      url: values?.url ?? plugin?.config?.url ?? '',
      authMethod: values?.authMethod ?? plugin?.config?.authMethod ?? 'none',
      apiKeyLocation: values?.apiKeyLocation ?? 'header',
      apiKeyParamName: values?.apiKeyParamName ?? '',
      apiKeyValue: values?.apiKeyValue ?? '',
      oauthEndpointUrl: values?.oauthEndpointUrl ?? '',
      oauthClientId: values?.oauthClientId ?? '',
      oauthClientSecret: values?.oauthClientSecret ?? '',
      oauthScope: values?.oauthScope ?? '',
      header_configuration: values?.header_configuration ?? [],
    })
  }

  const handleHeaderChange = (index: number, field: string, value: string) => {
    setForm(prev => ({
      ...prev,
      header_configuration: prev.header_configuration.map((header, currentIndex) =>
        currentIndex === index ? { ...header, [field]: value } : header,
      ),
    }))
  }

  const addHeaderRow = () => {
    setForm(prev => ({
      ...prev,
      header_configuration: [...prev.header_configuration, { name: '', value: '', description: '' }],
    }))
  }

  const removeHeaderRow = (index: number) => {
    setForm(prev => ({
      ...prev,
      header_configuration: prev.header_configuration.filter((_, currentIndex) => currentIndex !== index),
    }))
  }

  const validateForm = () => {
    const errors: string[] = []

    if (!form.name.trim()) {
      errors.push('请输入插件名称')
    }
    if (!form.description.trim()) {
      errors.push('请输入插件描述')
    }
    if (!form.url.trim()) {
      errors.push('请输入插件URL')
    }
    if (!form.authMethod.trim()) {
      errors.push('请选择授权方式')
    }
    if (form.authMethod === 'api_key') {
      if (!form.apiKeyParamName.trim()) {
        errors.push('请输入 Parameter name')
      }
      if (!form.apiKeyValue.trim()) {
        errors.push('请输入 Service token / API key')
      }
    }
    if (form.authMethod === 'oauth2') {
      if (!form.oauthEndpointUrl.trim()) {
        errors.push('请输入 OAuth2 Endpoint URL')
      }
      if (!form.oauthClientId.trim()) {
        errors.push('请输入 OAuth2 Client ID')
      }
      if (!form.oauthClientSecret.trim()) {
        errors.push('请输入 OAuth2 Client Secret')
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
    handleHeaderChange,
    addHeaderRow,
    removeHeaderRow,
    resetForm,
    validateForm,
  }
}
