import React from 'react'
import { useTranslation } from 'react-i18next'
import { Typography, Chip, Paper, FormControlLabel, Switch, TextField, Button, Alert } from '@mui/material'
import { Code } from 'lucide-react'
import ConditionalTooltip from './ConditionalTooltip'
import { Tool } from '@/types/promptType'

export interface ToolSettingsPanelProps {
  // 工具相关数据
  tools: Tool[]
  toolsEnabled: boolean

  // 事件回调
  onToolsChange: (tools: Tool[]) => void
  onToolsEnabledChange: (enabled: boolean) => void
  onAddTool: () => void
  onEditTool: (tool: Tool) => void
  onDeleteTool: (toolId: string) => void

  // 状态控制
  onHasUnsavedChanges: (hasChanges: boolean) => void
  onTriggerAutoSave: (data?: any) => void
  enableAutoSave?: boolean
  isReadOnly?: boolean
  showDefaultValue?: boolean
  showToolFunctionHint?: boolean // 控制是否显示工具函数提示信息，默认为 true
}

const ToolSettingsPanel: React.FC<ToolSettingsPanelProps> = ({
  tools,
  toolsEnabled,
  onToolsChange,
  onToolsEnabledChange,
  onAddTool,
  onEditTool,
  onDeleteTool,
  onHasUnsavedChanges,
  onTriggerAutoSave,
  enableAutoSave = false,
  isReadOnly = false,
  showDefaultValue = true,
  showToolFunctionHint = true,
}) => {
  const { t } = useTranslation()
  // 使用本地状态立即更新 UI，避免等待父组件状态更新导致的延迟
  const [localToolsEnabled, setLocalToolsEnabled] = React.useState(toolsEnabled)

  // 当父组件传入的 toolsEnabled 变化时，同步本地状态（用于外部状态更新）
  React.useEffect(() => {
    setLocalToolsEnabled(toolsEnabled)
  }, [toolsEnabled])

  return (
    <div className="flex-1 flex flex-col">
      {/* 工具列表区域 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-4">
          <Typography variant="h6" className="text-gray-800 font-bold">
            {t('components.prompts.toolEditDialog.toolList')}
          </Typography>
          <FormControlLabel
            disabled={isReadOnly}
            control={
              <Switch
                checked={localToolsEnabled}
                onChange={e => {
                  if (isReadOnly) {
                    return
                  }
                  const newToolsEnabled = e.target.checked
                  // 立即更新本地状态，确保 UI 立即响应
                  setLocalToolsEnabled(newToolsEnabled)
                  // 异步调用父组件回调，避免阻塞 UI 更新
                  // 使用 requestAnimationFrame 确保在下一个渲染周期执行
                  requestAnimationFrame(() => {
                    onToolsEnabledChange(newToolsEnabled)
                    onHasUnsavedChanges(true)
                    // 注意：不在这里触发自动保存，因为父组件的 onToolsEnabledChange 已经会触发自动保存
                    // 避免重复调用保存草稿API
                  })
                }}
                color="primary"
                size="small"
                disabled={isReadOnly}
              />
            }
            label={
              <Typography variant="body2" className="text-gray-700">
                {t('components.prompts.toolEditDialog.enableTool')}
              </Typography>
            }
            className="m-0"
          />
        </div>
        <Button
          size="small"
          variant="contained"
          startIcon={<Code className="w-4 h-4" />}
          onClick={() => {
            if (isReadOnly) {
              return
            }
            if (onAddTool && typeof onAddTool === 'function') {
              onAddTool()
            } else {
              console.error(`🔧 [TOOL-SETTINGS-PANEL] onAddTool函数不存在或不是函数:`, onAddTool)
            }
          }}
          disabled={!toolsEnabled || isReadOnly}
          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('components.prompts.toolEditDialog.addTool')}
        </Button>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-475px)] scrollbar-hide">
        {!toolsEnabled ? (
          <div className="text-center py-8">
            <Code className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <Typography variant="body1" className="text-gray-500 mb-2">
              {t('components.prompts.toolEditDialog.toolDisabled')}
            </Typography>
            <Typography variant="body2" className="text-gray-400">
              {t('components.prompts.toolEditDialog.enableToolHint')}
            </Typography>
          </div>
        ) : tools.length > 0 ? (
          tools.map((tool, index) => (
            <Paper key={tool.id} elevation={1} className="p-3 bg-white/80 border border-green-200">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{index + 1}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <ConditionalTooltip title={tool.name}>
                        <Typography variant="subtitle2" className="text-gray-800 font-medium truncate" style={{ maxWidth: '200px' }}>
                          {tool.name}
                        </Typography>
                      </ConditionalTooltip>
                    </div>
                    <Chip
                      label={t('components.prompts.toolEditDialog.parameters', { count: tool.parameters?.length || 0 })}
                      size="small"
                      className="bg-blue-100 text-blue-700 text-xs"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="small"
                      onClick={() => {
                        if (isReadOnly) {
                          return
                        }
                        onEditTool(tool)
                      }}
                      className="text-green-600 hover:bg-green-50"
                      disabled={isReadOnly}
                    >
                      {t('components.prompts.toolEditDialog.edit')}
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        if (isReadOnly) {
                          return
                        }
                        onDeleteTool(tool.id)
                      }}
                      className="text-red-600 hover:bg-red-50"
                      disabled={isReadOnly}
                    >
                      {t('components.prompts.toolEditDialog.delete')}
                    </Button>
                  </div>
                </div>
                <ConditionalTooltip title={tool.description}>
                  <Typography variant="body2" className="text-gray-600 truncate" style={{ maxWidth: '100%' }}>
                    {tool.description}
                  </Typography>
                </ConditionalTooltip>

                {/* 默认模拟值显示和编辑 */}
                {showDefaultValue && (
                  <div className="mt-3 flex items-center space-x-3">
                    <Typography variant="caption" className="text-gray-700 font-medium whitespace-nowrap">
                      {t('components.prompts.toolEditDialog.defaultMockValue')}
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      minRows={1}
                      maxRows={2}
                      value={tool.defaultValue || ''}
                      onChange={e => {
                        if (isReadOnly) {
                          return
                        }
                        const newTools = tools.map(t => (t.id === tool.id ? { ...t, defaultValue: e.target.value } : t))
                        onToolsChange(newTools)
                        onHasUnsavedChanges(true)
                        // 如果启用了自动保存，触发自动保存
                        if (enableAutoSave && onTriggerAutoSave) {
                          onTriggerAutoSave({
                            tools: newTools,
                            toolsEnabled: toolsEnabled,
                          })
                        }
                      }}
                      onBlur={e => {
                        if (isReadOnly) {
                          return
                        }
                        const newTools = tools.map(t => (t.id === tool.id ? { ...t, defaultValue: e.target.value } : t))
                        onToolsChange(newTools)
                        onHasUnsavedChanges(true)
                        // 如果启用了自动保存，触发自动保存
                        if (enableAutoSave && onTriggerAutoSave) {
                          onTriggerAutoSave({
                            tools: newTools,
                            toolsEnabled: toolsEnabled,
                          })
                        }
                      }}
                      placeholder={t('components.prompts.toolEditDialog.defaultMockValuePlaceholder')}
                      variant="outlined"
                      disabled={isReadOnly}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: 'rgba(255, 255, 255, 0.8)',
                          fontSize: '13px',
                          '& fieldset': {
                            borderColor: '#d1d5db',
                          },
                          '&:hover fieldset': {
                            borderColor: '#9ca3af',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#10b981',
                          },
                        },
                      }}
                    />
                  </div>
                )}
              </div>
            </Paper>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Code className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>{t('components.prompts.toolEditDialog.noTools')}</p>
            <p className="text-sm">{t('components.prompts.toolEditDialog.addToolHint')}</p>
          </div>
        )}
      </div>

      {/* 页签底部提示文本 */}
      {showToolFunctionHint && (
        <div className="mt-6">
          <Alert severity="info">
            <Typography variant="body2">{t('components.prompts.toolEditDialog.toolFunctionHint')}</Typography>
          </Alert>
        </div>
      )}
    </div>
  )
}

export default ToolSettingsPanel
