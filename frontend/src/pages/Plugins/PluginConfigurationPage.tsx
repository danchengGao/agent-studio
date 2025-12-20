import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PluginService } from '@test-agentstudio/api-client'
import { useAuthStore } from '../../stores/useAuthStore'
import { ENV_CONFIG } from '../../config/environment'
import { useCloudPluginForm } from '../../hooks/useCloudPluginForm'
import { useUpdatePlugin, usePluginPublish } from '@test-agentstudio/api-client'
import CloudPluginFormDialog from '../../components/Plugins/CloudPluginFormDialog'
import CodePluginConfiguration from './components/CodePluginConfiguration'
import URLPluginConfiguration from './components/URLPluginConfiguration'
import PublishDialog from '../../components/Plugins/PublishDialog'
import UnifiedSnackbar, { useUnifiedSnackbar } from '../../Common/UnifiedSnackbar'
import { AlertTriangle, Rocket } from 'lucide-react'
import { Typography, Button, CircularProgress } from '@mui/material'
import { scrollToTop } from '../../utils/scrollUtils'

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

const PluginConfigurationPage: React.FC = () => {
  const { t } = useTranslation()
  const { plugin_id } = useParams<{ plugin_id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [plugin, setPlugin] = useState<Plugin | null>(null)
  const [pluginConfigData, setPluginConfigData] = useState<Record<string, unknown> | null>(null)
  const { snackbar, showSuccess, showError, closeSnackbar } = useUnifiedSnackbar()

  // Configuration form state
  const [configForm, setConfigForm] = useState({
    name: '',
    desc: '',
    icon_uri: '',
    url: '',
    authMethod: 'none',
  })

  // Icon options for selection - diversified without similar types
  const iconOptions = [
    '☁️',
    '🚀',
    '⚡',
    '🔥',
    '💎',
    '🏆',
    '⭐',
    '🌟',
    '✨',
    '🎨',
    '🎮',
    '🎲',
    '🎸',
    '🏠',
    '🏢',
    '🏭',
    '🏪',
    '🏫',
    '🏥',
    '🌈',
    '🌊',
    '🌍',
    '🌐',
    '🔧',
    '🔨',
    '🔬',
    '🔮',
    '💻',
    '💼',
    '💾',
    '📁',
    '📄',
    '📅',
    '🚗',
    '🚌',
    '🚓',
    '🚑',
    '🛸',
    '✈️',
    '🚁',
    '📡',
    '💡',
    '📱',
    '🖥️',
    '🖱️',
    '📷',
    '🎙️',
    '🎧',
    '💰',
    '🔑',
  ]

  // Handle icon selection
  const handleIconSelect = (icon: string) => {
    setConfigForm(prev => ({ ...prev, icon_uri: icon }))
  }

  // Handle name change
  const handleNameChange = (name: string) => {
    if (name.length <= 20) {
      setConfigForm(prev => ({ ...prev, name }))
    }
  }

  // Edit plugin state
  const [editingPlugin, setEditingPlugin] = useState<Plugin | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  // Publish dialog state
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false)

  // Tool creation state will be handled by the individual components

  // Form management
  const {
    form: cloudPluginForm,
    handleFormChange: handleCloudPluginFormChange,
    handleHeaderChange,
    addHeaderRow,
    removeHeaderRow,
    resetForm,
    validateForm,
  } = useCloudPluginForm(editingPlugin)

  const { user } = useAuthStore()

  const getDefaultSpaceId = () => {
    return user?.spaceId || ENV_CONFIG.DEFAULT_SPACE_ID
  }

  // Plugin update
  const updatePluginApi = useUpdatePlugin()

  // Plugin publish
  const publishPluginApi = usePluginPublish()

  useEffect(() => {
    if (plugin_id) {
      loadPluginData()
      // Scroll to top when loading new plugin configuration
      scrollToTop()
    }
  }, [plugin_id])

  const loadPluginData = async () => {
    if (!plugin_id) return

    setLoading(true)
    try {
      const request = {
        plugin_id: plugin_id,
        space_id: getDefaultSpaceId(),
      }

      const response = await PluginService.getPlugin(request)

      if (response.code === 200) {
        setPluginConfigData(response.data.plugin_info)

        // Initialize configuration form state
        setConfigForm({
          name: response.data.plugin_info.name || '',
          desc: response.data.plugin_info.desc || '',
          icon_uri: response.data.plugin_info.icon_uri || '☁️',
          url: response.data.plugin_info.url || '',
          authMethod: 'none',
        })

        // Create plugin object from the response data
        const pluginData: Plugin = {
          id: plugin_id,
          plugin_id: plugin_id,
          name: response.data.plugin_info.name || '',
          description: response.data.plugin_info.desc || '',
          icon: response.data.plugin_info.icon_uri || '⚙️',
          category: response.data.plugin_info.plugin_type === 1 ? '云侧插件' : '本地插件',
          status: 'active',
          version: 'v1.0.0',
          author: '云侧创建',
          installDate: new Date().toISOString().split('T')[0],
          lastUpdate: new Date().toISOString().split('T')[0],
          usageCount: 0,
          rating: 5.0,
          downloadCount: 1,
          tags: ['云侧', '自定义', 'API'],
          dependencies: [],
          config: {
            url: response.data.plugin_info.url || '',
            authMethod: 'none',
          },
          permissions: ['network'],
          size: '0.5MB',
        }

        setPlugin(pluginData)
      } else {
        showError(`获取插件配置失败: ${response.message}`)
      }
    } catch (error) {
      console.error('获取插件配置失败:', error)
      showError('获取插件配置失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = async () => {
    if (!plugin_id || !pluginConfigData) {
      showError('插件数据未加载，请刷新页面')
      return
    }

    // Validate URL if it's a URL plugin (plugin_type === 1)
    if (pluginConfigData.plugin_type === 1) {
      const { validateHttpUrl } = await import('../../utils/validationUtils')
      const urlValidation = validateHttpUrl(configForm.url)
      if (!urlValidation.isValid) {
        showError(`服务地址格式错误: ${urlValidation.error}`)
        return
      }
    }

    try {
      const updateRequest = {
        space_id: getDefaultSpaceId(),
        plugin_id,
        plugin_version: pluginConfigData.plugin_version,
        name: configForm.name,
        desc: configForm.desc,
        plugin_type: pluginConfigData.plugin_type,
        published: pluginConfigData.published,
        url: configForm.url,
        icon_uri: configForm.icon_uri,
      }

      console.log('Updating plugin configuration:', updateRequest)

      // Call the API
      const response = await updatePluginApi.mutateAsync(updateRequest)

      if (response.code === 200) {
        showSuccess('插件配置保存成功')

        // Update local state
        setPluginConfigData(prev => ({
          ...prev,
          name: configForm.name,
          desc: configForm.desc,
          url: configForm.url,
          icon_uri: configForm.icon_uri,
        }))

        // Update plugin display
        setPlugin(prev =>
          prev
            ? {
                ...prev,
                name: configForm.name,
                description: configForm.desc,
                icon: configForm.icon_uri || '⚙️',
                config: {
                  ...prev.config,
                  url: configForm.url,
                },
              }
            : null,
        )
      } else {
        showError(`保存失败: ${response.message || '未知错误'}`)
      }
    } catch (error: unknown) {
      console.error('保存插件配置失败:', error)
      const errorMessage = error?.response?.data?.message || error?.message || '保存插件配置失败，请稍后重试'
      showError(errorMessage)
    }
  }

  const handlePluginSubmit = async (isEditing: boolean = false) => {
    // Validate required fields
    const validation = validateForm()
    if (!validation.isValid) {
      showError(validation.errors[0])
      return
    }

    if (isEditing && editingPlugin) {
      // Update existing plugin
      const updatedPlugin: Plugin = {
        ...editingPlugin,
        name: cloudPluginForm.name.trim(),
        description: cloudPluginForm.description.trim(),
        config: {
          ...editingPlugin.config,
          url: cloudPluginForm.url.trim(),
          authMethod: cloudPluginForm.authMethod,
        },
        lastUpdate: new Date().toISOString().split('T')[0],
      }

      // Update plugin state
      setPlugin(updatedPlugin)

      // Here you would typically send the data to your backend API
      console.log('Updating plugin:', updatedPlugin)
      showSuccess(`插件"${updatedPlugin.name}"更新成功`)
      setIsEditDialogOpen(false)
      setEditingPlugin(null)
    }

    // Reset form
    resetForm()
  }

  const handlePublishPlugin = async (version: string, versionDesc: string) => {
    if (!plugin_id) {
      showError('插件ID不存在，无法发布')
      return
    }

    try {
      const publishRequest = {
        space_id: getDefaultSpaceId(),
        plugin_id,
        plugin_version: version,
        version_desc: versionDesc,
        force: false,
      }

      console.log('Publishing plugin:', publishRequest)

      const response = await publishPluginApi.mutateAsync(publishRequest)

      if (response.code === 200) {
        showSuccess(`插件"${plugin?.name || plugin_id}"发布成功！`)
        setIsPublishDialogOpen(false)

        // Optionally refresh plugin data to get latest publish status
        await loadPluginData()
      } else {
        showError(`发布失败: ${response.message || '未知错误'}`)
      }
    } catch (error: unknown) {
      console.error('发布插件失败:', error)
      const errorMessage = error?.response?.data?.message || error?.message || '发布插件失败，请稍后重试'
      showError(errorMessage)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <CircularProgress size={48} className="mb-4" />
          <Typography variant="body1" color="text.secondary">
            {t('plugins.config.loading')}
          </Typography>
        </div>
      </div>
    )
  }

  if (!plugin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
          <Typography variant="h6" className="mb-2">
            插件未找到
          </Typography>
          <Typography variant="body2" color="text.secondary" className="mb-4">
            请检查插件ID是否正确
          </Typography>
          <Button variant="contained" onClick={() => navigate('/dashboard/plugins')}>
            返回插件管理
          </Button>
        </div>
      </div>
    )
  }

  // Render the appropriate configuration component based on plugin type
  const renderPluginConfiguration = () => {
    if (pluginConfigData?.plugin_type === 2) {
      // Code Plugin (type 2)
      return (
        <CodePluginConfiguration
          plugin={plugin}
          pluginConfigData={pluginConfigData}
          loading={loading}
          plugin_id={plugin_id}
          configForm={configForm}
          toolsLoading={false}
          iconOptions={iconOptions}
          toolsQuery={null}
          setConfigForm={setConfigForm}
          handleSaveConfig={handleSaveConfig}
          handleIconSelect={handleIconSelect}
          handleNameChange={handleNameChange}
          editingPlugin={editingPlugin}
          setEditingPlugin={setEditingPlugin}
          resetForm={resetForm}
          cloudPluginForm={cloudPluginForm}
          handleCloudPluginFormChange={handleCloudPluginFormChange}
          handleHeaderChange={handleHeaderChange}
          addHeaderRow={addHeaderRow}
          removeHeaderRow={removeHeaderRow}
          isEditDialogOpen={isEditDialogOpen}
          setIsEditDialogOpen={setIsEditDialogOpen}
          handlePluginSubmit={handlePluginSubmit}
          isPublishDialogOpen={isPublishDialogOpen}
          setIsPublishDialogOpen={setIsPublishDialogOpen}
        />
      )
    } else {
      // URL Plugin (type 1 - default)
      return (
        <URLPluginConfiguration
          plugin={plugin}
          pluginConfigData={pluginConfigData}
          loading={loading}
          plugin_id={plugin_id}
          configForm={configForm}
          toolsLoading={false}
          iconOptions={iconOptions}
          toolsQuery={null}
          setConfigForm={setConfigForm}
          handleSaveConfig={handleSaveConfig}
          handleIconSelect={handleIconSelect}
          handleNameChange={handleNameChange}
          editingPlugin={editingPlugin}
          setEditingPlugin={setEditingPlugin}
          resetForm={resetForm}
          cloudPluginForm={cloudPluginForm}
          handleCloudPluginFormChange={handleCloudPluginFormChange}
          handleHeaderChange={handleHeaderChange}
          addHeaderRow={addHeaderRow}
          removeHeaderRow={removeHeaderRow}
          isEditDialogOpen={isEditDialogOpen}
          setIsEditDialogOpen={setIsEditDialogOpen}
          handlePluginSubmit={handlePluginSubmit}
          isPublishDialogOpen={isPublishDialogOpen}
          setIsPublishDialogOpen={setIsPublishDialogOpen}
        />
      )
    }
  }

  return (
    <>
      {/* Render the appropriate configuration component */}
      {renderPluginConfiguration()}

      {/* Unified Snackbar */}
      <UnifiedSnackbar snackbar={snackbar} onClose={closeSnackbar} />

      {/* Shared Cloud Plugin Form Dialog */}
      <CloudPluginFormDialog
        open={isEditDialogOpen}
        isEditing={true}
        form={cloudPluginForm}
        editingPlugin={editingPlugin}
        onFormChange={handleCloudPluginFormChange}
        onHeaderChange={handleHeaderChange}
        onAddHeader={addHeaderRow}
        onRemoveHeader={removeHeaderRow}
        onSubmit={handlePluginSubmit}
        onCancel={() => {
          setIsEditDialogOpen(false)
          setEditingPlugin(null)
          resetForm()
        }}
      />

      {/* Publish Dialog */}
      <PublishDialog
        open={isPublishDialogOpen}
        pluginName={plugin?.name || ''}
        pluginId={plugin_id || ''}
        onClose={() => setIsPublishDialogOpen(false)}
        onPublish={handlePublishPlugin}
        loading={publishPluginApi.isLoading}
      />
    </>
  )
}

export default PluginConfigurationPage
