import React, { useRef, useEffect, useState } from 'react'
import { FormControl, Select, MenuItem, Chip, Tooltip, CircularProgress } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { Model } from '@/types/promptType'

export interface ModelSelectorProps {
  // 可用模型列表
  availableModels: Model[]
  // 当前选中的模型
  selectedModel: Model | null
  // 模型选择变更回调
  onModelChange: (model: Model | null) => void
  // 是否正在加载模型
  modelsLoading: boolean
  // 是否禁用选择器
  disabled?: boolean
  // 占位符文本
  placeholder?: string
  // 自定义样式类名
  className?: string
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  availableModels,
  selectedModel,
  onModelChange,
  modelsLoading,
  disabled = false,
  placeholder,
  className = 'bg-white/80',
}) => {
  const { t } = useTranslation()
  const defaultPlaceholder = placeholder || t('components.prompts.modelSelector.selectModel')
  const containerRef = useRef<HTMLDivElement>(null)
  const [menuWidth, setMenuWidth] = useState<number | undefined>(undefined)

  useEffect(() => {
    const updateMenuWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth
        setMenuWidth(width)
      }
    }
    updateMenuWidth()
    window.addEventListener('resize', updateMenuWidth)
    return () => window.removeEventListener('resize', updateMenuWidth)
  }, [])

  return (
    <div ref={containerRef} className="w-full">
      <FormControl fullWidth size="small" className={className}>
        <Select
          value={selectedModel ? `${selectedModel.model_from}|${selectedModel.openModel.model_id}` : ''}
          onChange={e => {
            if (e.target.value) {
              const [modelFrom, modelId] = e.target.value.split('|')
              const model = availableModels.find(m => m.openModel.model_id === modelId && m.model_from === modelFrom)
              onModelChange(model || null)
            } else {
              onModelChange(null)
            }
          }}
          displayEmpty
          disabled={modelsLoading || disabled}
          MenuProps={{
            PaperProps: {
              style: {
                width: menuWidth,
                maxWidth: menuWidth,
                maxHeight: 400,
              },
            },
            MenuListProps: {
              style: {
                maxHeight: 400,
                overflow: 'auto',
              },
            },
          }}
          renderValue={value => {
            if (!value) return <span className="text-gray-500">{defaultPlaceholder}</span>
            const [modelFrom, modelId] = value.split('|')
            const model = availableModels.find(m => m.openModel.model_id === modelId && m.model_from === modelFrom)
            if (!model) return <span className="text-gray-500">{defaultPlaceholder}</span>
            return (
              <div className="flex items-center space-x-2 min-w-0 w-full">
                <Tooltip title={model.openModel.name} placement="top" arrow>
                  <span className="font-medium truncate flex-1 min-w-0">{model.openModel.name}</span>
                </Tooltip>
                {model.tags && model.tags.length > 0 && (
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    {model.tags.slice(0, 3).map((tag, index) => (
                      <Chip key={index} label={tag} size="small" className="bg-blue-100 text-blue-800 text-xs" />
                    ))}
                    {model.tags.length > 3 && (
                      <Tooltip
                        title={
                          <div className="bg-white border border-white p-2 rounded shadow-sm space-y-1">
                            {model.tags.slice(3).map((tag, index) => (
                              <Chip key={index} label={tag} size="small" className="bg-blue-100 text-blue-800 text-xs" />
                            ))}
                          </div>
                        }
                        placement="top"
                        componentsProps={{
                          tooltip: {
                            sx: {
                              backgroundColor: 'transparent',
                              border: 'none',
                              boxShadow: 'none',
                              '& .MuiTooltip-arrow': {
                                color: 'white',
                              },
                            },
                          },
                        }}
                      >
                        <Chip label={`${model.tags.length - 3}+`} size="small" className="bg-gray-100 text-gray-600 text-xs cursor-help" />
                      </Tooltip>
                    )}
                  </div>
                )}
              </div>
            )
          }}
        >
          {modelsLoading ? (
            <MenuItem disabled>
              <div className="flex items-center space-x-2">
                <CircularProgress size={16} />
                <span>{t('components.prompts.modelSelector.loading')}</span>
              </div>
            </MenuItem>
          ) : availableModels.length === 0 ? (
            <MenuItem disabled>{t('components.prompts.modelSelector.noModels')}</MenuItem>
          ) : (
            // 创建模型分组映射
            (() => {
              const modelGroupsMap = new Map<string, typeof availableModels>()
              availableModels.forEach(model => {
                const seriesKey = `${model.model_from}|${model.series.name}|${t('components.prompts.modelSelector.providedBy', { vendor: model.series.vendor })}`
                if (!modelGroupsMap.has(seriesKey)) {
                  modelGroupsMap.set(seriesKey, [])
                }
                modelGroupsMap.get(seriesKey)!.push(model)
              })

              // 检查所有模型中的model_from值
              const allModelFroms = [...new Set(availableModels.map(model => model.model_from))]
              const shouldShowModelFrom = allModelFroms.length > 1

              return Array.from(modelGroupsMap.entries())
                .map(([seriesName, models], index) => {
                  // 获取第一个模型的信息
                  const firstModel = models[0]

                  return [
                    // 系列分组标题（添加分隔线）
                    <MenuItem key={`header-${seriesName}`} disabled className="bg-gray-50 font-semibold text-gray-700 opacity-100">
                      <div className="w-full">
                        {index > 0 && <div className="border-t border-gray-300 mb-2"></div>}
                        <div>
                          {firstModel.series.vendor} 协议
                          {shouldShowModelFrom && firstModel.model_from === 'config' && `（${t('components.prompts.modelSelector.systemBuiltIn')}）`}
                        </div>
                      </div>
                    </MenuItem>,
                    // 系列下的模型列表
                    ...models.map(model => (
                      <MenuItem
                        key={`${model.model_from}|${model.openModel.model_id}`}
                        value={`${model.model_from}|${model.openModel.model_id}`}
                        className="pl-6"
                      >
                        <div className="flex flex-col w-full min-w-0">
                          <div className="flex items-center space-x-2 min-w-0">
                            <Tooltip title={model.openModel.name} placement="top" arrow>
                              <span className="font-medium truncate flex-1 min-w-0">{model.openModel.name}</span>
                            </Tooltip>
                            {model.tags && model.tags.length > 0 && (
                              <div className="flex items-center space-x-1 flex-shrink-0">
                                {model.tags.slice(0, 3).map((tag, index) => (
                                  <Chip key={index} label={tag} size="small" className="bg-blue-100 text-blue-800 text-xs" />
                                ))}
                                {model.tags.length > 3 && (
                                  <Tooltip
                                    title={
                                      <div className="bg-white border border-white p-2 rounded shadow-sm space-y-1">
                                        {model.tags.slice(3).map((tag, index) => (
                                          <Chip key={index} label={tag} size="small" className="bg-blue-100 text-blue-800 text-xs" />
                                        ))}
                                      </div>
                                    }
                                    placement="top"
                                    componentsProps={{
                                      tooltip: {
                                        sx: {
                                          backgroundColor: 'transparent',
                                          border: 'none',
                                          boxShadow: 'none',
                                          '& .MuiTooltip-arrow': {
                                            color: 'white',
                                          },
                                        },
                                      },
                                    }}
                                  >
                                    <Chip label={`${model.tags.length - 3}+`} size="small" className="bg-gray-100 text-gray-600 text-xs cursor-help" />
                                  </Tooltip>
                                )}
                              </div>
                            )}
                          </div>
                          {model.openModel.desc && (
                            <Tooltip title={model.openModel.desc} placement="top" arrow>
                              <span className="text-sm text-gray-500 mt-1 truncate block">{model.openModel.desc}</span>
                            </Tooltip>
                          )}
                        </div>
                      </MenuItem>
                    )),
                  ]
                })
                .flat()
            })()
          )}
        </Select>
      </FormControl>
    </div>
  )
}

export default ModelSelector
