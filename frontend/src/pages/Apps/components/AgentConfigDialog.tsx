/**
 * Agent Configuration Dialog Component
 * 智能体配置弹窗
 * 采用左侧菜单 + 右侧表单的 Tab 标签页式布局
 * 支持通用配置、搜索配置和模板配置
 */

import React, { useState, useCallback } from 'react'
import { X, Check, Settings, Search, FileText, Loader2, AlertCircle, Plus, Edit, Trash2 } from 'lucide-react'
import { MentionItem } from './MentionPicker'
import { RADIUS_CONTAINER, RADIUS_BUTTON, RADIUS_CIRCLE } from '../constants/styles'
import { TemplateUploadDialog } from './config/template/TemplateUploadDialog'
import { TemplateViewDialog } from './config/template/TemplateViewDialog'
import { useTemplateApi } from './hooks/useTemplateApi'
import { useWebSearchEngineApi } from './hooks/useWebSearchEngineApi'
import { deepsearchTemplateService } from '@test-agentstudio/api-client'
import DeleteConfirmationDialog from '../../../components/Common/DeleteConfirmationDialog'
import { DEFAULT_DEEPSEARCH_CONFIG } from '../utils/deepsearchConstants'

// 导入新的配置标签系统
import { ConfigRegistryManager, ConfigTabId } from './config/ConfigRegistry'
import { ConfigSidebar } from './config/tabs/ConfigSidebar'
import { ConfigTabPanel } from './config/tabs/ConfigTabPanel'
import { GeneralConfigTab } from './config/tabs/GeneralConfigTab'
import { SearchConfigTab } from './config/tabs/SearchConfigTab'
import { TemplateConfigTab } from './config/tabs/TemplateConfigTab'
import { KnowledgeBaseConfigDialog } from './config/dialogs/KnowledgeBaseConfigDialog'

// ==================== 类型定义 ====================

// 报告模板类型
export interface ReportTemplate {
  template_id: number
  template_name: string
  template_desc: string
  create_time: string
}

export interface DeepSearchConfig {
  // 通用配置
  enableHumanInteraction: boolean
  planChapterCount: number // 范围: [1, 10]
  enableTraceability: boolean
  enableSourceTracerInfer: boolean // 溯源推理功能开关

  // 搜索配置
  searchMode: 'local' | 'web' | 'all'
  selectedWebSearchEngineId?: number // 搜索引擎配置ID（从后端获取）
  webSearchResultCount: number // 网络搜索返回结果数量，范围: [1, 10]
  localSearchResultCount: number // 本地搜索返回结果数量，范围: [1, 10]

  // 本地知识库配置
  selectedKnowledgeBaseIds: string[] // 选中的知识库ID列表
  recallThreshold: number // 最小匹配分数，范围: [0.0, 1.0]，默认 0.5

  // 模板配置
  enableTemplate: boolean // 是否启用模板
  selectedTemplateId?: number // 选中的模板ID
}

export interface AgentConfigDialogProps {
  agent: MentionItem | null
  open: boolean
  onClose: () => void
  onSave: (agentId: string, config: DeepSearchConfig) => void
  // 已保存的配置
  savedConfigs?: Record<string, DeepSearchConfig>
  // 用户空间ID（用于模板API）
  spaceId?: string
  // 模型配置ID（用于上传模板）
  modelConfigId?: number
  // 是否是首次配置模式（配置完成后才选中智能体）
  isFirstConfig?: boolean
}

// ==================== 辅助组件 ====================

/**
 * 开关组件
 */
const ToggleSwitch: React.FC<{
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}> = ({ checked, onChange, disabled = false }) => {
  return (
    <button
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`
        relative w-11 h-6 ${RADIUS_CIRCLE} transition-colors duration-200
        ${checked ? 'bg-blue-600' : 'bg-gray-300'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <span
        className={`
          absolute top-1 left-1 w-4 h-4 bg-white ${RADIUS_CIRCLE} shadow transition-transform duration-200
          ${checked ? 'translate-x-5' : ''}
        `}
      />
    </button>
  )
}

/**
 * 范围滑块组件
 */
const RangeSlider: React.FC<{
  label: string
  description: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  step?: number
}> = ({ label, description, value, min, max, onChange, step = 1 }) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-900">{description}</span>
        <span className="text-sm font-semibold text-blue-600">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className={`w-full h-2 bg-gray-200 ${RADIUS_BUTTON} appearance-none cursor-pointer accent-blue-600`}
      />
    </div>
  )
}

// ==================== 主组件 ====================

const AgentConfigDialog: React.FC<AgentConfigDialogProps> = ({
  agent,
  open,
  onClose,
  onSave,
  savedConfigs = {},
  spaceId = '',
  modelConfigId = -1,
  isFirstConfig = false
}) => {
  const [showSaved, setShowSaved] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [showEngineConfig, setShowEngineConfig] = useState(false)
  const [showEngineForm, setShowEngineForm] = useState(false)
  const [engineListRefreshTrigger, setEngineListRefreshTrigger] = useState(0)
  const [newlyCreatedEngineId, setNewlyCreatedEngineId] = useState<number | undefined>(undefined)
  const [editEngineState, setEditEngineState] = useState<{
    isOpen: boolean
    engineId: number
    spaceId: string
  } | null>(null)

  // ===== 新增：知识库相关状态 =====
  const [showKnowledgeBaseSelector, setShowKnowledgeBaseSelector] = useState(false)
  const [selectedKnowledgeBasesDetail, setSelectedKnowledgeBasesDetail] = useState<Array<{
    id: string
    name: string
    desc?: string
  }>>([])
  const [embeddingModelError, setEmbeddingModelError] = useState<string | null>(null)

  // 新增：当前激活的配置标签
  const [activeTab, setActiveTab] = useState<ConfigTabId>('general')

  // 删除确认对话框状态
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean
    itemType: 'template' | 'engine'
    itemName: string
    onConfirm: () => void
  }>({
    isOpen: false,
    itemType: 'template',
    itemName: '',
    onConfirm: () => {}
  })

  // 模板查看对话框状态
  const [viewDialog, setViewDialog] = useState<{
    isOpen: boolean
    templateId?: number
    templateName?: string
    templateDesc?: string
    templateContent?: string
    loading?: boolean
  }>({
    isOpen: false,
    templateId: undefined,
    templateName: undefined,
    templateDesc: undefined,
    templateContent: undefined,
    loading: false
  })

  // 初始化配置注册管理器
  const [registry] = useState(() => {
    const manager = new ConfigRegistryManager()
    // 注册默认配置标签
    manager.registerAll([
      {
        id: 'general',
        label: '通用配置',
        icon: <Settings className="w-5 h-5" />,
        description: '交互、规划等基础设置',
        component: GeneralConfigTab,
        order: 1,
      },
      {
        id: 'search',
        label: '搜索配置',
        icon: <Search className="w-5 h-5" />,
        description: '搜索引擎与结果设置',
        component: SearchConfigTab,
        order: 2,
      },
      {
        id: 'template',
        label: '模板配置',
        icon: <FileText className="w-5 h-5" />,
        description: '报告模板管理',
        component: TemplateConfigTab,
        order: 3,
      },
    ])
    return manager
  })

  // 模板 API Hook
  const { templates, loading: templatesLoading, fetchTemplates, deleteTemplate } = useTemplateApi({
    spaceId,
    autoLoad: open && !!spaceId
  })

  // 搜索引擎 API Hook
  const { engines, loading: enginesLoading, fetchEngines, deleteEngine } = useWebSearchEngineApi({
    spaceId,
    autoLoad: open && !!spaceId
  })

  // 获取当前智能体的配置
  const getCurrentConfig = useCallback((): DeepSearchConfig => {
    if (agent && savedConfigs[agent.id]) {
      // 合并保存的配置和默认配置，处理旧配置没有新增字段的情况
      return {
        ...DEFAULT_DEEPSEARCH_CONFIG,
        ...savedConfigs[agent.id],
      }
    }
    return DEFAULT_DEEPSEARCH_CONFIG
  }, [agent, savedConfigs])

  const [config, setConfig] = useState<DeepSearchConfig>(getCurrentConfig())

  // 当弹窗打开或智能体切换时，更新配置
  React.useEffect(() => {
    if (open) {
      setConfig(getCurrentConfig())
      setShowSaved(false)
      setUploadError(null)
    }
  }, [open, getCurrentConfig])

  // 验证配置
  const validateConfig = useCallback((): { valid: boolean; errors: string[] } => {
    const errors: string[] = []

    // 规划章节数量验证
    if (config.planChapterCount < 1 || config.planChapterCount > 10) {
      errors.push('规划章节数量必须在 1-10 之间')
    }

    // 综合搜索模式：需要同时配置搜索引擎和知识库
    if (config.searchMode === 'all') {
      const missingConfigs: string[] = []
      if (!config.selectedWebSearchEngineId) {
        missingConfigs.push('搜索引擎')
      }
      if (config.selectedKnowledgeBaseIds.length === 0) {
        missingConfigs.push('本地知识库')
      }
      if (missingConfigs.length > 0) {
        errors.push(`综合搜索模式下必须配置：${missingConfigs.join('、')}`)
      }
    } else {
      // 网络搜索模式：需要配置搜索引擎
      if (config.searchMode === 'web' && !config.selectedWebSearchEngineId) {
        errors.push('网络搜索模式下必须选择一个搜索引擎')
      }
      // 本地搜索模式：需要配置知识库
      if (config.searchMode === 'local' && config.selectedKnowledgeBaseIds.length === 0) {
        errors.push('本地搜索模式下必须选择至少一个知识库')
      }
    }

    // 搜索结果数量验证
    if (config.webSearchResultCount < 1 || config.webSearchResultCount > 10) {
      errors.push('网络搜索结果数量必须在 1-10 之间')
    }
    if (config.localSearchResultCount < 1 || config.localSearchResultCount > 10) {
      errors.push('本地搜索结果数量必须在 1-10 之间')
    }

    // Embedding模型一致性验证
    if (embeddingModelError) {
      errors.push(embeddingModelError)
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }, [config, embeddingModelError])

  const { valid, errors } = validateConfig()

  // 处理保存
  const handleSave = () => {
    if (!agent) return

    if (!valid) {
      return
    }

    onSave(agent.id, config)
    setShowSaved(true)
    setTimeout(() => {
      setShowSaved(false)
      onClose()
    }, 800)
  }

  // 更新配置（带联动逻辑）
  const updateConfig = useCallback(<K extends keyof DeepSearchConfig>(
    key: K,
    value: DeepSearchConfig[K]
  ) => {
    setConfig(prev => {
      const newConfig = { ...prev, [key]: value }

      // 联动逻辑 1: 切换到 local 模式时，清空搜索引擎选择
      if (key === 'searchMode' && value === 'local') {
        newConfig.selectedWebSearchEngineId = undefined
      }

      return newConfig
    })
  }, [])

  // 选择搜索引擎（单选）
  const handleSelectEngine = useCallback((engineId: number | undefined) => {
    updateConfig('selectedWebSearchEngineId', engineId)
  }, [updateConfig])

  // 选择模板（支持取消选中）
  const handleSelectTemplate = useCallback((templateId: number | undefined) => {
    updateConfig('selectedTemplateId', templateId)
    updateConfig('enableTemplate', templateId !== undefined)
  }, [updateConfig])

  // ===== 新增：知识库相关回调函数 =====

  // 加载知识库详细信息
  const loadKnowledgeBasesDetail = useCallback(async (kbIds: string[]) => {
    if (!spaceId || kbIds.length === 0) {
      setSelectedKnowledgeBasesDetail([])
      setEmbeddingModelError(null)
      return
    }

    try {
      const { KnowledgeBaseService } = await import('@test-agentstudio/api-client')

      const response = await KnowledgeBaseService.getKnowledgeBases({
        space_id: spaceId,
        page: 1,
        size: 100,
      })

      if (response.code === 200 && response.data) {
        const details = kbIds
          .map((kbId) => {
            const kb = response.data.items.find((item: any) => item.id === kbId)
            if (!kb) return null

            return {
              id: kb.id,
              name: kb.name,
              desc: kb.desc,
            }
          })
          .filter((d) => d !== null)

        setSelectedKnowledgeBasesDetail(details)

        // 验证embedding模型一致性（使用原始知识库数据）
        const kbsWithEmbeddingId = response.data.items
          .filter((item: any) => kbIds.includes(item.id))
          .map((item: any) => ({
            embedding_model_config_id: item.embedding_model_config_id,
          }))
        await validateEmbeddingModels(kbsWithEmbeddingId)
      }
    } catch (err) {
      console.error('Failed to load knowledge bases details:', err)
    }
  }, [spaceId])

  // 验证embedding模型一致性
  const validateEmbeddingModels = useCallback(async (kbs: Array<{ embedding_model_config_id?: number }>) => {
    if (!spaceId || kbs.length <= 1) {
      setEmbeddingModelError(null)
      return
    }

    try {
      const { embeddingModelService } = await import('@test-agentstudio/api-client')

      const modelKeys: string[] = []
      const modelNames: string[] = []

      for (const kb of kbs) {
        if (!kb.embedding_model_config_id) {
          setEmbeddingModelError('部分知识库未配置 Embedding 模型')
          return
        }

        const model = await embeddingModelService.getEmbeddingModelConfig(
          kb.embedding_model_config_id.toString(),
          spaceId
        )

        modelKeys.push(`${model.modelId}-${model.protocol}`)
        modelNames.push(`${model.name} (${model.modelId})`)
      }

      const uniqueKeys = Array.from(new Set(modelKeys))
      if (uniqueKeys.length > 1) {
        setEmbeddingModelError(`所选知识库使用了不同的 Embedding 模型：${modelNames.join('、')}`)
      } else {
        setEmbeddingModelError(null)
      }
    } catch (err) {
      console.error('Failed to validate embedding models:', err)
      setEmbeddingModelError('验证 Embedding 模型时出错')
    }
  }, [spaceId])

  // 当对话框打开或知识库 ID 变化时，加载详细信息
  React.useEffect(() => {
    if (open && spaceId) {
      if (config.selectedKnowledgeBaseIds && config.selectedKnowledgeBaseIds.length > 0) {
        loadKnowledgeBasesDetail(config.selectedKnowledgeBaseIds)
      } else {
        setSelectedKnowledgeBasesDetail([])
        setEmbeddingModelError(null)
      }
    } else if (!open) {
      // 对话框关闭时清空
      setSelectedKnowledgeBasesDetail([])
      setEmbeddingModelError(null)
    }
  }, [open, spaceId, config.selectedKnowledgeBaseIds, loadKnowledgeBasesDetail])

  // 打开知识库选择器
  const handleShowKnowledgeBaseSelector = useCallback(() => {
    setShowKnowledgeBaseSelector(true)
  }, [])

  // 确认选择知识库
  const handleConfirmKnowledgeBases = useCallback((kbIds: string[]) => {
    updateConfig('selectedKnowledgeBaseIds', kbIds)
    setShowKnowledgeBaseSelector(false)
  }, [updateConfig])

  // 删除知识库
  const handleRemoveKnowledgeBase = useCallback((kbId: string) => {
    const newIds = config.selectedKnowledgeBaseIds.filter(id => id !== kbId)
    updateConfig('selectedKnowledgeBaseIds', newIds)
  }, [config.selectedKnowledgeBaseIds, updateConfig])

  // 上传模板
  const handleUploadTemplate = async (file: File, templateName: string, templateDesc: string, isTemplate: boolean) => {
    if (!spaceId || modelConfigId === -1) {
      setUploadError('缺少必要的配置信息')
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      const templateId = await deepsearchTemplateService.importTemplate(
        spaceId,
        file,
        templateName,
        templateDesc,
        modelConfigId,
        isTemplate
      )

      // 自动选中新上传的模板
      handleSelectTemplate(templateId)

      await fetchTemplates()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '上传模板失败'
      setUploadError(errorMessage)
      throw err
    } finally {
      setUploading(false)
    }
  }

  // 删除模板
  const handleDeleteTemplate = (templateId: number) => {
    const template = templates.find(t => t.template_id === templateId)
    if (!template) return

    setDeleteDialog({
      isOpen: true,
      itemType: 'template',
      itemName: template.template_name,
      onConfirm: async () => {
        try {
          await deleteTemplate(templateId)
          if (config.selectedTemplateId === templateId) {
            handleSelectTemplate(undefined)
          }
          setDeleteDialog(prev => ({ ...prev, isOpen: false }))
        } catch (err) {
          console.error('删除模板失败:', err)
        }
      }
    })
  }

  // 修改搜索引擎
  const handleEditEngine = (engineId: number) => {
    const engine = engines.find(e => e.web_search_engine_id === engineId)
    if (!engine || !spaceId) return

    // 设置编辑状态
    setEditEngineState({
      isOpen: true,
      engineId,
      spaceId
    })
  }

  // 查看模板
  const handleViewTemplate = async (templateId: number) => {
    const template = templates.find(t => t.template_id === templateId)
    if (!template || !spaceId) return

    // 打开对话框并显示加载状态
    setViewDialog({
      isOpen: true,
      templateId,
      templateName: template.template_name,
      templateDesc: template.template_desc,
      templateContent: undefined,
      loading: true
    })

    try {
      // 获取模板内容
      console.log('[AgentConfigDialog] Fetching template content:', { spaceId, templateId })
      const content = await deepsearchTemplateService.getTemplateContent(spaceId, templateId)
      console.log('[AgentConfigDialog] Received template content:', {
        type: typeof content,
        length: content?.length,
        preview: content?.substring(0, 100)
      })
      setViewDialog(prev => ({
        ...prev,
        templateContent: content,
        loading: false
      }))
    } catch (err) {
      console.error('获取模板内容失败:', err)
      setViewDialog(prev => ({
        ...prev,
        loading: false
      }))
    }
  }

  // 只有deepsearch显示完整配置
  const isDeepSearch = agent?.id === 'deepsearch'

  // 获取排序后的标签列表
  const tabs = registry.getAllTabs()

  // 更新徽章状态（搜索配置需要配置时）
  React.useEffect(() => {
    if ((config.searchMode === 'web' || config.searchMode === 'all') && !config.selectedWebSearchEngineId) {
      registry.updateTab('search', { badge: true, badgeText: '需配置' })
    } else {
      registry.updateTab('search', { badge: false })
    }
  }, [config.searchMode, config.selectedWebSearchEngineId, registry])

  if (!open || !agent) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
        <div className={`bg-white ${RADIUS_CONTAINER} shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col`}>
          {/* 头部 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 bg-blue-100 ${RADIUS_BUTTON} flex items-center justify-center`}>
                <span className="text-blue-600 font-semibold text-sm">⚙</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {isFirstConfig ? '配置智能体以开始使用' : '确认或修改配置'}
                </h2>
                <p className="text-xs text-gray-500">
                  {agent.name}
                  {isFirstConfig ? ' · 请先完成配置' : ' · 可修改现有配置'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 ${RADIUS_BUTTON} transition-colors`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 内容区 - 左右分栏布局 */}
          {isDeepSearch ? (
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              {/* 左侧菜单 */}
              <ConfigSidebar
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />

              {/* 右侧内容 */}
              <ConfigTabPanel
                activeTab={registry.getTab(activeTab)!}
                tabProps={
                  activeTab === 'general' ? {
                    config,
                    updateConfig,
                    errors,
                    disabled: false,
                    ToggleSwitch,
                    RangeSlider,
                  } : activeTab === 'search' ? {
                    config,
                    updateConfig,
                    errors,
                    disabled: false,
                    RangeSlider,
                    engines,
                    enginesLoading,
                    onEditEngine: handleEditEngine,
                    onShowEngineConfig: () => setShowEngineConfig(true),
                    // 知识库相关 props
                    knowledgeBases: selectedKnowledgeBasesDetail,
                    onShowKnowledgeBaseSelector: handleShowKnowledgeBaseSelector,
                    onRemoveKnowledgeBase: handleRemoveKnowledgeBase,
                    embeddingModelError,
                  } : {
                    config,
                    updateConfig,
                    errors,
                    disabled: false,
                    templates,
                    templatesLoading,
                    uploading,
                    uploadError,
                    onSelectTemplate: handleSelectTemplate,
                    onDeleteTemplate: handleDeleteTemplate,
                    onShowUploadDialog: () => setShowUploadDialog(true),
                    onViewTemplate: handleViewTemplate,
                  }
                }
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">该智能体暂无可配置项</p>
              </div>
            </div>
          )}

          {/* 底部按钮 */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <button
              onClick={onClose}
              className={`px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-200 ${RADIUS_BUTTON} transition-all duration-200`}
            >
              取消选择
            </button>
            <button
              onClick={handleSave}
              disabled={!valid}
              className={`
                px-6 py-2 text-sm font-medium ${RADIUS_BUTTON} transition-all duration-200 flex items-center gap-2
                ${!valid
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : showSaved
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow'
                }
              `}
              title={!valid ? errors.join('; ') : undefined}
            >
              {showSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  已保存
                </>
              ) : (
                '保存配置'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 模板上传对话框 */}
      <TemplateUploadDialog
        open={showUploadDialog}
        onClose={() => {
          setShowUploadDialog(false)
          setUploadError(null)
        }}
        onConfirm={handleUploadTemplate}
        uploading={uploading}
      />

      {/* 搜索引擎选择对话框 */}
      <WebSearchEngineSelectorDialog
        open={showEngineConfig}
        onClose={() => {
          setShowEngineConfig(false)
          // 关闭对话框时清除新创建引擎标记
          setNewlyCreatedEngineId(undefined)
        }}
        spaceId={spaceId || ''}
        currentSelectedId={config.selectedWebSearchEngineId}
        refreshTrigger={engineListRefreshTrigger}
        newlyCreatedEngineId={newlyCreatedEngineId}
        onConfirm={(engineId) => {
          handleSelectEngine(engineId)
          // 用户确认后清除新创建引擎标记
          setNewlyCreatedEngineId(undefined)
        }}
        onEditEngine={(engineId) => {
          setEditEngineState({ isOpen: true, engineId, spaceId: spaceId || '' })
        }}
        onDeleteEngine={(engineId) => {
          const engine = engines.find(e => e.web_search_engine_id === engineId)
          if (!engine) return

          setDeleteDialog({
            isOpen: true,
            itemType: 'engine',
            itemName: engine.search_engine_name,
            onConfirm: async () => {
              try {
                await deleteEngine(engineId)
                if (config.selectedWebSearchEngineId === engineId) {
                  updateConfig('selectedWebSearchEngineId', undefined)
                }
                // 刷新主界面的引擎列表
                await fetchEngines()
                // 触发选择对话框刷新
                setEngineListRefreshTrigger(prev => prev + 1)
                setDeleteDialog(prev => ({ ...prev, isOpen: false }))
              } catch (err) {
                console.error('删除搜索引擎失败:', err)
              }
            }
          })
        }}
        onCreateNew={() => {
          setShowEngineForm(true)
        }}
      />

      {/* 搜索引擎表单对话框（创建/编辑） */}
      <WebSearchEngineConfigDialog
        key={`form-${showEngineForm ? 'create' : `edit-${editEngineState?.engineId}`}`}
        open={showEngineForm || (editEngineState?.isOpen ?? false)}
        onClose={() => {
          setShowEngineForm(false)
          setEditEngineState(null)
        }}
        spaceId={spaceId || ''}
        onConfigCreated={async (engineId) => {
          // 刷新列表并触发选择对话框重新加载
          await fetchEngines()
          setShowEngineForm(false)
          // 触发选择对话框刷新
          setEngineListRefreshTrigger(prev => prev + 1)
          // 创建新引擎后，在选择对话框中自动选中（但不更新主界面）
          if (showEngineForm) {
            setNewlyCreatedEngineId(engineId)
          }
          setEditEngineState(null)
        }}
        editingEngineId={editEngineState?.engineId}
      />

      {/* 删除确认对话框 */}
      <DeleteConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={deleteDialog.onConfirm}
        itemType={undefined}
        itemName={deleteDialog.itemName}
        title={deleteDialog.itemType === 'engine' ? '删除搜索引擎' : '删除模板'}
        message={deleteDialog.itemType === 'engine'
          ? `确定要删除搜索引擎"${deleteDialog.itemName}"吗？此操作无法撤销。`
          : `确定要删除模板"${deleteDialog.itemName}"吗？此操作无法撤销。`
        }
        confirmButtonText={deleteDialog.itemType === 'engine' ? '删除搜索引擎' : '删除模板'}
      />

      {/* 模板查看对话框 */}
      <TemplateViewDialog
        open={viewDialog.isOpen}
        onClose={() => setViewDialog(prev => ({ ...prev, isOpen: false }))}
        templateId={viewDialog.templateId}
        templateName={viewDialog.templateName}
        templateDesc={viewDialog.templateDesc}
        templateContent={viewDialog.templateContent}
        loading={viewDialog.loading}
      />

      {/* 知识库配置对话框 */}
      <KnowledgeBaseConfigDialog
        open={showKnowledgeBaseSelector}
        onClose={() => setShowKnowledgeBaseSelector(false)}
        spaceId={spaceId || ''}
        initialSelected={config.selectedKnowledgeBaseIds}
        onConfirm={handleConfirmKnowledgeBases}
      />
    </>
  )
}

// ==================== 搜索引擎选择对话框 ====================
// 统一交互模式：显示列表 + 选择 + 管理功能

interface WebSearchEngineSelectorDialogProps {
  open: boolean
  onClose: () => void
  spaceId: string
  currentSelectedId?: number
  refreshTrigger?: number  // 新增：触发刷新
  newlyCreatedEngineId?: number  // 新增：新创建的引擎ID（用于自动选中）
  onConfirm: (engineId: number | undefined) => void
  onEditEngine: (engineId: number) => void
  onDeleteEngine: (engineId: number) => void
  onCreateNew: () => void
}

const WebSearchEngineSelectorDialog: React.FC<WebSearchEngineSelectorDialogProps> = ({
  open,
  onClose,
  spaceId,
  currentSelectedId,
  refreshTrigger,
  newlyCreatedEngineId,
  onConfirm,
  onEditEngine,
  onDeleteEngine,
  onCreateNew,
}) => {
  const [engines, setEngines] = useState<Array<{ id: number; name: string }>>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<number | undefined>(currentSelectedId)

  // 加载搜索引擎列表
  const loadEngines = React.useCallback(async () => {
    if (!open || !spaceId) return

    setLoading(true)
    try {
      const { webSearchEngineService } = await import('@test-agentstudio/api-client')
      const response = await webSearchEngineService.listEngines(spaceId)
      setEngines(response.map(e => ({ id: e.web_search_engine_id, name: e.search_engine_name })))
    } catch (err) {
      console.error('Failed to load engines:', err)
    } finally {
      setLoading(false)
    }
  }, [open, spaceId])

  // 初始加载 + refreshTrigger 变化时重新加载
  React.useEffect(() => {
    loadEngines()
  }, [loadEngines, refreshTrigger])

  // 初始化选中状态 + 新创建引擎时自动选中
  React.useEffect(() => {
    if (newlyCreatedEngineId !== undefined) {
      setSelectedId(newlyCreatedEngineId)
    } else {
      setSelectedId(currentSelectedId)
    }
  }, [currentSelectedId, newlyCreatedEngineId])

  const handleConfirm = () => {
    onConfirm(selectedId)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className={`bg-white ${RADIUS_CONTAINER} shadow-2xl w-full max-w-md mx-4 overflow-hidden`}>
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">选择搜索引擎</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          ) : engines.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 mb-3">暂无搜索引擎配置</p>
              <button
                onClick={onCreateNew}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + 创建新引擎
              </button>
            </div>
          ) : (
            <>
              {/* 已有引擎列表 */}
              <div className="space-y-2">
                {engines.map(engine => (
                  <div
                    key={engine.id}
                    className={`
                      px-3 py-2 ${RADIUS_BUTTON} border-2 transition-all duration-200 cursor-pointer
                      ${selectedId === engine.id
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                      }
                    `}
                    onClick={() => setSelectedId(engine.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 flex-shrink-0">
                          🔍
                        </div>
                        <p className="text-sm font-medium text-gray-900 truncate">{engine.name}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onEditEngine(engine.id)
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {selectedId !== engine.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteEngine(engine.id)
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {selectedId === engine.id && (
                          <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 创建新引擎按钮 */}
              <button
                onClick={onCreateNew}
                className="w-full mt-3 px-3 py-2 text-sm text-blue-600 hover:text-blue-700 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                创建新引擎
              </button>
            </>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-all duration-200"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm hover:shadow transition-all duration-200"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== 搜索引擎表单对话框（创建/编辑）====================

interface WebSearchEngineConfigDialogProps {
  open: boolean
  onClose: () => void
  spaceId: string
  onConfigCreated: (engineId: number) => void
  editingEngineId?: number | null
}

const WebSearchEngineConfigDialog: React.FC<WebSearchEngineConfigDialogProps> = ({
  open,
  onClose,
  spaceId,
  onConfigCreated,
  editingEngineId = null
}) => {
  const [engineName, setEngineName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [searchUrl, setSearchUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const prevOpenRef = React.useRef(open)

  // 加载引擎数据（用于编辑模式）
  React.useEffect(() => {
    const loadEngineData = async () => {
      console.log('[WebSearchEngineConfigDialog] Data loading useEffect:', { open, editingEngineId, spaceId })
      if (open && editingEngineId) {
        console.log('[WebSearchEngineConfigDialog] Starting data load for engine:', editingEngineId)
        setLoading(true)
        try {
          const { webSearchEngineService } = await import('@test-agentstudio/api-client')
          const engineData = await webSearchEngineService.getEngine(spaceId, editingEngineId)
          console.log('[WebSearchEngineConfigDialog] Data received:', engineData)
          setEngineName(engineData.search_engine_name || '')
          setApiKey(engineData.search_api_key || '')
          setSearchUrl(engineData.search_url || '')
          console.log('[WebSearchEngineConfigDialog] Form state set successfully')
        } catch (err) {
          console.error('[WebSearchEngineConfigDialog] Load failed:', err)
          setError('加载搜索引擎数据失败')
        } finally {
          setLoading(false)
        }
      }
    }
    loadEngineData()
  }, [open, editingEngineId, spaceId])

  // 对话框从打开变为关闭时清空表单
  React.useEffect(() => {
    if (prevOpenRef.current && !open) {
      console.log('[WebSearchEngineConfigDialog] Dialog closed, clearing form')
      setEngineName('')
      setApiKey('')
      setSearchUrl('')
      setError(null)
    }
    prevOpenRef.current = open
  }, [open])

  // 预设搜索引擎配置
  const presets = [
    { name: 'xunfei', label: '讯飞搜索', url: 'https://api.xunfei.cn' },
    { name: 'petal', label: '花瓣搜索', url: 'https://api.petal.dev' },
    { name: 'tavily', label: 'Tavily', url: 'https://api.tavily.com' },
    { name: 'google', label: 'Google', url: 'https://www.googleapis.com/customsearch/v1' },
    { name: 'custom', label: '自定义', url: '' },
  ]

  const handlePresetSelect = (preset: typeof presets[0]) => {
    setEngineName(preset.name)
    setSearchUrl(preset.url)
    setError(null)
  }

  // 解析错误信息
  const parseError = (err: string): { title: string; suggestion: string } => {
    const lowerErr = err.toLowerCase()
    if (lowerErr.includes('already exists') || lowerErr.includes('已存在') || lowerErr.includes('duplicate')) {
      return {
        title: '该名称已被使用',
        suggestion: '请尝试其他名称，如添加数字后缀'
      }
    }
    if (lowerErr.includes('network') || lowerErr.includes('网络')) {
      return {
        title: '网络连接失败',
        suggestion: '请检查网络连接后重试'
      }
    }
    return {
      title: '配置失败',
      suggestion: '请检查输入信息后重试'
    }
  }

  const handleSave = async () => {
    // 验证是否选择了预设引擎
    if (!engineName.trim()) {
      setError('请选择一个搜索引擎类型')
      return
    }
    const isValidEngine = presets.some(p => p.name === engineName)
    if (!isValidEngine) {
      setError('引擎名称必须是预设值之一')
      return
    }
    if (!apiKey.trim() || !searchUrl.trim()) {
      setError('请填写 API Key 和搜索URL')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const { webSearchEngineService } = await import('@test-agentstudio/api-client')

      if (editingEngineId) {
        // 编辑模式：更新现有引擎
        await webSearchEngineService.updateEngine(
          spaceId,
          editingEngineId,
          engineName.trim(),
          apiKey.trim(),
          searchUrl.trim()
        )
        // 编辑完成也需要刷新列表
        onConfigCreated(editingEngineId)
      } else {
        // 创建模式：创建新引擎
        const engineId = await webSearchEngineService.createEngine(
          spaceId,
          engineName.trim(),
          apiKey.trim(),
          searchUrl.trim()
        )
        onConfigCreated(engineId)
      }

      // 清空表单
      if (!editingEngineId) {
        setEngineName('')
        setApiKey('')
        setSearchUrl('')
      }

      onClose()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '配置搜索引擎失败'
      setError(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className={`bg-white ${RADIUS_CONTAINER} shadow-2xl w-full max-w-md mx-4 overflow-hidden`}>
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {editingEngineId ? '修改搜索引擎' : '配置搜索引擎'}
          </h2>
          <button
            onClick={onClose}
            className={`p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 ${RADIUS_BUTTON} transition-colors`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-6 py-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          ) : (
            <>
              {/* 快速选择 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700">搜索引擎</label>
                  <span className="text-xs text-gray-400">请选择一种类型</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {presets.map(preset => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handlePresetSelect(preset)}
                      className={`
                        px-3 py-2 ${RADIUS_BUTTON} text-xs font-medium transition-all duration-200 border
                        ${engineName === preset.name
                          ? 'bg-blue-50 border-blue-200 text-blue-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        }
                      `}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 表单 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  引擎类型
                </label>
                <input
                  type="text"
                  value={engineName}
                  disabled
                  placeholder="请从上方选择搜索引擎"
                  className={`
                    w-full px-3 py-2 ${RADIUS_BUTTON} border text-sm bg-gray-50 text-gray-600
                    border-gray-300
                    cursor-not-allowed
                  `}
                />
                {error && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{parseError(error).title}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="输入搜索引擎 API Key"
                  className={`
                    w-full px-3 py-2 ${RADIUS_BUTTON} border border-gray-300
                    text-sm text-gray-900 placeholder-gray-400
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  `}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  搜索URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={searchUrl}
                  onChange={e => setSearchUrl(e.target.value)}
                  placeholder="https://api.example.com"
                  className={`
                    w-full px-3 py-2 ${RADIUS_BUTTON} border border-gray-300
                    text-sm text-gray-900 placeholder-gray-400
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  `}
                />
              </div>

              {/* 底部按钮 */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={onClose}
                  className={`px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-200 ${RADIUS_BUTTON} transition-all duration-200`}
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`
                    px-6 py-2 text-sm font-medium ${RADIUS_BUTTON} transition-all duration-200 flex items-center gap-2
                    ${saving
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow'
                    }
                  `}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    '保存配置'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default AgentConfigDialog
