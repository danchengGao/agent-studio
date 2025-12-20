import { useState } from 'react'

interface CloudPluginForm {
  name: string
  description: string
  url: string
  authMethod: string
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

export const useCloudPluginForm = (initialPlugin?: Plugin | null) => {
  const [form, setForm] = useState<CloudPluginForm>({
    name: initialPlugin?.name || '',
    description: initialPlugin?.description || '',
    url: initialPlugin?.config?.url || '',
    authMethod: initialPlugin?.config?.authMethod || 'none',
  })

  const handleFormChange = (field: keyof CloudPluginForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const resetForm = (plugin?: Plugin | null) => {
    setForm({
      name: plugin?.name || '',
      description: plugin?.description || '',
      url: plugin?.config?.url || '',
      authMethod: plugin?.config?.authMethod || 'none',
    })
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
