import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PromptModelService } from '@test-agentstudio/api-client'
import { convertFrontendToolsToApiTools } from '@/utils/prompts/toolFormatConverter'
import { getFirstSystemMessage } from '@/utils/prompts/promptEditPageUtils'
import type { PromptParameter, ComparisonGroupData, PromptMessage, ModelConfig, Model } from '@/types/promptType'

export interface UsePromptEditHeaderParams {
  // 状态值
  prompt: {
    name: string
    description: string
    category: string
    content: string
    tags: string[]
    isPublic: boolean
    language: string
  }
  promptMessages: PromptMessage[]
  messageInputValues: { [key: string]: string }
  modelConfig: ModelConfig
  selectedModel: Model | null
  availableModels: Model[]
  parameters: PromptParameter[]
  tools: Array<{
    id: string
    name: string
    description: string
    defaultValue?: string
    fieldType?: 'PlainText' | 'JSON'
    parameters: Array<{
      name: string
      type: string
      description: string
      required: boolean
    }>
  }>
  toolsEnabled: boolean
  templateEngine: 'normal' | 'jinja2'
  comparisonGroupsData: ComparisonGroupData[]
  id: string | undefined
  optimizationSource: {
    type: 'main' | 'base' | 'control'
    groupId?: number
    messageId?: string
  }

  // Setter 函数
  setGroupCompletedMessages: React.Dispatch<React.SetStateAction<{ [groupId: number]: Set<number> }>>
  setModelConfig: React.Dispatch<React.SetStateAction<ModelConfig>>
  setSelectedModel: React.Dispatch<React.SetStateAction<Model | null>>
  setComparisonGroupsData: React.Dispatch<React.SetStateAction<ComparisonGroupData[]>>
  setControlGroupCount: React.Dispatch<React.SetStateAction<number>>
  setGroupsExpanded: React.Dispatch<
    React.SetStateAction<{
      [key: number]: {
        promptEditor: boolean
        advancedConfig: boolean
        promptDebug: boolean
      }
    }>
  >
  setGroupsDebugHeight: React.Dispatch<React.SetStateAction<{ [key: number]: number }>>
  setIsComparisonMode: React.Dispatch<React.SetStateAction<boolean>>
}

export const usePromptEditHeader = (params: UsePromptEditHeaderParams) => {
  const navigate = useNavigate()
  const {
    prompt,
    promptMessages,
    messageInputValues,
    modelConfig,
    selectedModel,
    availableModels,
    parameters,
    tools,
    toolsEnabled,
    templateEngine,
    comparisonGroupsData,
    id,
    optimizationSource,
    setGroupCompletedMessages,
    setModelConfig,
    setSelectedModel,
    setComparisonGroupsData,
    setControlGroupCount,
    setGroupsExpanded,
    setGroupsDebugHeight,
    setIsComparisonMode,
  } = params

  // 获取第一个系统消息内容
  const getFirstSystemMessageCallback = useCallback(() => {
    return getFirstSystemMessage(optimizationSource, promptMessages, comparisonGroupsData)
  }, [optimizationSource, promptMessages, comparisonGroupsData])

  // 进入对比模式
  const handleEnterComparisonMode = useCallback(() => {
    // 重置组的完成状态
    setGroupCompletedMessages(() => {
      const initialState = { 0: new Set(), 1: new Set() }
      console.log('🔧 [ENTER-COMPARISON] 初始化组完成状态:', initialState)
      return initialState
    })

    // 确保有模型配置并且类型一致
    let effectiveModelConfig = { ...modelConfig }

    // 确保model字段是字符串类型，无论当前是否有值
    if (effectiveModelConfig.model) {
      effectiveModelConfig.model = String(effectiveModelConfig.model)
    } else if (selectedModel) {
      // 如果主页面model字段为空但有selectedModel，使用selectedModel的配置
      const defaultParams = PromptModelService.getModelDefaultParams(selectedModel)
      effectiveModelConfig = {
        ...modelConfig,
        model: String(selectedModel.openModel.model_id),
        ...defaultParams,
      }
      // 同步更新主页面的modelConfig
      setModelConfig(effectiveModelConfig)
    } else if (availableModels.length > 0) {
      // 如果都没有，选择第一个可用模型
      const firstModel = availableModels[0]
      const defaultParams = PromptModelService.getModelDefaultParams(firstModel)
      effectiveModelConfig = {
        ...modelConfig,
        model: String(firstModel.openModel.model_id),
        ...defaultParams,
      }
      // 同步更新主页面的modelConfig和selectedModel
      setModelConfig(effectiveModelConfig)
      setSelectedModel(firstModel)
    }

    console.log('✅ [ENTER_COMPARISON] 模型配置已设置:', effectiveModelConfig)

    // 重置对照组，使用基准组信息初始化第一个对照组
    const copiedMessages = promptMessages.map(msg => ({
      ...msg,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
    }))

    const copiedInputValues: { [key: string]: string } = {}
    copiedMessages.forEach(msg => {
      const originalId = promptMessages.find(m => m.role === msg.role && m.content === msg.content)?.id
      copiedInputValues[msg.id] = originalId ? messageInputValues[originalId] || msg.content : msg.content
    })

    const initialControlGroup = {
      id: 1,
      prompt: {
        name: prompt.name,
        description: prompt.description,
        category: prompt.category,
        content: prompt.content,
        tags: [...prompt.tags],
        isPublic: prompt.isPublic,
        language: prompt.language,
      },
      modelConfig: { ...effectiveModelConfig },
      parameters: parameters.map(p => ({ ...p })),
      tools: tools.map(t => ({ ...t })),
      toolsEnabled: toolsEnabled,
      chatMessages: [],
      tab: 0, // 默认显示变量定义页签
      isProcessing: false,
      messages: copiedMessages,
      messageInputValues: copiedInputValues,
      draggedMessageId: null,
      templateEngine: templateEngine, // 继承主页面的模板引擎设置
    }

    // 创建基准组（id=0）- 独立管理工具列表
    const baseGroup = {
      id: 0,
      isBaseGroup: true,
      prompt: { ...prompt },
      modelConfig: { ...effectiveModelConfig },
      parameters: [...parameters],
      chatMessages: [],
      tab: 0, // 默认显示变量定义页签
      isProcessing: false,
      toolsEnabled: true,
      tools: [...tools], // 基准组初始时复制主页面工具，但后续独立管理
      messages: [...promptMessages],
      messageInputValues: { ...messageInputValues },
      draggedMessageId: null,
      templateEngine: templateEngine, // 继承主页面的模板引擎设置
    }

    // 更新对照组为包含 isBaseGroup 标识
    const updatedControlGroup = {
      ...initialControlGroup,
      isBaseGroup: false,
    }

    setComparisonGroupsData([baseGroup, updatedControlGroup])
    setControlGroupCount(1)

    // 进入对比模式
    setIsComparisonMode(true)

    // 延迟验证对比组的placeholder，确保状态已更新
  }, [
    modelConfig,
    selectedModel,
    availableModels,
    promptMessages,
    messageInputValues,
    prompt,
    parameters,
    tools,
    toolsEnabled,
    templateEngine,
    setGroupCompletedMessages,
    setModelConfig,
    setSelectedModel,
    setComparisonGroupsData,
    setControlGroupCount,
    setIsComparisonMode,
  ])

  // 增加对照组，使用基准组的当前内容填充
  const handleAddControlGroup = useCallback(() => {
    if (comparisonGroupsData.length >= 3) return // 最多2个对照组 + 1个基准组 = 3个组

    // 复制基准组的当前消息状态
    const baseGroup = comparisonGroupsData.find(g => g.id === 0)
    if (!baseGroup) return

    const copiedMessages = (baseGroup.messages || []).map(msg => ({
      ...msg,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5), // 生成新的唯一ID
    }))

    const copiedInputValues: { [key: string]: string } = {}
    copiedMessages.forEach(msg => {
      const originalId = (comparisonGroupsData.find(g => g.id === 0)?.messages || []).find(m => m.role === msg.role && m.content === msg.content)?.id
      copiedInputValues[msg.id] =
        originalId && comparisonGroupsData.find(g => g.id === 0)?.messageInputValues
          ? (comparisonGroupsData.find(g => g.id === 0)?.messageInputValues || {})[originalId] || msg.content
          : msg.content
    })

    const newGroupId = Math.max(...comparisonGroupsData.map(g => g.id)) + 1

    const newGroup = {
      id: newGroupId,
      isBaseGroup: false,
      prompt: { ...baseGroup.prompt },
      modelConfig: { ...baseGroup.modelConfig },
      parameters: baseGroup.parameters.map(p => ({ ...p })),
      tools: (baseGroup.tools || []).map(t => ({ ...t })),
      toolsEnabled: baseGroup.toolsEnabled,
      chatMessages: [],
      tab: 0, // 默认显示变量定义页签
      isProcessing: false,
      messages: copiedMessages,
      messageInputValues: copiedInputValues,
      draggedMessageId: null,
      templateEngine: baseGroup?.templateEngine || 'normal', // 继承基准组的模板引擎设置
    }

    setComparisonGroupsData([...comparisonGroupsData, newGroup])
    setControlGroupCount(comparisonGroupsData.length) // 新的对照组数量（不包括基准组）

    // 初始化新对照组的展开/收起状态
    setGroupsExpanded(prev => ({
      ...prev,
      [newGroup.id]: { promptEditor: true, advancedConfig: true, promptDebug: true },
    }))

    // 初始化新对照组的调试区域高度
    setGroupsDebugHeight(prev => ({
      ...prev,
      [newGroup.id]: 300,
    }))

    // 初始化新对照组的完成状态
    setGroupCompletedMessages(prev => {
      const newState = { ...prev, [newGroup.id]: new Set() }
      console.log(`🔧 [ADD-GROUP] 为新对照组${newGroup.id}初始化完成状态:`, newState)
      return newState
    })

    console.log(`✅ [ADD_CONTROL_GROUP] 已添加对照组 ${newGroup.id}，使用基准组内容填充`)

    // 延迟验证新增对照组的placeholder，确保状态已更新
  }, [comparisonGroupsData, setComparisonGroupsData, setControlGroupCount, setGroupsExpanded, setGroupsDebugHeight, setGroupCompletedMessages])

  // 跳转到优化页面
  const handleNavigateToOptimization = useCallback(() => {
    // 从promptMessages获取实际的提示词内容（第一个system消息）
    const actualPromptContent = getFirstSystemMessageCallback()

    console.log('=== 准备跳转到优化页面 ===')
    console.log('prompt.content:', prompt.content)
    console.log('promptMessages:', promptMessages)
    console.log('实际提取的内容:', actualPromptContent)
    console.log('工具信息:', tools)

    // 将工具转换为 API 格式（agentTools），以便在优化页面使用
    const agentTools = tools.length > 0 ? convertFrontendToolsToApiTools(tools) : []

    // 准备要传递的数据
    const optimizationData = {
      taskName: prompt.name || '',
      description: prompt.description || '',
      originalPrompt: actualPromptContent, // 从promptMessages获取实际内容
      fromEditor: true, // 标记来源
      editorPromptId: id, // 保存提示词ID，以便返回
      tools: agentTools, // 传递工具信息（API格式）
      toolsEnabled: toolsEnabled, // 传递工具启用状态
    }

    console.log('优化数据:', optimizationData)
    console.log('转换后的工具（agentTools）:', agentTools)

    // 将数据存储到 sessionStorage
    sessionStorage.setItem('optimizationData', JSON.stringify(optimizationData))

    // 跳转到优化任务页面
    navigate('/dashboard/prompts/optimize/new')
  }, [getFirstSystemMessageCallback, prompt, promptMessages, tools, toolsEnabled, id, navigate])

  return {
    handleEnterComparisonMode,
    handleAddControlGroup,
    handleNavigateToOptimization,
  }
}
