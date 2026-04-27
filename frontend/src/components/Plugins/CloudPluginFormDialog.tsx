import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  RadioGroup,
  FormControlLabel,
  Radio,
} from '@mui/material'

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
  header_configuration?: Array<{ name: string; value: string; description?: string; type?: string; send_method?: string }>
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

interface CloudPluginFormDialogProps {
  open: boolean
  isEditing: boolean
  loading?: boolean
  form: CloudPluginForm
  editingPlugin: Plugin | null
  onFormChange: (_field: string, _value: unknown) => void
  onHeaderChange?: (_index: number, _field: string, _value: string) => void
  onAddHeader?: () => void
  onRemoveHeader?: (_index: number) => void
  onSubmit: (_isEditing: boolean) => void
  onCancel: () => void
}

const CloudPluginFormDialog: React.FC<CloudPluginFormDialogProps> = ({
  open,
  isEditing,
  loading = false,
  form,
  _editingPlugin,
  onFormChange,
  onHeaderChange,
  onAddHeader,
  onRemoveHeader,
  onSubmit,
  onCancel,
}) => {
  const { t } = useTranslation()
  // URL validation function
  const isValidUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }

  // Check URL length (1000 bytes max)
  const MAX_URL_BYTES = 1000
  const getUrlByteLength = (url: string): number => {
    return new Blob([url]).size
  }
  const isUrlLengthValid = form.url ? getUrlByteLength(form.url) <= MAX_URL_BYTES : true

  // Check if URL is valid for UI feedback
  const isUrlValid = form.url ? isValidUrl(form.url) : true

  // Form validation - check if all required fields are valid
  const normalizedAuthMethod = (form.authMethod || 'none').toLowerCase()
  const requiresOAuthFields = normalizedAuthMethod === 'oauth2'
  const requiresApiKeyFields = normalizedAuthMethod === 'api_key'
  const hasApiKeyRequiredFields = form.apiKeyParamName?.trim() && form.apiKeyValue?.trim()
  const hasOAuthRequiredFields = form.oauthEndpointUrl?.trim() && form.oauthClientId?.trim() && form.oauthClientSecret?.trim()
  const isFormValid =
    form.name.trim() &&
    form.description.trim() &&
    form.url.trim() &&
    isUrlValid &&
    isUrlLengthValid &&
    (!requiresApiKeyFields || hasApiKeyRequiredFields) &&
    (!requiresOAuthFields || hasOAuthRequiredFields)

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth>
      <DialogTitle>{isEditing ? t('plugins.dialog.editPlugin.title') : t('plugins.dialog.cloudPluginForm.create')}</DialogTitle>
      <DialogContent>
        <div className="space-y-6">
          {/* Plugin Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center">
              {t('plugins.dialog.cloudPluginForm.name')} <span className="text-red-500 ml-1">*</span>
            </label>
            <TextField
              value={form.name}
              onChange={e => onFormChange('name', e.target.value)}
              fullWidth
              required
              placeholder={t('plugins.dialog.cloudPluginForm.namePlaceholder')}
              helperText={`${t('plugins.dialog.cloudPluginForm.nameHelperText')} (${form.name.length}/128)`}
              inputProps={{ maxLength: 128 }}
            />
          </div>

          {/* Plugin Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center">
              {t('plugins.dialog.cloudPluginForm.description')} <span className="text-red-500 ml-1">*</span>
            </label>
            <TextField
              value={form.description}
              onChange={e => onFormChange('description', e.target.value)}
              fullWidth
              required
              multiline
              rows={3}
              placeholder={t('plugins.dialog.cloudPluginForm.descriptionPlaceholder')}
              helperText={`${t('plugins.dialog.cloudPluginForm.descriptionHelperText')} (${form.description.length}/258)`}
              inputProps={{ maxLength: 258 }}
            />
          </div>

          {/* Plugin Markdown Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center">
              {t('plugins.dialog.cloudPluginForm.detailsLabel')} <span className="text-gray-400 ml-1">{t('plugins.dialog.cloudPluginForm.optional')}</span>
            </label>
            <TextField
              value={form.desc_mk || ''}
              onChange={e => onFormChange('desc_mk', e.target.value)}
              fullWidth
              multiline
              rows={6}
              placeholder={t('plugins.dialog.cloudPluginForm.detailsPlaceholder')}
              helperText={t('plugins.dialog.cloudPluginForm.detailsHelperText', { count: (form.desc_mk || '').length })}
            />
          </div>

          {/* Plugin URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center">
              {t('plugins.dialog.cloudPluginForm.url')} <span className="text-red-500 ml-1">*</span>
            </label>
            <TextField
              value={form.url}
              onChange={e => onFormChange('url', e.target.value)}
              fullWidth
              required
              placeholder={t('plugins.dialog.cloudPluginForm.urlPlaceholder')}
              helperText={
                form.url && !isUrlValid
                  ? t('plugins.dialog.cloudPluginForm.urlInvalid')
                  : form.url && !isUrlLengthValid
                    ? t('plugins.dialog.cloudPluginForm.urlLengthError', { max: MAX_URL_BYTES, current: getUrlByteLength(form.url) })
                    : t('plugins.dialog.cloudPluginForm.urlHelper', { current: form.url ? getUrlByteLength(form.url) : 0, max: MAX_URL_BYTES })
              }
              error={Boolean(form.url && (!isUrlValid || !isUrlLengthValid))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center">
              鉴权方式 <span className="text-red-500 ml-1">*</span>
            </label>
            <FormControl fullWidth size="small">
              <InputLabel id="plugin-auth-method-label">鉴权方式</InputLabel>
              <Select
                labelId="plugin-auth-method-label"
                value={form.authMethod || 'none'}
                label="鉴权方式"
                onChange={e => onFormChange('authMethod', e.target.value)}
              >
                <MenuItem value="none">无需鉴权</MenuItem>
                <MenuItem value="api_key">API Key</MenuItem>
                <MenuItem value="oauth2">OAuth2.0</MenuItem>
              </Select>
            </FormControl>
          </div>

          {normalizedAuthMethod === 'api_key' && (
            <div className="space-y-3 rounded-md border border-gray-200 p-3">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                位置 <span className="text-red-500">*</span>
              </label>
              <div className="text-xs text-gray-500">
                决定将 API Key 传给服务器的位置：Header 放在请求头中，Query 放在 URL 查询参数中。
              </div>
              <FormControl component="fieldset">
                <RadioGroup
                  row
                  value={form.apiKeyLocation || 'header'}
                  onChange={e => onFormChange('apiKeyLocation', e.target.value)}
                >
                  <FormControlLabel value="header" control={<Radio size="small" />} label="Header" />
                  <FormControlLabel value="query" control={<Radio size="small" />} label="Query" />
                </RadioGroup>
              </FormControl>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">Parameter name <span className="text-red-500">*</span></label>
                <TextField
                  fullWidth
                  size="small"
                  value={form.apiKeyParamName || ''}
                  onChange={e => onFormChange('apiKeyParamName', e.target.value)}
                  placeholder="请输入 Parameter Name"
                  inputProps={{ maxLength: 100 }}
                  helperText={`${(form.apiKeyParamName || '').length}/100`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">API Key <span className="text-red-500">*</span></label>
                <TextField
                  fullWidth
                  size="small"
                  value={form.apiKeyValue || ''}
                  onChange={e => onFormChange('apiKeyValue', e.target.value)}
                  placeholder="请输入 API Key"
                  inputProps={{ maxLength: 2000 }}
                  helperText={`${(form.apiKeyValue || '').length}/2000`}
                />
              </div>
            </div>
          )}

          {requiresOAuthFields && (
            <div className="space-y-3">
              <TextField
                label="Endpoint URL"
                value={form.oauthEndpointUrl || ''}
                onChange={e => onFormChange('oauthEndpointUrl', e.target.value)}
                fullWidth
                required
                placeholder="http://sa.as"
              />
              <TextField
                label="Client ID"
                value={form.oauthClientId || ''}
                onChange={e => onFormChange('oauthClientId', e.target.value)}
                fullWidth
                required
                placeholder="客户端ID"
              />
              <TextField
                label="Client Secret"
                value={form.oauthClientSecret || ''}
                onChange={e => onFormChange('oauthClientSecret', e.target.value)}
                fullWidth
                required
                placeholder="客户端密钥"
              />
              <TextField
                label="Scope（可选）"
                value={form.oauthScope || ''}
                onChange={e => onFormChange('oauthScope', e.target.value)}
                fullWidth
                placeholder="例如：read write"
              />
            </div>
          )}

          {onHeaderChange && onAddHeader && onRemoveHeader && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Headers</label>
                <Button size="small" onClick={onAddHeader}>{t('common.buttons.add')}</Button>
              </div>
              {(form.header_configuration || []).map((header, index) => (
                <div key={`${header.name}-${index}`} className="grid grid-cols-12 gap-2 items-start">
                  <TextField className="col-span-4" label={t('plugins.dialog.pluginDetails.headerName')} value={header.name} onChange={e => onHeaderChange(index, 'name', e.target.value)} />
                  <TextField className="col-span-3" label={t('plugins.dialog.pluginDetails.defaultValue')} value={header.value} onChange={e => onHeaderChange(index, 'value', e.target.value)} />
                  <TextField className="col-span-4" label={t('plugins.description')} value={header.description || ''} onChange={e => onHeaderChange(index, 'description', e.target.value)} />
                  <div className="col-span-1 flex justify-end pt-2">
                    <Button color="error" onClick={() => onRemoveHeader(index)}>{t('common.buttons.delete')}</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{t('common.buttons.cancel')}</Button>
        <Button onClick={() => onSubmit(isEditing)} variant="contained" color="primary" disabled={!isFormValid || loading}>
          {loading ? (
            <>
              <CircularProgress size={16} className="mr-2" />
              {t('plugins.dialog.cloudPluginForm.saving')}
            </>
          ) : isEditing ? (
            t('plugins.dialog.cloudPluginForm.saveChanges')
          ) : (
            t('plugins.dialog.cloudPluginForm.create')
          )}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default CloudPluginFormDialog
