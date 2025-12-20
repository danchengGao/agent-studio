import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Tooltip,
  CircularProgress,
} from '@mui/material'
import { Info, Code, Terminal } from 'lucide-react'

interface IDEPluginForm {
  name: string
  description: string
  runtime: 'python3' | 'nodejs'
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

interface IDEPluginFormDialogProps {
  open: boolean
  isEditing: boolean
  loading?: boolean
  form: IDEPluginForm
  editingPlugin: Plugin | null
  onFormChange: (_field: string, _value: unknown) => void
  onSubmit: (_isEditing: boolean) => void
  onCancel: () => void
}

const runtimeOptions = [
  { value: 'python3', label: 'Python 3', icon: '🐍', description: '适用于数据分析、机器学习、自动化脚本' },
  { value: 'nodejs', label: 'Node.js', icon: '🟢', description: '适用于Web API、实时应用、前端构建工具' },
]

const IDEPluginFormDialog: React.FC<IDEPluginFormDialogProps> = ({
  open,
  isEditing,
  loading = false,
  form,
  _editingPlugin,
  onFormChange,
  onSubmit,
  onCancel,
}) => {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth>
      <DialogTitle className="flex items-center space-x-2">
        <Code className="w-5 h-5 text-blue-600" />
        <span>{isEditing ? '编辑本地代码插件' : '创建本地代码插件'}</span>
      </DialogTitle>

      <DialogContent>
        <div className="space-y-6">
          {/* Plugin Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center">
              插件名称 <span className="text-red-500 ml-1">*</span>
              <Tooltip title="为插件起一个简洁明了的名称，便于识别和管理" placement="top">
                <Info className="w-4 h-4 ml-1 text-gray-400 cursor-help" />
              </Tooltip>
            </label>
            <TextField
              value={form.name}
              onChange={e => onFormChange('name', e.target.value)}
              fullWidth
              required
              placeholder="例如：数据处理器、API调用器、文件转换器"
              helperText={`建议使用简洁明了的名称，避免特殊字符 (${form.name.length}/20)`}
              inputProps={{ maxLength: 20 }}
            />
          </div>

          {/* Plugin Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center">
              插件描述 <span className="text-red-500 ml-1">*</span>
              <Tooltip title="详细描述插件的功能、用途、适用场景等" placement="top">
                <Info className="w-4 h-4 ml-1 text-gray-400 cursor-help" />
              </Tooltip>
            </label>
            <TextField
              value={form.description}
              onChange={e => onFormChange('description', e.target.value)}
              fullWidth
              required
              multiline
              rows={3}
              placeholder="详细描述插件的主要功能、适用场景、输入输出格式、依赖要求等..."
              helperText={`建议包含：主要功能、适用场景、调用方式、注意事项等信息 (${form.description.length}/40)`}
              inputProps={{ maxLength: 40 }}
            />
          </div>

          {/* Runtime Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center">
              IDE运行时 <span className="text-red-500 ml-1">*</span>
              <Tooltip title="选择插件运行的编程语言环境" placement="top">
                <Info className="w-4 h-4 ml-1 text-gray-400 cursor-help" />
              </Tooltip>
            </label>
            <FormControl fullWidth required>
              <InputLabel>运行时环境</InputLabel>
              <Select value={form.runtime} onChange={e => onFormChange('runtime', e.target.value)} label="运行时环境">
                {runtimeOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    <div className="flex flex-col space-y-1 py-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{option.icon}</span>
                        <span className="font-medium">{option.label}</span>
                      </div>
                      <span className="text-xs text-gray-500 ml-8">{option.description}</span>
                    </div>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>

          {/* Runtime Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Terminal className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-900 mb-2">运行时环境说明</h4>
                <div className="space-y-2 text-sm text-blue-800">
                  <div>
                    <strong>Python 3:</strong> 适合数据处理、机器学习、科学计算、自动化脚本等场景
                  </div>
                  <div>
                    <strong>Node.js:</strong> 适合Web API开发、实时通信、前端构建工具、微服务等场景
                  </div>
                  <div className="text-blue-600 text-xs mt-2">💡 选择合适的运行时环境有助于获得最佳性能和兼容性</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>

      <DialogActions className="px-6 pb-4">
        <Button onClick={onCancel} variant="outlined" disabled={loading}>
          取消
        </Button>
        <Button
          onClick={() => onSubmit(isEditing)}
          variant="contained"
          color="primary"
          disabled={loading || !form.name.trim() || !form.description.trim() || !form.runtime}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          {loading ? (
            <>
              <CircularProgress size={16} className="mr-2" />
              {isEditing ? '保存中...' : '创建中...'}
            </>
          ) : isEditing ? (
            '保存修改'
          ) : (
            '创建插件'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default IDEPluginFormDialog
