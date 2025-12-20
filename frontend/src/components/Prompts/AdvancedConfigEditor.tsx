import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Chip,
  Paper,
  IconButton,
  FormControlLabel,
  TextField,
  Button,
  FormControl,
  Select,
  MenuItem,
  Alert,
  RadioGroup,
  Radio,
} from '@mui/material'
import { Settings, Cpu, Code, Copy, Edit, Trash2, Plus, ChevronRight, ChevronDown } from 'lucide-react'
import JsonEditor from './JsonEditor'
import ModelSelector from './ModelSelector'
import ModelParameterEditor from './ModelParameterEditor'
import ConditionalTooltip from './ConditionalTooltip'
import ToolSettingsPanel from './ToolSettingsPanel'
import { ModelConfig, Tool, Model, PromptParameter as Parameter } from '@/types/promptType'

export interface AdvancedConfigEditorProps {
  // 标签页状态
  activeTab: number
  onTabChange: (event: React.SyntheticEvent, newValue: number) => void
  readOnly?: boolean

  // 变量定义相关
  parameters: Parameter[]
  templateEngine: 'normal' | 'jinja2'
  onParametersChange: (parameters: Parameter[]) => void
  onParameterChange: (paramName: string, value: string) => void
  onParameterBlur?: (paramName: string, value: string) => void
  onCopyToClipboard: (content: string) => Promise<void>
  onEditVariable: (index: number) => void
  onDeleteVariable: (index: number) => void
  onAddVariable?: () => void
  editingParamId?: string | null
  onEditingParamIdChange?: (id: string | null) => void

  // 模型设置相关
  availableModels: Model[]
  selectedModel: Model | null
  modelConfig: ModelConfig
  onModelChange: (model: Model | null) => void
  onModelConfigChange: (config: ModelConfig) => void
  modelsLoading: boolean

  // 工具设置相关
  tools: Tool[]
  toolsEnabled: boolean
  onToolsChange: (tools: Tool[]) => void
  onToolsEnabledChange: (enabled: boolean) => void
  onAddTool: () => void
  onEditTool: (tool: Tool) => void
  onDeleteTool: (toolId: string) => void

  // 其他回调
  onHasUnsavedChanges: (hasChanges: boolean) => void
  onTriggerAutoSave: (data?: any) => void

  // 控制是否启用自动保存（主页面启用，对比模式不启用）
  enableAutoSave?: boolean
}

const AdvancedConfigEditor: React.FC<AdvancedConfigEditorProps> = ({
  activeTab,
  onTabChange,
  parameters,
  templateEngine,
  onParametersChange,
  onParameterChange,
  onParameterBlur,
  onCopyToClipboard,
  onEditVariable,
  onDeleteVariable,
  onAddVariable,
  editingParamId,
  onEditingParamIdChange,
  availableModels,
  selectedModel,
  modelConfig,
  onModelChange,
  onModelConfigChange,
  modelsLoading,
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
  readOnly = false,
}) => {
  const { t } = useTranslation()
  const isReadOnly = !!readOnly

  // 变量展开收起状态管理，默认展开
  const [variableExpanded, setVariableExpanded] = React.useState<{ [key: string]: boolean }>({})

  // 切换变量展开收起状态
  const toggleVariableExpanded = (paramName: string) => {
    if (isReadOnly) {
      return
    }
    setVariableExpanded(prev => ({
      ...prev,
      [paramName]: prev[paramName] === false ? true : false,
    }))
  }

  // 辅助函数：处理模型选择变更
  const handleModelChange = (model: Model | null) => {
    if (isReadOnly) {
      return
    }
    onModelChange(model)
    if (enableAutoSave) {
      onHasUnsavedChanges(true)
    }
  }

  // 辅助函数：处理模型配置变更
  const handleModelConfigChange = (newConfig: ModelConfig) => {
    if (isReadOnly) {
      return
    }
    onModelConfigChange(newConfig)
    if (enableAutoSave) {
      onHasUnsavedChanges(true)
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* 标签页导航 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={(event, newValue) => {
            if (isReadOnly) {
              return
            }
            onTabChange(event, newValue)
          }}
          aria-label={t('components.prompts.advancedConfigEditor.tabs.ariaLabel')}
          className="bg-white/60 rounded-t-lg"
        >
          <Tab
            disabled={isReadOnly}
            label={
              <div className="flex items-center space-x-2">
                <Settings className="w-4 h-4" />
                <span>{t('components.prompts.advancedConfigEditor.tabs.variableDefinition')}</span>
                <Chip label={parameters.length} size="small" className="bg-blue-100 text-blue-700 text-xs" />
              </div>
            }
          />
          <Tab
            disabled={isReadOnly}
            label={
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4" />
                <span>{t('components.prompts.advancedConfigEditor.tabs.modelSettings')}</span>
              </div>
            }
          />
          <Tab
            disabled={isReadOnly}
            label={
              <div className="flex items-center space-x-2">
                <Code className="w-4 h-4" />
                <span>{t('components.prompts.advancedConfigEditor.tabs.toolSettings')}</span>
                <Chip label={tools.length} size="small" className="bg-blue-100 text-blue-700 text-xs" />
              </div>
            }
          />
        </Tabs>
      </Box>

      {/* 变量定义标签页 */}
      <div role="tabpanel" hidden={activeTab !== 0} className="flex-1 flex-col p-4">
        {activeTab === 0 && (
          <div className="space-y-4 flex-1 flex flex-col">
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-425px)] scrollbar-hide">
              {parameters.length > 0 ? (
                parameters.map((param, index) => (
                  <Paper key={index} elevation={1} className="p-3 bg-white/80 border border-green-200">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-5 h-5 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg flex items-center justify-center">
                            <span className="text-white text-xs font-bold">{index + 1}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <ConditionalTooltip title={param.name}>
                              <Typography variant="subtitle2" className="text-gray-800 font-medium truncate" style={{ maxWidth: '200px' }}>
                                {param.name}
                              </Typography>
                            </ConditionalTooltip>
                          </div>
                          <IconButton
                            size="small"
                            disabled={isReadOnly}
                            onClick={() => toggleVariableExpanded(param.name)}
                            className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                            title={
                              variableExpanded[param.name] === undefined || variableExpanded[param.name] === true
                                ? t('components.prompts.advancedConfigEditor.variable.collapse')
                                : t('components.prompts.advancedConfigEditor.variable.expand')
                            }
                          >
                            {variableExpanded[param.name] === undefined || variableExpanded[param.name] === true ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </IconButton>
                        </div>
                        <div className="flex items-center space-x-2">
                          {templateEngine === 'normal' && (
                            <Chip
                              label={param.type === 'placeholder' ? 'Placeholder' : t('components.prompts.advancedConfigEditor.variable.autoGenerated')}
                              size="small"
                              className={param.type === 'placeholder' ? 'bg-purple-100 text-purple-700 text-xs' : 'bg-blue-100 text-blue-700 text-xs'}
                            />
                          )}
                          {templateEngine === 'jinja2' && param.type === 'placeholder' && (
                            <Chip label="Placeholder" size="small" className="bg-purple-100 text-purple-700 text-xs" />
                          )}
                          {templateEngine === 'jinja2' && param.dataType && param.type !== 'placeholder' && (
                            <Chip label={param.dataType} size="small" color="primary" variant="outlined" />
                          )}
                          <IconButton
                            size="small"
                            disabled={isReadOnly}
                            onClick={async () => {
                              if (isReadOnly) {
                                return
                              }
                              try {
                                await onCopyToClipboard(param.value)
                              } catch (error) {
                                console.error('复制失败:', error)
                              }
                            }}
                            className="text-blue-500 hover:bg-blue-50"
                            title={t('components.prompts.advancedConfigEditor.variable.copyVariableValue')}
                          >
                            <Copy className="w-4 h-4" />
                          </IconButton>
                          {templateEngine === 'jinja2' && (
                            <>
                              {/* placeholder类型变量不显示编辑按钮 */}
                              {param.type !== 'placeholder' && (
                                <IconButton
                                  size="small"
                                  disabled={isReadOnly}
                                  onClick={() => {
                                    if (isReadOnly) {
                                      return
                                    }
                                    onEditVariable(index)
                                  }}
                                  className="text-green-500 hover:bg-green-50"
                                  title={t('components.prompts.advancedConfigEditor.variable.editVariable')}
                                >
                                  <Edit className="w-4 h-4" />
                                </IconButton>
                              )}
                              <IconButton
                                size="small"
                                disabled={isReadOnly}
                                onClick={() => {
                                  if (isReadOnly) {
                                    return
                                  }
                                  onDeleteVariable(index)
                                }}
                                className="text-red-500 hover:bg-red-50"
                                title={t('components.prompts.advancedConfigEditor.variable.deleteVariable')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </IconButton>
                            </>
                          )}
                        </div>
                      </div>

                      {(variableExpanded[param.name] === undefined || variableExpanded[param.name] === true) && (
                        <div>
                          {param.type === 'placeholder' ? (
                            <div className="space-y-3">
                              <Typography variant="caption" className="text-gray-600">
                                {t('components.prompts.advancedConfigEditor.variable.configurePlaceholderMessages')}
                              </Typography>

                              {/* Placeholder消息列表 */}
                              <div className="space-y-3">
                                {param.messages?.map((msg, msgIndex) => {
                                  const getRoleStyles = (role: string) => {
                                    switch (role) {
                                      case 'system':
                                        return {
                                          bg: 'from-blue-500 to-cyan-500',
                                          text: 'text-blue-700',
                                          border: 'border-blue-200',
                                          lightBg: 'bg-blue-50',
                                        }
                                      case 'user':
                                        return {
                                          bg: 'from-purple-500 to-indigo-500',
                                          text: 'text-purple-700',
                                          border: 'border-purple-200',
                                          lightBg: 'bg-purple-50',
                                        }
                                      case 'assistant':
                                        return {
                                          bg: 'from-orange-500 to-red-500',
                                          text: 'text-orange-700',
                                          border: 'border-orange-200',
                                          lightBg: 'bg-orange-50',
                                        }
                                      default:
                                        return {
                                          bg: 'from-gray-500 to-gray-600',
                                          text: 'text-gray-700',
                                          border: 'border-gray-200',
                                          lightBg: 'bg-gray-50',
                                        }
                                    }
                                  }

                                  const roleStyles = getRoleStyles(msg.role)

                                  return (
                                    <div
                                      key={msg.id}
                                      className={`bg-white/80 border ${roleStyles.border} rounded-lg p-2 shadow-sm hover:shadow-sm transition-shadow`}
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <FormControl size="small" className="min-w-[140px]" disabled={isReadOnly}>
                                            <Select
                                              value={msg.role}
                                              onChange={e => {
                                                if (isReadOnly) {
                                                  return
                                                }
                                                const newParams = [...parameters]
                                                if (newParams[index].messages) {
                                                  newParams[index].messages![msgIndex].role = e.target.value as any
                                                  onParametersChange(newParams)
                                                }
                                              }}
                                              disabled={isReadOnly}
                                              renderValue={value => {
                                                const roleLabels: Record<string, string> = {
                                                  system: 'System',
                                                  user: 'User',
                                                  assistant: 'Assistant',
                                                }
                                                return roleLabels[value] || value
                                              }}
                                              className={`${roleStyles.lightBg} ${roleStyles.text} font-medium`}
                                              sx={{
                                                '& .MuiOutlinedInput-notchedOutline': {
                                                  borderColor: roleStyles.border.replace('border-', ''),
                                                },
                                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                                  borderColor: roleStyles.text.replace('text-', ''),
                                                },
                                                height: '25px',
                                                fontSize: '15px',
                                                '& .MuiSelect-select': {
                                                  padding: '4px 8px',
                                                  fontSize: '15px',
                                                },
                                              }}
                                              MenuProps={{
                                                PaperProps: {
                                                  sx: {
                                                    maxHeight: 140,
                                                    '& .MuiMenuItem-root': {
                                                      fontSize: '12px',
                                                      padding: '6px 16px',
                                                      minHeight: 'auto',
                                                    },
                                                  },
                                                },
                                              }}
                                            >
                                              <MenuItem value="system">
                                                <span style={{ fontSize: '12px' }}>System</span>
                                              </MenuItem>
                                              <MenuItem value="user">
                                                <span style={{ fontSize: '12px' }}>User</span>
                                              </MenuItem>
                                              <MenuItem value="assistant">
                                                <span style={{ fontSize: '12px' }}>Assistant</span>
                                              </MenuItem>
                                            </Select>
                                          </FormControl>
                                        </div>

                                        <div className="flex items-center gap-1">
                                          <IconButton
                                            size="small"
                                            disabled={isReadOnly}
                                            onClick={async () => {
                                              if (isReadOnly) {
                                                return
                                              }
                                              try {
                                                await onCopyToClipboard(msg.content)
                                              } catch (error) {
                                                console.error('复制失败:', error)
                                              }
                                            }}
                                            className="text-blue-500 hover:bg-blue-50 transition-colors"
                                            title={t('components.prompts.advancedConfigEditor.variable.copyContent')}
                                          >
                                            <Copy className="w-3 h-3" />
                                          </IconButton>

                                          <IconButton
                                            size="small"
                                            disabled={isReadOnly}
                                            onClick={() => {
                                              if (isReadOnly) {
                                                return
                                              }
                                              const newParams = [...parameters]
                                              if (newParams[index].messages) {
                                                newParams[index].messages = newParams[index].messages!.filter((_, i) => i !== msgIndex)
                                                onParametersChange(newParams)
                                              }
                                            }}
                                            className="text-red-500 hover:bg-red-50 transition-colors"
                                            title={t('components.prompts.advancedConfigEditor.variable.deleteMessage')}
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </IconButton>
                                        </div>
                                      </div>

                                      <TextField
                                        size="small"
                                        multiline
                                        minRows={1}
                                        maxRows={8}
                                        fullWidth
                                        value={msg.content}
                                        onChange={e => {
                                          if (isReadOnly) {
                                            return
                                          }
                                          const newParams = [...parameters]
                                          if (newParams[index].messages) {
                                            newParams[index].messages![msgIndex].content = e.target.value
                                            onParametersChange(newParams)
                                          }
                                        }}
                                        disabled={isReadOnly}
                                        onFocus={() => onEditingParamIdChange?.(param.name + '_' + msgIndex)}
                                        onBlur={() => onEditingParamIdChange?.(null)}
                                        placeholder={t('components.prompts.advancedConfigEditor.variable.inputMessagePlaceholder', { role: msg.role })}
                                        className={`${roleStyles.lightBg}`}
                                        InputProps={{
                                          className: 'bg-white/60',
                                          sx: {
                                            '& .MuiOutlinedInput-notchedOutline': {
                                              borderColor: roleStyles.border.replace('border-', ''),
                                            },
                                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                              borderColor: roleStyles.text.replace('text-', ''),
                                            },
                                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                              borderColor: roleStyles.text.replace('text-', ''),
                                            },
                                            '& textarea': {
                                              resize: 'none',
                                              overflow: 'hidden',
                                            },
                                          },
                                        }}
                                        inputProps={{
                                          style: {
                                            fontSize: '13px',
                                            lineHeight: '1.5',
                                            minHeight: '20px',
                                          },
                                        }}
                                        autoFocus={editingParamId === param.name + '_' + msgIndex}
                                      />
                                    </div>
                                  )
                                })}
                              </div>

                              {/* 添加消息按钮 */}
                              <div className="flex justify-center mt-2">
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<Plus className="w-4 h-4" />}
                                  onClick={() => {
                                    if (isReadOnly) {
                                      return
                                    }
                                    const newParams = [...parameters]
                                    if (!newParams[index].messages) {
                                      newParams[index].messages = []
                                    }
                                    // 根据当前消息数量决定下一个消息的角色：偶数索引为user，奇数索引为assistant
                                    const nextRole = newParams[index].messages!.length % 2 === 0 ? 'user' : 'assistant'
                                    newParams[index].messages!.push({
                                      id: Date.now().toString(),
                                      role: nextRole,
                                      content: '',
                                    })
                                    onParametersChange(newParams)
                                  }}
                                  className="border-green-300 text-green-600 hover:bg-green-50 text-xs"
                                  disabled={isReadOnly}
                                >
                                  {t('components.prompts.advancedConfigEditor.variable.addMessage')}
                                </Button>
                              </div>
                            </div>
                          ) : param.dataType === 'boolean' ? (
                            <FormControl component="fieldset" fullWidth disabled={isReadOnly}>
                              <RadioGroup
                                value={param.value || 'false'}
                                onChange={e => {
                                  if (isReadOnly) {
                                    return
                                  }
                                  onParameterChange(param.name, e.target.value)
                                }}
                                row
                                className="gap-4"
                              >
                                <FormControlLabel
                                  value="true"
                                  control={<Radio size="small" disabled={isReadOnly} />}
                                  label="True"
                                  className="mr-6"
                                  disabled={isReadOnly}
                                />
                                <FormControlLabel value="false" control={<Radio size="small" disabled={isReadOnly} />} label="False" disabled={isReadOnly} />
                              </RadioGroup>
                            </FormControl>
                          ) : param.dataType === 'object' ? (
                            <div className="w-full">
                              <JsonEditor
                                value={param.value}
                                onChange={newValue => {
                                  if (isReadOnly) {
                                    return
                                  }
                                  onParameterChange(param.name, newValue)
                                }}
                                placeholder={t('components.prompts.advancedConfigEditor.variable.jsonPlaceholder')}
                                minHeight={40}
                                maxHeight={150}
                                className="bg-white/60"
                                disabled={isReadOnly}
                              />
                            </div>
                          ) : (
                            <TextField
                              fullWidth
                              size="small"
                              value={param.value}
                              onChange={e => {
                                if (isReadOnly) {
                                  return
                                }
                                onParameterChange(param.name, e.target.value)
                              }}
                              onBlur={e => {
                                if (isReadOnly) {
                                  return
                                }
                                onParameterBlur?.(param.name, e.target.value)
                              }}
                              placeholder={
                                param.dataType === 'integer'
                                  ? t('components.prompts.advancedConfigEditor.variable.integerPlaceholder')
                                  : param.dataType === 'float'
                                    ? t('components.prompts.advancedConfigEditor.variable.floatPlaceholder')
                                    : t('components.prompts.advancedConfigEditor.variable.variableReferencePlaceholder', { name: param.name })
                              }
                              className="bg-white/60"
                              variant="outlined"
                              disabled={isReadOnly}
                              sx={{
                                '& .MuiOutlinedInput-root': {
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
                          )}
                        </div>
                      )}
                    </div>
                  </Paper>
                ))
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Settings className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p>{t('components.prompts.advancedConfigEditor.variable.noVariables')}</p>
                  <p className="text-sm">{t('components.prompts.advancedConfigEditor.variable.variableDefinitionHint')}</p>
                </div>
              )}
            </div>

            {templateEngine === 'jinja2' && onAddVariable && (
              <div className="mt-4 text-center">
                <Button
                  variant="outlined"
                  startIcon={<Plus className="w-4 h-4" />}
                  onClick={e => {
                    if (isReadOnly) {
                      return
                    }
                    if (onAddVariable && typeof onAddVariable === 'function') {
                      onAddVariable()
                    } else {
                      console.error(`🔧 [ADVANCED-EDITOR] onAddVariable函数不存在或不是函数:`, onAddVariable)
                    }
                  }}
                  className="border-green-300 text-green-600 hover:bg-green-50"
                  disabled={isReadOnly}
                >
                  {t('components.prompts.advancedConfigEditor.variable.addVariable')}
                </Button>
              </div>
            )}

            {/* 页签底部提示文本 */}
            <div className="mt-6">
              <Alert severity="info">
                <Typography variant="body2">
                  {templateEngine === 'normal'
                    ? t('components.prompts.advancedConfigEditor.variable.normalModeHint')
                    : t('components.prompts.advancedConfigEditor.variable.jinja2ModeHint')}
                </Typography>
              </Alert>
            </div>
          </div>
        )}
      </div>

      {/* 模型设置标签页 */}
      <div role="tabpanel" hidden={activeTab !== 1} className="flex-1 flex-col p-4">
        {activeTab === 1 && (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto max-h-[calc(100vh-425px)] scrollbar-hide">
              {/* 模型选择区域 */}
              <div className="space-y-3">
                <Typography variant="h6" className="text-gray-800 font-bold">
                  {t('components.prompts.advancedConfigEditor.model.modelSelection')}
                </Typography>

                <div>
                  <ModelSelector
                    availableModels={availableModels}
                    selectedModel={selectedModel}
                    onModelChange={handleModelChange}
                    modelsLoading={modelsLoading}
                    placeholder={t('components.prompts.advancedConfigEditor.model.selectModel')}
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              {/* 分隔线 */}
              <div className="border-t border-gray-300 my-4"></div>

              {/* 参数配置区域 */}
              <div className="space-y-4">
                <Typography variant="h6" className="text-gray-800 font-bold">
                  {t('components.prompts.advancedConfigEditor.model.parameterConfig')}
                </Typography>

                <ModelParameterEditor
                  selectedModel={selectedModel}
                  modelConfig={modelConfig}
                  onModelConfigChange={handleModelConfigChange}
                  readonly={isReadOnly}
                />
              </div>

              {/* 页签底部提示文本 */}
              <div className="mt-6">
                <Alert severity="info">
                  <Typography variant="body2">{t('components.prompts.advancedConfigEditor.model.settingsHint')}</Typography>
                </Alert>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 工具设置标签页 */}
      <div role="tabpanel" hidden={activeTab !== 2} className="flex-1 flex-col p-4">
        {activeTab === 2 && (
          <ToolSettingsPanel
            tools={tools}
            toolsEnabled={toolsEnabled}
            onToolsChange={onToolsChange}
            onToolsEnabledChange={onToolsEnabledChange}
            onAddTool={onAddTool}
            onEditTool={onEditTool}
            onDeleteTool={onDeleteTool}
            onHasUnsavedChanges={onHasUnsavedChanges}
            onTriggerAutoSave={onTriggerAutoSave}
            enableAutoSave={enableAutoSave}
            isReadOnly={isReadOnly}
            showDefaultValue={true}
          />
        )}
      </div>
    </div>
  )
}

export default React.memo(AdvancedConfigEditor)
