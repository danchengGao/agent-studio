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
  })

  const handleFormChange = (field: keyof MCPPluginForm, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }))
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
      errors.push('请输入MCP服务器URL')
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
