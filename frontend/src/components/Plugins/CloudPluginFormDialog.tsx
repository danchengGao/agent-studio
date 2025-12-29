import React from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Tooltip, CircularProgress, Typography } from '@mui/material'
import { Info } from 'lucide-react'

interface CloudPluginForm {
  name: string
  description: string
  url: string
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
  onSubmit,
  onCancel,
}) => {
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
  const isFormValid = form.name.trim() && form.description.trim() && form.url.trim() && isUrlValid && isUrlLengthValid
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth>
      <DialogTitle>{isEditing ? '编辑云侧插件' : '创建云侧插件'}</DialogTitle>
      <DialogContent>
        <div className="space-y-6">
          {/* Plugin Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center">
              插件名称 <span className="text-red-500 ml-1">*</span>
            </label>
            <TextField
              value={form.name}
              onChange={e => onFormChange('name', e.target.value)}
              fullWidth
              required
              placeholder="例如：高德地图API、天气服务、支付接口等"
              helperText={`建议使用简洁明了的名称，便于识别和管理 (${form.name.length}/20)`}
              inputProps={{ maxLength: 20 }}
            />
          </div>

          {/* Plugin Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center">
              插件描述 <span className="text-red-500 ml-1">*</span>
            </label>
            <TextField
              value={form.description}
              onChange={e => onFormChange('description', e.target.value)}
              fullWidth
              required
              multiline
              rows={3}
              placeholder="详细描述插件的功能、用途、适用场景等..."
              helperText={`建议包含：主要功能、适用场景、调用方式等信息 (${form.description.length}/40)`}
              inputProps={{ maxLength: 40 }}
            />
          </div>

          {/* Plugin URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center">
              插件URL <span className="text-red-500 ml-1">*</span>
            </label>
            <TextField
              value={form.url}
              onChange={e => onFormChange('url', e.target.value)}
              fullWidth
              required
              placeholder="例如：http://api.example.com/plugin 或 http://localhost:8080/api"
              helperText={
                form.url && !isUrlValid
                  ? '请输入有效的HTTP或HTTPS地址'
                  : form.url && !isUrlLengthValid
                    ? `URL长度不能超过${MAX_URL_BYTES}字节（当前：${getUrlByteLength(form.url)}字节）`
                    : `请提供完整的API服务地址，包含协议(http)（${form.url ? getUrlByteLength(form.url) : 0}/${MAX_URL_BYTES}字节）`
              }
              error={Boolean(form.url && (!isUrlValid || !isUrlLengthValid))}
            />
          </div>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>取消</Button>
        <Button onClick={() => onSubmit(isEditing)} variant="contained" color="primary" disabled={!isFormValid || loading}>
          {loading ? (
            <>
              <CircularProgress size={16} className="mr-2" />
              创建中...
            </>
          ) : isEditing ? (
            '保存修改'
          ) : (
            '创建'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default CloudPluginFormDialog
