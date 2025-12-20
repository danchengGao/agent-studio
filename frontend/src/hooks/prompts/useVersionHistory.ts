import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { PromptService, PromptModelService, type MockContext } from '@test-agentstudio/api-client'
import { useUnifiedSnackbar } from '@/Common/UnifiedSnackbar'
import { isValidVariableName, processToolsFromAPI, findModelByIdAndFrom } from '@/utils/prompts/promptEditPageUtils'
import { formatDraftDateTime } from '@/utils/prompts/utils'
import type { PromptParameter, PromptMessage, Model, ModelConfig, ChatMessage } from '@/types/promptType'

// 版本历史相关的类型定义
interface VersionData {
  id: string
  version: string
  content: string
  parameters: any[]
  modelConfig: any
  createdAt: string
  isActive: boolean
  isDraft?: boolean
  description: string
  author: string
  baseVersion: string
  associations: {
    relationObjs: any[]
  }
  performance: {
    usage: number
    rating: number
    successRate: number
  }
}

interface LoadVersionResult {
  success: boolean
  message: string
}

// Hook 参数接口
interface UseVersionHistoryProps {
  id?: string
  isNew?: boolean
  workspaceId?: string
  userId?: string
  // 外部状态
  isDraftEdited: boolean
  draftSavedTime: Date | null
  selectedVersion: string | null
  availableModels: Model[]
  selectedModel: Model | null
  // 外部状态设置函数
  setSelectedVersion: (version: string | null) => void
  setPromptMessages: (messages: PromptMessage[] | ((prev: PromptMessage[]) => PromptMessage[])) => void
  setPrompt: (prompt: any | ((prev: any) => any)) => void
  setHasUnsavedChanges: (hasChanges: boolean) => void
  setMessageInputValues: (values: { [key: string]: string }) => void
  setParameters: (params: PromptParameter[] | ((prev: PromptParameter[]) => PromptParameter[])) => void
  setTools: (tools: any[] | ((prev: any[]) => any[])) => void
  setToolsEnabled: (enabled: boolean) => void
  setSelectedModel: (model: Model | null) => void
  setModelConfig: (config: ModelConfig | ((prev: ModelConfig) => ModelConfig)) => void
  setIsLoadingFromAPI: (loading: boolean) => void
  setTemplateEngine: (engine: 'normal' | 'jinja2') => void
  setChatMessages: (messages: ChatMessage[]) => void
  setCompletedMessages: (messages: Set<number>) => void
  setLastSavedTime: (time: Date) => void
  setIsDraftEdited: (edited: boolean) => void
  // 外部函数
  loadFromDraftData: (draftData: any) => Promise<void>
  loadDebugContext?: () => Promise<void>
}

// Hook 返回值接口
interface UseVersionHistoryReturn {
  // 状态
  versionHistoryOpen: boolean
  setVersionHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>
  versionListLoading: boolean
  setApiVersionList: React.Dispatch<React.SetStateAction<any[]>>
  revertConfirmOpen: boolean
  setRevertConfirmOpen: (open: boolean) => void
  // 操作函数
  handleOpenVersionHistory: () => Promise<void>
  getDisplayVersions: () => VersionData[]
  handleSelectVersion: (versionId: string) => Promise<void>
  loadVersionDataToEditor: (version: string, source?: string) => Promise<LoadVersionResult>
  handleRollbackToVersion: () => void
  handleConfirmRevert: () => Promise<void>
}

export const useVersionHistory = ({
  id,
  isNew,
  workspaceId,
  userId,
  isDraftEdited,
  draftSavedTime,
  selectedVersion,
  availableModels,
  selectedModel,
  setSelectedVersion,
  setPromptMessages,
  setPrompt,
  setHasUnsavedChanges,
  setMessageInputValues,
  setParameters,
  setTools,
  setToolsEnabled,
  setSelectedModel,
  setModelConfig,
  setIsLoadingFromAPI,
  setTemplateEngine,
  setChatMessages,
  setCompletedMessages,
  setLastSavedTime,
  setIsDraftEdited,
  loadFromDraftData,
  loadDebugContext,
}: UseVersionHistoryProps): UseVersionHistoryReturn => {
  const { t } = useTranslation()
  const { setSnackbar } = useUnifiedSnackbar()

  // 版本历史面板状态
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false)
  const [versionListLoading, setVersionListLoading] = useState(false)
  const [apiVersionList, setApiVersionList] = useState<any[]>([])

  // 还原确认对话框状态
  const [revertConfirmOpen, setRevertConfirmOpen] = useState(false)

  // 打开/关闭版本历史面板
  const handleOpenVersionHistory = useCallback(async () => {
    // 切换版本历史面板的开关状态
    const newVersionHistoryOpen = !versionHistoryOpen
    setVersionHistoryOpen(newVersionHistoryOpen)

    // 如果是关闭面板，清除选中的版本
    if (!newVersionHistoryOpen) {
      setSelectedVersion(null)
      return
    }

    // 如果是打开面板，重置选中的版本并加载数据
    setSelectedVersion(null)

    // 如果提示词尚未保存，不调用API
    if (!id || isNew) {
      console.log('提示词尚未保存，使用本地版本数据')
      return
    }

    // 调用API获取版本列表
    setVersionListLoading(true)
    try {
      const response = await PromptService.getVersionList(id, { page_size: 20 })

      if (response.code === 0) {
        // 成功获取版本列表
        setApiVersionList(response.prompt_commit_infos)
        console.log('✅ [VERSION-LIST] 版本列表获取成功:', response.prompt_commit_infos)
        console.log(
          '🔍 [VERSION-LIST] 第一个版本的提交人信息:',
          response.prompt_commit_infos[0]
            ? {
                version: response.prompt_commit_infos[0].version,
                committed_by: response.prompt_commit_infos[0].committed_by,
                committed_by_name: response.prompt_commit_infos[0].committed_by_name,
              }
            : '无版本数据',
        )
      } else {
        // API返回错误
        const errorMessage = response.msg || '获取版本列表失败'
        setSnackbar({ open: true, message: errorMessage, severity: 'error' })
        console.error('获取版本列表失败:', response)
      }
    } catch (error) {
      console.error('获取版本列表API调用失败:', error)
      setSnackbar({ open: true, message: t('components.prompts.promptEditPage.getVersionListFailed'), severity: 'error' })
    } finally {
      setVersionListLoading(false)
    }
  }, [versionHistoryOpen, id, isNew, setSelectedVersion, setSnackbar, t])

  // 获取显示用的版本列表（根据is_draft_edited决定是否包含当前草稿）
  const getDisplayVersions = useCallback((): VersionData[] => {
    const versions: VersionData[] = []

    // 只有当有未提交的草稿时，才添加当前草稿到列表顶部
    if (isDraftEdited) {
      versions.push({
        id: 'current-draft',
        version: t('components.prompts.versionHistory.currentDraft'),
        content: '',
        parameters: [],
        modelConfig: {
          model: '',
          temperature: 0.7,
          maxTokens: 1000,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
          stopSequences: [],
        },
        createdAt: draftSavedTime ? draftSavedTime.toISOString() : new Date().toISOString(),
        isActive: false,
        isDraft: true,
        description: draftSavedTime
          ? t('components.prompts.versionHistory.draftSavedAt', { time: formatDraftDateTime(draftSavedTime) })
          : t('components.prompts.versionHistory.currentDraft'),
        author: t('components.prompts.versionHistory.currentUser'),
        baseVersion: '',
        associations: {
          relationObjs: [],
        },
        performance: {
          usage: 0,
          rating: 0,
          successRate: 0,
        },
      })
    }

    // 添加API版本数据
    apiVersionList.forEach((apiVersion, index) => {
      const authorName = apiVersion.committed_by_name || apiVersion.committed_by

      versions.push({
        id: `api-${apiVersion.version}`,
        version: apiVersion.version,
        content: '', // API数据中没有content，使用空字符串
        parameters: [], // API数据中没有parameters，使用空数组
        modelConfig: {
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 1000,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
          stopSequences: [],
        },
        createdAt:
          typeof apiVersion.committed_at === 'number' && apiVersion.committed_at < 10000000000
            ? new Date(apiVersion.committed_at * 1000).toISOString()
            : new Date(apiVersion.committed_at).toISOString(), // 智能处理时间戳格式
        isActive: index === 0, // 假设第一个版本是当前活跃版本
        isDraft: false,
        description: apiVersion.description,
        author: authorName,
        baseVersion: apiVersion.base_version,
        associations: {
          relationObjs: apiVersion.relation_obj || [],
        },
        performance: {
          usage: 0,
          rating: 0,
          successRate: 0,
        },
      })
    })

    // 按照提交时间从最近到最远排序
    // 草稿如果存在，始终显示在最顶部，其他版本按时间排序
    const sortedVersions = versions.sort((a, b) => {
      // 草稿始终在最前面
      if (a.isDraft) return -1
      if (b.isDraft) return 1

      // 其他版本按创建时间降序排序（最新的在前）
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    return sortedVersions
  }, [isDraftEdited, draftSavedTime, apiVersionList, t])

  // 根据版本号加载版本数据到编辑区域的统一函数
  const loadVersionDataToEditor = useCallback(
    async (version: string, source = 'manual'): Promise<LoadVersionResult> => {
      console.log(`🔄 [LOAD-VERSION-DATA] 开始加载版本 ${version} 数据，来源: ${source}`)

      try {
        // 直接调用API获取指定版本的详情
        const versionResponse = await PromptService.getPromptDetail(id!, {
          withCommit: true,
          commitVersion: version,
          withDraft: false,
          withDefaultConfig: false,
          workspaceId: workspaceId,
        })

        if (versionResponse.code === 0) {
          const promptDetail = versionResponse.prompt && versionResponse.prompt.length > 0 ? versionResponse.prompt[0] : null
          const commitData = promptDetail?.prompt_commit?.detail

          if (commitData) {
            console.log('✅ [LOAD-VERSION-DATA] 成功获取版本详情，开始填充数据')

            // 填充提示词模板类型
            if (commitData.prompt_template?.template_type) {
              setTemplateEngine(commitData.prompt_template.template_type as 'normal' | 'jinja2')
              console.log('✅ [LOAD-VERSION-DATA] 填充模板类型:', commitData.prompt_template.template_type)
            }

            // 填充提示词内容 (messages)
            if (commitData.prompt_template?.messages) {
              const newPromptMessages = commitData.prompt_template.messages.map((msg: any) => ({
                id: msg.key || `${Date.now()}-${Math.random()}`,
                role: msg.role,
                content: msg.content || '',
              }))

              // 临时设置加载标志，防止自动变量检测干扰和自动保存
              setIsLoadingFromAPI(true)

              setPromptMessages(newPromptMessages)
              console.log('✅ [LOAD-VERSION-DATA] 填充提示词内容:', newPromptMessages)

              // 同步到prompt.content（不触发自动保存，因为isLoadingFromAPI已设置）
              const combinedContent = newPromptMessages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n')
              // 直接更新prompt状态，不通过handlePromptChange避免触发自动保存
              setPrompt((prev: any) => ({ ...prev, content: combinedContent }))
              setHasUnsavedChanges(true)
              console.log('✅ [LOAD-VERSION-DATA] 同步到prompt.content（跳过自动保存）')

              // 设置消息输入值
              const newInputValues: { [key: string]: string } = {}
              newPromptMessages.forEach(msg => {
                newInputValues[msg.id] = msg.content
              })
              setMessageInputValues(newInputValues)
              console.log('✅ [LOAD-VERSION-DATA] 设置消息输入值')
            }

            // 填充变量定义
            if (commitData.prompt_template?.variable_defs) {
              const newParameters = commitData.prompt_template.variable_defs
                .filter((varDef: any) => {
                  if (!isValidVariableName(varDef.key)) {
                    console.warn(`🚫 [VAR-VALIDATION] 跳过版本数据中的无效变量名: "${varDef.key}"，不符合格式要求`)
                    return false
                  }
                  return true
                })
                .map((varDef: any) => ({
                  name: varDef.key,
                  value: '',
                  description: varDef.desc || `${varDef.type || 'string'}类型变量`,
                  type: (varDef.type === 'placeholder' ? 'placeholder' : 'text') as 'placeholder' | 'text',
                  dataType: varDef.type || 'string',
                }))
              setParameters(newParameters)
              console.log('✅ [LOAD-VERSION-DATA] 填充变量定义:', newParameters)
            }

            // 填充工具设置 (tools)
            if (commitData.tools && commitData.tools.length > 0) {
              const processedTools = processToolsFromAPI(commitData.tools)
              setTools(processedTools)
              console.log('✅ [LOAD-VERSION-DATA] 填充工具设置:', processedTools)
            } else {
              setTools([])
            }

            // 填充工具调用配置 (tool_call_config)
            if (commitData.tool_call_config) {
              const toolChoice = commitData.tool_call_config.tool_choice
              const isToolsEnabled = toolChoice === 'auto' // auto表示启用，none表示不启用
              setToolsEnabled(isToolsEnabled)
              console.log('✅ [LOAD-VERSION-DATA] 填充工具调用配置:', { toolChoice, isToolsEnabled })
            } else {
              setToolsEnabled(false)
            }

            // 填充模型设置 (prompt_model_config)
            if (commitData.prompt_model_config) {
              const modelConfig = commitData.prompt_model_config
              console.log('✅ [LOAD-VERSION-DATA] 模型配置数据:', modelConfig)

              // 根据models_id从模型列表中找到对应的模型
              if (modelConfig.models_id) {
                try {
                  // 如果models列表已经加载，直接从中查找
                  if (availableModels.length > 0) {
                    const targetModel = findModelByIdAndFrom(modelConfig.models_id, modelConfig.model_from, availableModels as any[])
                    if (targetModel) {
                      setSelectedModel(targetModel as Model)
                      console.log('✅ [LOAD-VERSION-DATA] 从已加载模型列表中找到模型:', targetModel)
                    } else {
                      console.log('⚠️ [LOAD-VERSION-DATA] 在已加载模型列表中未找到models_id:', modelConfig.models_id)
                    }
                  } else {
                    // 如果模型列表未加载，调用模型详情API
                    const modelResponse = await PromptModelService.getModelDetail(modelConfig.models_id, modelConfig.model_from)
                    if (modelResponse.code === 0 && modelResponse.data) {
                      setSelectedModel(modelResponse.data as Model)
                      console.log('✅ [LOAD-VERSION-DATA] 通过API获取模型详情:', modelResponse.data)
                    }
                  }
                } catch (error) {
                  console.error('❌ [LOAD-VERSION-DATA] 获取模型详情失败:', error)
                }
              }

              // 设置模型参数配置
              const newModelConfig: any = {}
              if (selectedModel?.openModel?.param_config?.param_schemas) {
                selectedModel.openModel.param_config.param_schemas.forEach((schema: any) => {
                  const paramName = schema.name
                  const actualValue = modelConfig[paramName]
                  if (actualValue !== null && actualValue !== undefined) {
                    newModelConfig[paramName] = actualValue
                  } else {
                    newModelConfig[paramName] = schema.default_val
                  }
                })
              } else {
                Object.keys(modelConfig).forEach(key => {
                  if (!['models_id', 'models_name'].includes(key) && modelConfig[key] !== null && modelConfig[key] !== undefined) {
                    newModelConfig[key] = modelConfig[key]
                  }
                })
              }

              setModelConfig((prev: ModelConfig) => ({
                ...prev,
                model: modelConfig.models_id || prev.model,
                model_from: modelConfig.model_from || prev.model_from,
                ...newModelConfig,
              }))
              console.log('✅ [LOAD-VERSION-DATA] 填充模型参数配置:', { model: modelConfig.models_id, ...newModelConfig })
            }

            // 设置选中版本
            setSelectedVersion(`api-${version}`)

            // 标记为有未保存的更改
            setHasUnsavedChanges(true)

            // 延迟重置加载标志，确保状态更新完成
            setTimeout(() => {
              setIsLoadingFromAPI(false)
              console.log('✅ [LOAD-VERSION-DATA] 版本数据加载完成，重置加载标志')
            }, 500)

            console.log('🎉 [LOAD-VERSION-DATA] 版本加载完成，版本:', version)
            return { success: true, message: t('components.prompts.promptEditPage.loadVersionSuccessWithVersion', { version }) }
          } else {
            console.error('❌ [LOAD-VERSION-DATA] 版本数据不存在')
            return { success: false, message: t('components.prompts.promptEditPage.versionDataNotFound') }
          }
        } else {
          console.error('❌ [LOAD-VERSION-DATA] 获取版本详情失败:', versionResponse.msg)
          return { success: false, message: versionResponse.msg || t('components.prompts.promptEditPage.getVersionDetailFailed') }
        }
      } catch (error) {
        console.error('❌ [LOAD-VERSION-DATA] 版本加载异常:', error)
        return { success: false, message: t('components.prompts.promptEditPage.versionLoadFailedRetry') }
      }
    },
    [
      id,
      workspaceId,
      availableModels,
      selectedModel,
      setTemplateEngine,
      setPromptMessages,
      setIsLoadingFromAPI,
      setPrompt,
      setHasUnsavedChanges,
      setMessageInputValues,
      setParameters,
      setTools,
      setToolsEnabled,
      setSelectedModel,
      setModelConfig,
      setSelectedVersion,
      t,
    ],
  )

  // 处理版本选择
  const handleSelectVersion = useCallback(
    async (versionId: string) => {
      setSelectedVersion(versionId)

      // 获取选中的版本数据
      const displayVersions = getDisplayVersions()
      const selectedVersionData = displayVersions.find(v => v.id === versionId)
      if (!selectedVersionData) return

      // 如果没有prompt ID，无法调用API
      if (!id || isNew) {
        console.log('提示词尚未保存，无法获取版本详情')
        return
      }

      try {
        // 如果选中的是当前草稿
        if (versionId === 'current-draft') {
          console.log('加载当前草稿')
          const response = await PromptService.getPromptDetail(id!, {
            withCommit: true,
            commitVersion: '', // 空字符串表示不获取特定commit版本
            withDraft: true,
            withDefaultConfig: true,
            workspaceId: workspaceId,
          })

          if (response.code === 0 && response.prompt?.[0]?.prompt_draft) {
            const draftData = response.prompt[0].prompt_draft.detail

            // 设置加载标志，防止自动保存
            setIsLoadingFromAPI(true)

            // 使用 prompt_draft 数据填充编辑器
            await loadFromDraftData(draftData)

            // 延迟重置加载标志，确保状态更新完成
            setTimeout(() => {
              setIsLoadingFromAPI(false)
              console.log('✅ [SELECT-VERSION] 草稿数据加载完成，重置加载标志')
            }, 500)

            // 加载调试上下文数据
            try {
              console.log('🔍 开始加载当前草稿的调试上下文, promptId:', id)

              const debugResponse = await PromptService.getDebugContext(id!, userId!)

              if (debugResponse.code === 0 && debugResponse.debug_context) {
                console.log('✅ 查询草稿调试上下文成功:', debugResponse.debug_context)

                const { debug_core } = debugResponse.debug_context

                // 恢复聊天消息
                if (debug_core.mock_contexts && debug_core.mock_contexts.length > 0) {
                  const chatMessagesFromContext = debug_core.mock_contexts.map((context: MockContext) => ({
                    type: context.role === 'user' ? ('user' as const) : ('ai' as const),
                    content: context.content,
                    timestamp: context.msg_time || new Date().toLocaleString('zh-CN'), // 使用msg_time字段设置消息时间
                    // 保存额外的AI信息用于后续显示
                    ...(context.role === 'assistant' && {
                      reasoningContent: context.reasoning_content || undefined,
                      input_tokens: context.input_tokens || undefined,
                      output_tokens: context.output_tokens || undefined,
                      cost_ms: context.cost_ms,
                      debug_id: context.debug_id,
                      // 处理工具调用信息
                      ...(context.tool_calls &&
                        Array.isArray(context.tool_calls) && {
                          toolCalls: context.tool_calls.map((toolCallData: any) => ({
                            name: toolCallData.tool_call?.function_call?.name || '',
                            input: toolCallData.tool_call?.function_call?.arguments || '',
                            output: toolCallData.mock_response || '',
                            id: toolCallData.tool_call?.id,
                            index: parseInt(toolCallData.tool_call?.index || '0'),
                          })),
                        }),
                    }),
                  }))

                  setChatMessages(chatMessagesFromContext)

                  // 标记所有恢复的消息为已完成
                  const completedIndices = new Set<number>()
                  for (let i = 0; i < chatMessagesFromContext.length; i++) {
                    completedIndices.add(i)
                  }
                  setCompletedMessages(completedIndices)

                  console.log('✅ 恢复草稿聊天消息:', chatMessagesFromContext)
                }

                // 恢复变量值
                if (debug_core.mock_variables && debug_core.mock_variables.length > 0) {
                  setTimeout(() => {
                    setParameters(prevParams => {
                      const updatedParams = [...prevParams]
                      debug_core.mock_variables.forEach((variable: any) => {
                        const paramIndex = updatedParams.findIndex(p => p.name === variable.key)
                        if (paramIndex !== -1) {
                          if (variable.type === 'placeholder' && variable.placeholder_messages) {
                            // placeholder类型变量：恢复placeholder_messages
                            updatedParams[paramIndex] = {
                              ...updatedParams[paramIndex],
                              type: 'placeholder',
                              messages: variable.placeholder_messages.map((msg: any) => ({
                                id: msg.id || Date.now().toString() + Math.random().toString(36).substr(2, 5),
                                role: msg.role,
                                content: msg.content,
                              })),
                            }
                          } else {
                            // 普通变量：恢复value
                            updatedParams[paramIndex] = {
                              ...updatedParams[paramIndex],
                              value: variable.value,
                            }
                          }
                        }
                      })
                      console.log('✅ 恢复草稿变量值:', updatedParams)
                      return updatedParams
                    })
                  }, 100)
                }

                // 恢复工具配置
                if (debug_core.mock_tools && debug_core.mock_tools.length > 0) {
                  setTimeout(() => {
                    setTools(prevTools => {
                      const updatedTools = [...prevTools]
                      debug_core.mock_tools.forEach((mockTool: any) => {
                        const toolIndex = updatedTools.findIndex(t => t.name === mockTool.name)
                        if (toolIndex !== -1) {
                          updatedTools[toolIndex] = {
                            ...updatedTools[toolIndex],
                            defaultValue: mockTool.mock_response,
                          }
                        }
                      })
                      console.log('✅ 恢复草稿工具配置:', updatedTools)
                      return updatedTools
                    })
                  }, 100)
                }
              }
            } catch (error) {
              console.error('❌ 加载草稿调试上下文失败:', error)
              // 不显示错误提示，因为调试上下文是可选的
            }

            setSnackbar({
              open: true,
              message: t('components.prompts.promptEditPage.loadDraftSuccess'),
              severity: 'success',
            })
          } else {
            setSnackbar({ open: true, message: t('components.prompts.promptEditPage.getDraftFailed'), severity: 'error' })
          }
          return
        }

        // 使用统一的版本加载函数
        console.log('使用统一函数加载版本:', selectedVersionData.version)
        // loadVersionDataToEditor 内部已经设置了 isLoadingFromAPI 标志，这里不需要重复设置
        const result = await loadVersionDataToEditor(selectedVersionData.version, 'handleSelectVersion')

        if (!result.success) {
          setSnackbar({
            open: true,
            message: result.message,
            severity: 'error',
          })
          return
        }

        // 加载调试上下文数据
        try {
          console.log('🔍 开始加载版本的调试上下文, promptId:', id)

          const debugResponse = await PromptService.getDebugContext(id!, userId!)

          if (debugResponse.code === 0 && debugResponse.debug_context) {
            console.log('✅ 查询版本调试上下文成功:', debugResponse.debug_context)

            const { debug_core } = debugResponse.debug_context

            // 恢复聊天消息
            if (debug_core.mock_contexts && debug_core.mock_contexts.length > 0) {
              const chatMessagesFromContext = debug_core.mock_contexts.map((context: MockContext) => ({
                type: context.role === 'user' ? ('user' as const) : ('ai' as const),
                content: context.content,
                timestamp: context.msg_time || new Date().toLocaleString('zh-CN'), // 使用msg_time字段设置消息时间
                // 保存额外的AI信息用于后续显示
                ...(context.role === 'assistant' && {
                  reasoningContent: context.reasoning_content || undefined,
                  input_tokens: context.input_tokens || undefined,
                  output_tokens: context.output_tokens || undefined,
                  cost_ms: context.cost_ms,
                  debug_id: context.debug_id,
                  // 处理工具调用信息
                  ...(context.tool_calls &&
                    Array.isArray(context.tool_calls) && {
                      toolCalls: context.tool_calls.map((toolCallData: any) => ({
                        name: toolCallData.tool_call?.function_call?.name || '',
                        input: toolCallData.tool_call?.function_call?.arguments || '',
                        output: toolCallData.mock_response || '',
                        id: toolCallData.tool_call?.id,
                        index: parseInt(toolCallData.tool_call?.index || '0'),
                      })),
                    }),
                }),
              }))

              setChatMessages(chatMessagesFromContext)

              // 标记所有恢复的消息为已完成
              const completedIndices = new Set<number>()
              for (let i = 0; i < chatMessagesFromContext.length; i++) {
                completedIndices.add(i)
              }
              setCompletedMessages(completedIndices)

              console.log('✅ 恢复版本聊天消息:', chatMessagesFromContext)
            }

            // 恢复变量值
            if (debug_core.mock_variables && debug_core.mock_variables.length > 0) {
              setTimeout(() => {
                setParameters(prevParams => {
                  const updatedParams = [...prevParams]
                  debug_core.mock_variables.forEach((variable: any) => {
                    const paramIndex = updatedParams.findIndex(p => p.name === variable.key)
                    if (paramIndex !== -1) {
                      if (variable.type === 'placeholder' && variable.placeholder_messages) {
                        // placeholder类型变量：恢复placeholder_messages
                        updatedParams[paramIndex] = {
                          ...updatedParams[paramIndex],
                          type: 'placeholder',
                          messages: variable.placeholder_messages.map((msg: any) => ({
                            id: msg.id || Date.now().toString() + Math.random().toString(36).substr(2, 5),
                            role: msg.role,
                            content: msg.content,
                          })),
                        }
                      } else {
                        // 普通变量：恢复value
                        updatedParams[paramIndex] = {
                          ...updatedParams[paramIndex],
                          value: variable.value,
                        }
                      }
                    }
                  })
                  console.log('✅ 恢复版本变量值:', updatedParams)
                  return updatedParams
                })
              }, 100) // 延迟确保参数已经初始化
            }

            // 恢复工具配置
            if (debug_core.mock_tools && debug_core.mock_tools.length > 0) {
              setTimeout(() => {
                setTools(prevTools => {
                  const updatedTools = [...prevTools]
                  debug_core.mock_tools.forEach((mockTool: any) => {
                    const toolIndex = updatedTools.findIndex(t => t.name === mockTool.name)
                    if (toolIndex !== -1) {
                      updatedTools[toolIndex] = {
                        ...updatedTools[toolIndex],
                        defaultValue: mockTool.mock_response,
                      }
                    }
                  })
                  console.log('✅ 恢复版本工具配置:', updatedTools)
                  return updatedTools
                })
              }, 100) // 延迟确保工具已经初始化
            }
          } else if (debugResponse.code !== 0) {
            console.warn('⚠️ 查询版本调试上下文失败:', debugResponse.msg || '未知错误')
            // 不显示错误提示，因为可能是该版本没有调试上下文数据
          }
        } catch (error) {
          console.error('❌ 加载版本调试上下文失败:', error)
          // 不显示错误提示，因为调试上下文是可选的
        }

        setSnackbar({
          open: true,
          message: t('components.prompts.promptEditPage.addResultMessageToEditor', { message: result.message }),
          severity: 'success',
        })
      } catch (error) {
        console.error('获取版本详情失败:', error)
        setSnackbar({
          open: true,
          message: t('components.prompts.promptEditPage.getVersionDetailFailed'),
          severity: 'error',
        })
      }
    },
    [
      id,
      isNew,
      workspaceId,
      userId,
      getDisplayVersions,
      setSelectedVersion,
      setIsLoadingFromAPI,
      loadFromDraftData,
      setChatMessages,
      setCompletedMessages,
      setParameters,
      setTools,
      loadVersionDataToEditor,
      setSnackbar,
      t,
    ],
  )

  // 处理还原版本按钮点击
  const handleRollbackToVersion = useCallback(() => {
    if (!selectedVersion) return

    const displayVersions = getDisplayVersions()
    const selectedVersionData = displayVersions.find(v => v.id === selectedVersion)
    if (!selectedVersionData) return

    if (!id || isNew) {
      setSnackbar({ open: true, message: t('components.prompts.promptEditPage.cannotRevertNotSaved'), severity: 'error' })
      return
    }

    // 显示确认弹窗
    setRevertConfirmOpen(true)
  }, [selectedVersion, getDisplayVersions, id, isNew, setSnackbar, t])

  // 确认还原版本
  const handleConfirmRevert = useCallback(async () => {
    if (!selectedVersion) return

    const displayVersions = getDisplayVersions()
    const selectedVersionData = displayVersions.find(v => v.id === selectedVersion)
    if (!selectedVersionData) return

    try {
      setRevertConfirmOpen(false)

      // 调用从版本中恢复API
      const response = await PromptService.revertToVersion(id!, userId!, {
        commit_version_reverting_from: selectedVersionData.version,
      })

      if (response.code === 0) {
        // API调用成功，重新获取prompt详情以获取最新的draft数据
        const promptDetailResponse = await PromptService.getPromptDetail(id!, {
          withDraft: true,
          withDefaultConfig: true,
          withCommit: false,
          workspaceId: workspaceId,
        })

        if (promptDetailResponse.code === 0 && promptDetailResponse.prompt?.[0]?.prompt_draft) {
          const draftData = promptDetailResponse.prompt[0].prompt_draft.detail

          // 设置加载标志，防止自动保存
          setIsLoadingFromAPI(true)

          // 使用通用函数加载 prompt_draft 数据到编辑器
          await loadFromDraftData(draftData)

          // 加载调试上下文（如果提供了该函数）
          if (loadDebugContext) {
            try {
              console.log('🔍 [REVERT-VERSION] 开始加载调试上下文')
              await loadDebugContext()
              console.log('✅ [REVERT-VERSION] 调试上下文加载完成')
            } catch (error) {
              console.error('❌ [REVERT-VERSION] 加载调试上下文失败:', error)
              // 调试上下文加载失败不影响主流程，只记录错误
            }
          }

          // 延迟重置加载标志，确保状态更新完成
          setTimeout(() => {
            setIsLoadingFromAPI(false)
            console.log('✅ [REVERT-VERSION] 还原版本数据加载完成，重置加载标志')
          }, 500)

          setLastSavedTime(new Date())
          setHasUnsavedChanges(false)
          setIsDraftEdited(true) // 还原版本后标记为有未提交的更改
          setSnackbar({ open: true, message: t('components.prompts.promptEditPage.revertSuccess'), severity: 'success' })
        } else {
          setSnackbar({ open: true, message: t('components.prompts.promptEditPage.getRevertedDataFailed'), severity: 'error' })
        }
      } else {
        // API调用失败
        const errorMessage = response.msg || t('components.prompts.promptEditPage.revertFailed')
        setSnackbar({ open: true, message: errorMessage, severity: 'error' })
      }
    } catch (error) {
      console.error(t('components.prompts.promptEditPage.revertFailed'), error)
      setSnackbar({ open: true, message: t('components.prompts.promptEditPage.revertFailed'), severity: 'error' })
    }
  }, [
    selectedVersion,
    getDisplayVersions,
    id,
    userId,
    workspaceId,
    setIsLoadingFromAPI,
    loadFromDraftData,
    loadDebugContext,
    setLastSavedTime,
    setHasUnsavedChanges,
    setIsDraftEdited,
    setSnackbar,
    t,
  ])

  return {
    // 状态
    versionHistoryOpen,
    setVersionHistoryOpen,
    versionListLoading,
    setApiVersionList,
    revertConfirmOpen,
    setRevertConfirmOpen,
    // 操作函数
    handleOpenVersionHistory,
    getDisplayVersions,
    handleSelectVersion,
    loadVersionDataToEditor,
    handleRollbackToVersion,
    handleConfirmRevert,
  }
}
