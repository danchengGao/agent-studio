import { styled } from '@mui/material/styles'
import ArrowForwardIosSharpIcon from '@mui/icons-material/ArrowForwardIosSharp'
import MuiAccordion, { AccordionProps } from '@mui/material/Accordion'
import MuiAccordionSummary, { AccordionSummaryProps, accordionSummaryClasses } from '@mui/material/AccordionSummary'
import MuiAccordionDetails from '@mui/material/AccordionDetails'
import Typography from '@mui/material/Typography'
import { AgentDetailResponse, AgentPlugin, SaveAgentRequest, useModels, type PluginApiInfo } from '@test-agentstudio/api-client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertCircle, RefreshCcw, Trash2 } from 'lucide-react'
import { ModelDetail, WorkflowDetail, WorkflowSelectDetail } from '../../types/agentTypes'
import { Select, Button, Alert, MenuItem, TextField, Box, IconButton, List, ListItem, ListItemText, Switch, FormControlLabel, Tooltip } from '@mui/material'
import { Link } from 'react-router-dom'
import ModelDetailForm from './ModelDetailForm'
import WorkflowSelector from './WorkflowSelector'
import { useAgentStore } from '@/stores/useAgentStore'
import PluginSelector from '../../../packages/workflow-canvas/src/components/PluginSelector'
import AddButton from './AddButton'
import WorkflowList from './WorkflowList'
import PluginList from './PluginList'
import { useAuthStore } from '../../stores/useAuthStore'
import axios from 'axios'
import { useWorkflowValidation } from '@/hooks/useWorkflowValidation'
import { getDefaultSpaceId } from '@/utils/spaceUtils'

// 保留其他 Accordion 样式用于其他部分
const Accordion = styled((props: AccordionProps) => <MuiAccordion disableGutters elevation={0} square {...props} />)(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  '&:not(:last-child)': {
    marginBottom: '8px',
  },
  '::before': {
    display: 'none',
  },
  backgroundColor: '#f9fafb',
  '&.Mui-expanded': {
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', // 添加阴影效果
  },
}))

const AccordionSummary = styled((props: AccordionSummaryProps) => {
  // 提取children和其他props
  const { children, ...other } = props
  return (
    <MuiAccordionSummary expandIcon={<ArrowForwardIosSharpIcon sx={{ fontSize: '0.9rem' }} />} {...other}>
      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="clickable-area" style={{ flexGrow: 1 }}>
          {Array.isArray(children) ? children[0] : children}
        </div>
        {Array.isArray(children) && children.length > 1 && (
          <div className="action-area" onClick={e => e.stopPropagation()} style={{ marginLeft: '16px' }}>
            {children.slice(1)}
          </div>
        )}
      </div>
    </MuiAccordionSummary>
  )
})(() => ({
  height: '50px',
  flexDirection: 'row-reverse',
  [`& .${accordionSummaryClasses.expandIconWrapper}.${accordionSummaryClasses.expanded}`]: {
    transform: 'rotate(90deg)',
  },
  [`& .${accordionSummaryClasses.content}`]: {
    marginLeft: '8px',
    width: '100%',
  },
}))

const AccordionDetails = styled(MuiAccordionDetails)(({ theme }) => ({
  padding: theme.spacing(2),
  borderTop: '1px solid rgba(0, 0, 0, .125)',
  backgroundColor: '#fff',
}))

// 记忆变量类型定义 - 描述、默认值设为可选，增加启用状态
interface MemoryVariable {
  id: string
  name: string
  description: string
  enabled?: boolean // 新增：是否启用，默认 true
}

const api = {
  deleteUserVariable: async (user_id: string, group_id: string, key: string) => {
    await axios.post('/api/v1/execution/memory/delete_user_variable', {
      user_id: user_id,
      group_id: group_id,
      name: key,
    })
  },
}

const AgentModelSelector = (props: {
  agentDetailResponse: AgentDetailResponse | null
  saveAgentRequest: SaveAgentRequest
  onLongTermChange?: (enabled: boolean) => void
}) => {
  const { agentDetailResponse, saveAgentRequest, onLongTermChange } = props
  const { updateModelDetail, updateWorkflowDetail, updatePluginDetail, updateGreeting, updateMemoryConfig } = useAgentStore()
  const readonly = useAgentStore(s => s.readonly)
  const { user } = useAuthStore()
  const user_id = saveAgentRequest.space_id
  const group_id = saveAgentRequest.agent_id

  const [selectedModelName, setSelectedModelName] = useState<string>('')
  const [selectedModel, setSelectedModel] = useState<ModelDetail | null>(null)
  const [modelsList, setModelsList] = useState<ModelDetail[]>([])
  const [modelExpanded, setModelExpanded] = useState<boolean>(false)

  // 使用 ref 来跟踪是否已经初始化
  const initializedRef = useRef(false)

  // 获取模型管理API的完整模型列表
  const { data: modelsData } = useModels({
    spaceId: user?.spaceId || '0',
    size: 100,
    sort_by: 'update_time',
    sort_order: 'desc',
  })
  const [workflowObjects, setWorkflowObjects] = useState<WorkflowDetail[]>([])
  const [showWorkflowSelector, setShowWorkflowSelector] = useState(false)
  const [workflowListRefreshToken, setWorkflowListRefreshToken] = useState<number>(0)
  const [pluginObjects, setPluginObjects] = useState<AgentPlugin[]>([])
  const [showPluginSelector, setShowPluginSelector] = useState(false)
  const [greeting, setGreeting] = useState<string>('')

  const spaceId = getDefaultSpaceId() || ''

  const { validationResults, setValidationResults, validateWorkflows, isValidating, workflowValidationErrorCount } = useWorkflowValidation({
    workflows: workflowObjects,
    spaceId,
  })

  useEffect(() => {
    if (!initializedRef.current) return
    const newWorkflows = saveAgentRequest?.workflows || []
    setWorkflowObjects(newWorkflows)
  }, [saveAgentRequest?.workflows])

  useEffect(() => {
    if (!initializedRef.current) return
    if (!spaceId) return
    const t = setTimeout(() => {
      validateWorkflows(workflowObjects).catch(() => {})
    }, 200)
    return () => clearTimeout(t)
  }, [workflowObjects, spaceId, validateWorkflows])

  // 记忆配置状态
  const [memoryVariables, setMemoryVariables] = useState<MemoryVariable[]>([])
  const [longTermMemoryEnabled, setLongTermMemoryEnabled] = useState<boolean>(false)
  const [newVariableName, setNewVariableName] = useState<string>('')
  const [newVariableDescription, setNewVariableDescription] = useState<string>('')
  const [duplicateVariableWarning, setDuplicateVariableWarning] = useState<string>('')

  // 将模型管理API的数据转换为ModelDetail格式
  useEffect(() => {
    if (modelsData?.items) {
      const convertedModels: ModelDetail[] = modelsData.items.map(model => ({
        model_id: parseInt(model.id),
        model_name: model.name,
        model_type: model.modelId,
        model_provider: model.provider,
        max_tokens: model.maxTokens,
        temperature: model.temperature,
        top_p: model.topp,
        timeout: model.timeout,
        retry_count: model.retryCount,
        enable_streaming: model.enableStreaming,
        enable_function_calling: model.enableFunctionCalling,
        is_active: model.isActive, // 使用转换后的 isActive 字段
        api_key: model.apiKey,
        api_base: model.baseUrl,
        streaming: model.enableStreaming,
      }))

      setModelsList(convertedModels)
    }
  }, [modelsData])

  // 当获取到 agentDetail 值时，初始化数据
  useEffect(() => {
    // 只在数据加载完成且未初始化时执行一次
    if (agentDetailResponse && agentDetailResponse.data && modelsData && !initializedRef.current) {
      initializedRef.current = true

      // 获取详情中的model数据,并做初始化
      const initModelInfo = saveAgentRequest?.model?.model_info || {}
      const initModelName = initModelInfo?.model_name || ''

      // 如果有模型列表且未选择模型，则默认选择第一个
      if (modelsList.length > 0 && !initModelName) {
        setSelectedModelName(modelsList[0].model_name)
        setSelectedModel(modelsList[0])
        // 修改store中的数据
        updateModelDetail(modelsList[0])
      }
      // 如果有已选择的模型名称，从模型列表中找到完整的模型信息并更新状态
      else if (initModelName && modelsList.length > 0) {
        const matchedModel = modelsList.find(model => model.model_name === initModelName)
        if (matchedModel) {
          setSelectedModelName(initModelName)
          setSelectedModel(matchedModel)
          updateModelDetail(matchedModel)
        } else {
          // 如果模型列表中没有找到匹配的模型，仍然设置名称但使用保存的数据
          setSelectedModelName(initModelName)
          // 创建一个包含保存的模型信息的对象
          const modelFromSaved = {
            model_name: initModelName,
            model_id: initModelInfo?.model_id || 0,
            model_type: initModelInfo?.model_type || '',
            model_provider: initModelInfo?.model_provider || initModelInfo?.provider || '',
            // 从保存的数据中恢复所有参数
            temperature: initModelInfo?.temperature ?? 0.7,
            top_p: initModelInfo?.top_p ?? 0.9,
            max_tokens: initModelInfo?.max_tokens ?? 4000,
            timeout: initModelInfo?.timeout ?? 3600,
            api_key: initModelInfo?.api_key || '',
            api_base: initModelInfo?.api_base || '',
            streaming: initModelInfo?.streaming ?? true,
            // 优先使用模型列表中的 is_active，如果没有则使用保存的值
            is_active: initModelInfo?.is_active !== undefined ? initModelInfo.is_active : true,
          }
          setSelectedModel(modelFromSaved)
          updateModelDetail(modelFromSaved)
        }
      } else if (initModelName) {
        // 模型列表为空但有保存的模型名称
        setSelectedModelName(initModelName)
        const modelFromSaved = {
          model_name: initModelName,
          model_id: initModelInfo?.model_id || 0,
          model_type: initModelInfo?.model_type || '',
          model_provider: initModelInfo?.model_provider || initModelInfo?.provider || '',
          // 从保存的数据中恢复所有参数
          temperature: initModelInfo?.temperature ?? 0.7,
          top_p: initModelInfo?.top_p ?? 0.9,
          max_tokens: initModelInfo?.max_tokens ?? 4000,
          timeout: initModelInfo?.timeout ?? 3600,
          api_key: initModelInfo?.api_key || '',
          api_base: initModelInfo?.api_base || '',
          streaming: initModelInfo?.streaming ?? true,
          // 如果保存的数据中没有 is_active，默认为 true
          is_active: initModelInfo?.is_active !== undefined ? initModelInfo.is_active : true,
        }
        setSelectedModel(modelFromSaved)
        updateModelDetail(modelFromSaved)
      }

      // 获取详情中的workflow数据
      const initWorkflows = saveAgentRequest?.workflows || []
      setWorkflowObjects(initWorkflows)

      // 获取详情中的plugin数据
      const initPlugins = saveAgentRequest?.plugins || []
      setPluginObjects(initPlugins)

      // 获取详情中的开场白数据
      const initGreeting = saveAgentRequest?.opening_remarks || ''
      setGreeting(initGreeting)

      // 获取记忆配置数据
      const initVariables = saveAgentRequest?.memory?.variable_config || []
      const initLongTermMemory = saveAgentRequest?.memory?.longterm_memory_config || false

      setMemoryVariables(
        initVariables.map((v: { id?: string; name?: string; description?: string; enabled?: boolean }, index: number) => ({
          id: v.id || `var_${Date.now()}_${index}`,
          name: v.name || '',
          description: v.description,
          enabled: v.enabled !== undefined ? v.enabled : true, // 默认启用
        })),
      )
      setLongTermMemoryEnabled(initLongTermMemory)
    }
  }, [agentDetailResponse, saveAgentRequest, modelsData])

  // 当模型列表更新时，如果当前选择的模型在列表中，更新为最新数据
  // 注意：只在初始化时同步，避免覆盖用户的修改
  useEffect(() => {
    if (selectedModelName && modelsList.length > 0 && !selectedModel) {
      // 只在 selectedModel 不存在时（初始化阶段）才从 modelsList 中获取
      const updatedModel = modelsList.find(model => model.model_name === selectedModelName)
      if (updatedModel) {
        setSelectedModel(updatedModel)
        updateModelDetail(updatedModel)
      }
    }
  }, [modelsList, selectedModelName])

  // 当模型列表加载完成后，如果未选择模型或模型列表为空，则自动展开折叠面板
  useEffect(() => {
    if (modelsList.length === 0 || !selectedModelName) {
      // 模型列表为空或未选择模型时展开
      setModelExpanded(true)
    } else if (selectedModelName) {
      // 如果已选择模型且模型列表不为空，可以折叠面板
      setModelExpanded(false)
    }
  }, [modelsList.length, selectedModelName]) // 使用 selectedModelName 而不是 selectedModel

  // 处理模型变化（选择）
  const handleModelChange = (modelName: string) => {
    setSelectedModelName(modelName)
    // 根据选择的模型名称找到对应的模型对象
    const selectedModelObj = modelsList.find(model => model.model_name === modelName)
    if (selectedModelObj) {
      setSelectedModel(selectedModelObj)
      // 选择模型后，自动折叠折叠面板
      setModelExpanded(false)
      // 修改store中的数据
      updateModelDetail(selectedModelObj)
    }
  }

  // 处理模型详细信息变化
  const handleModelDetailChange = (updatedModel: ModelDetail) => {
    // 更新本地状态，确保 UI 显示最新值，避免被 useEffect 重置
    setSelectedModel(updatedModel)
    // 修改store中的数据
    updateModelDetail(updatedModel)
  }

  // 处理折叠面板展开/收起状态变化
  const handleAccordionChange = (event: React.SyntheticEvent, isExpanded: boolean) => {
    setModelExpanded(isExpanded)
  }

  const handleWorkflowConfirm = (workflowsIds: string[], workflowObjects: WorkflowSelectDetail[]) => {
    const workflowDetails = workflowObjects.map(workflow => ({
      workflow_id: workflow.workflow_id,
      workflow_name: workflow.name || '',
      workflow_version: workflow.version || '',
      description: workflow.desc || '',
    }))
    setWorkflowObjects(workflowDetails)
    updateWorkflowDetail(workflowDetails)
    setShowWorkflowSelector(false)
    validateWorkflows(workflowDetails).catch(() => {})
  }

  // 处理插件选择
  interface PluginObject {
    plugin_id: string
    name?: string
    selectedVersion?: string
    selectedTools?: PluginApiInfo[]
  }
  const handlePluginConfirm = (pluginObject: PluginObject[]) => {
    const mapped: AgentPlugin[] = []
    for (const p of pluginObject || []) {
      if (!p?.plugin_id || !Array.isArray(p.selectedTools) || p.selectedTools.length === 0) {
        continue
      }

      // 为每个选中的工具创建一个插件条目
      for (const tool of p.selectedTools) {
        mapped.push({
          plugin_id: p.plugin_id,
          plugin_name: p.name || undefined,
          tool_id: tool.tool_id,
          tool_name: tool.name || undefined,
          plugin_version: p.selectedVersion || 'draft',
        })
      }
    }
    if (mapped.length === 0) {
      return
    }
    const deduped = [...pluginObjects]
    for (const m of mapped) {
      if (!deduped.some(x => x.plugin_id === m.plugin_id && x.tool_id === m.tool_id)) {
        deduped.push(m)
      }
    }
    setPluginObjects(deduped)
    updatePluginDetail(deduped)
    setShowPluginSelector(false)
  }

  // 处理工作流操作（删除/设置）
  const handleWorkflowOperation = (operate: 'delete' | 'setting', workflowId: string, version?: string) => {
    if (operate === 'delete') {
      setWorkflowObjects(prevWorkflows => {
        const updatedWorkflows = prevWorkflows.filter(workflow => workflow.workflow_id !== workflowId)
        updateWorkflowDetail(updatedWorkflows)
        return updatedWorkflows
      })
      setValidationResults(prev => {
        const next = { ...prev }
        delete next[workflowId]
        return next
      })
    } else if (operate === 'setting') {
      // 处理设置操作，打开新页面设置工作流
      const versionParam = version && version !== 'draft' ? `&version=${version}` : ''
      window.open(`/dashboard/workflows/editor/${workflowId}?spaceId=${spaceId}${versionParam}`, '_blank')
    }
  }

  const handleRefreshWorkflows = useCallback(() => {
    setWorkflowListRefreshToken(t => t + 1)
    validateWorkflows(workflowObjects).catch(() => {})
  }, [validateWorkflows, workflowObjects])

  // 处理插件操作（删除）
  const handlePluginOperation = (operate: 'delete', pluginId: string, toolId: string) => {
    if (operate === 'delete') {
      setPluginObjects(prevPlugins => {
        const updatedPlugins = prevPlugins.filter(plugin => plugin.tool_id !== toolId)
        // 更新插件数据到store
        updatePluginDetail(updatedPlugins)
        return updatedPlugins
      })
    }
  }

  // 检查变量名是否重复
  useEffect(() => {
    if (newVariableName.trim()) {
      const duplicateVariable = memoryVariables.find(v => v.name === newVariableName.trim())
      if (duplicateVariable) {
        setDuplicateVariableWarning(`变量名"${newVariableName.trim()}"重复`)
      } else {
        setDuplicateVariableWarning('')
      }
    } else {
      setDuplicateVariableWarning('')
    }
  }, [newVariableName, memoryVariables])

  // 记忆配置相关函数
  const handleAddMemoryVariable = async () => {
    if (newVariableName.trim() && !duplicateVariableWarning) {
      const newVariable: MemoryVariable = {
        id: `var_${Date.now()}`,
        name: newVariableName.trim(),
        description: newVariableDescription.trim(),
        enabled: true, // 默认启用
      }
      const updatedVariables = [...memoryVariables, newVariable]
      setMemoryVariables(updatedVariables)
      const req = {
        max_tokens: 1000,
        variable_config: updatedVariables,
        longterm_memory_config: longTermMemoryEnabled,
      }

      try {
        await updateMemoryConfig(req)
      } catch (err: unknown) {
        const error = err as { response?: { data?: { detail?: string } }; message?: string }
        console.error(error.response?.data?.detail || error.message)
      }
      setNewVariableName('')
      setNewVariableDescription('')
    }
  }

  const handleDeleteMemoryVariable = async (id: string) => {
    const target = memoryVariables.find(v => v.id === id)
    const backup = memoryVariables // 预留，考虑失败回滚
    const updatedVariables = memoryVariables.filter(variable => variable.id !== id)
    setMemoryVariables(updatedVariables)
    const req = {
      max_tokens: 1000,
      variable_config: updatedVariables,
      longterm_memory_config: longTermMemoryEnabled,
    }
    try {
      await updateMemoryConfig(req)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string }
      console.error(error.response?.data?.detail || error.message)
      // setMemoryVariables(backup) // 失败回滚
    }
    try {
      await api.deleteUserVariable(user_id, group_id, target.name)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err.message || '删除失败'
      console.error(msg)
    }
  }

  const handleToggleVariableEnabled = async (id: string) => {
    // 先更新本地状态
    const updatedVariables = memoryVariables.map(v => (v.id === id ? { ...v, enabled: !v.enabled } : v))
    setMemoryVariables(updatedVariables)

    // 同步更新到store
    const req = {
      max_tokens: 1000,
      variable_config: updatedVariables,
      longterm_memory_config: longTermMemoryEnabled,
    }

    try {
      await updateMemoryConfig(req)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string }
      console.error(error.response?.data?.detail || error.message)
      // 失败时回滚状态
      setMemoryVariables(memoryVariables)
    }
  }

  const handleLongTermMemoryToggle = async () => {
    const next = !longTermMemoryEnabled
    setLongTermMemoryEnabled(next)
    onLongTermChange?.(next)

    const req = {
      max_tokens: 1000,
      variable_config: memoryVariables,
      longterm_memory_config: !longTermMemoryEnabled,
    }

    try {
      await updateMemoryConfig(req)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string }
      console.error(error.response?.data?.detail || error.message)
    }
  }

  return (
    <div className="h-full overflow-auto">
      <div className="model-form mb-2 p-2">
        <Typography sx={{ mb: 2 }}>模型配置</Typography>
        <Accordion expanded={modelExpanded} onChange={handleAccordionChange}>
          <AccordionSummary aria-controls="model-content" id="model-header">
            <Typography component="span">模型</Typography>
            {modelsList.length > 0 ? (
              <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                <Select
                  value={selectedModelName || ''}
                  onChange={event => handleModelChange(event.target.value as string)}
                  displayEmpty
                  renderValue={value => {
                    // 如果选择的模型不在可用列表中，显示提示
                    if (value && !modelsList.find(model => model.model_name === value && model.is_active)) {
                      return <span style={{ color: '#d32f2f' }}>模型已禁用（{value}）</span>
                    }
                    return value ? value : <span style={{ color: 'rgba(0, 0, 0, 0.38)' }}>请选择模型</span>
                  }}
                  sx={{
                    width: 200,
                    height: 30,
                    '&.Mui-disabled': {
                      cursor: 'not-allowed',
                    },
                    '& .MuiOutlinedInput-root.Mui-disabled': {
                      cursor: 'not-allowed',
                    },
                    '& .MuiSelect-select.Mui-disabled': {
                      cursor: 'not-allowed',
                    },
                  }}
                  disabled={readonly}
                >
                  {modelsList
                    .filter(model => model.is_active)
                    .map(model => (
                      <MenuItem key={model.model_name} value={model.model_name}>
                        {model.model_name}
                      </MenuItem>
                    ))}
                </Select>
              </div>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                未配置模型
              </Typography>
            )}
          </AccordionSummary>
          <AccordionDetails>
            {modelsList.length > 0 ? (
              <>
                {selectedModelName && !modelsList.find(model => model.model_name === selectedModelName && model.is_active) ? (
                  <Alert
                    severity="warning"
                    action={
                      <Button
                        color="primary"
                        size="small"
                        component={Link}
                        to="/dashboard/models"
                        disabled={readonly}
                        sx={{ '&.Mui-disabled': { cursor: 'not-allowed' } }}
                      >
                        前往启用
                      </Button>
                    }
                  >
                    当前关联的模型&ldquo;{selectedModelName}&rdquo;已被禁用，请选择其他可用模型或前往模型管理页面启用该模型
                  </Alert>
                ) : !selectedModel ? (
                  <Alert
                    severity="info"
                    action={
                      <Button color="primary" size="small" onClick={() => setModelExpanded(true)} sx={{ mt: -1 }}>
                        点击上方选择模型
                      </Button>
                    }
                  >
                    暂无模型
                  </Alert>
                ) : (
                  selectedModel && <ModelDetailForm modelDetail={selectedModel} onModelDetailChange={handleModelDetailChange} readonly={readonly} />
                )}
              </>
            ) : (
              <Alert
                severity="info"
                action={
                  <Button
                    color="primary"
                    size="small"
                    component={Link}
                    to="/dashboard/models"
                    disabled={readonly}
                    sx={{ '&.Mui-disabled': { cursor: 'not-allowed' } }}
                  >
                    前往配置
                  </Button>
                }
              >
                当前未配置任何模型，请前往模型配置页面添加模型
              </Alert>
            )}
          </AccordionDetails>
        </Accordion>
      </div>

      <div className="workflow-form mb-2 p-2">
        <Typography sx={{ mb: 2 }}>技能</Typography>

        {/* 记忆配置 */}
        <Accordion>
          <AccordionSummary aria-controls="memory-content" id="memory-header">
            <Typography component="span" className="flex items-center">
              记忆配置
              <span
                className={`inline-flex items-center justify-center ml-2 w-[18px] h-[18px] text-xs font-medium text-white rounded-full ${
                  memoryVariables.length > 0 || longTermMemoryEnabled ? 'bg-blue-500' : 'bg-gray-400'
                }`}
              >
                {memoryVariables.length + (longTermMemoryEnabled ? 1 : 0)}
              </span>
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              变量配置
            </Typography>

            {/* 添加新变量表单 */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="变量名称"
                  value={newVariableName}
                  onChange={e => setNewVariableName(e.target.value)}
                  disabled={readonly}
                  size="small"
                  sx={{ flex: 1 }}
                  error={!!duplicateVariableWarning}
                />
                <TextField
                  label="变量描述"
                  value={newVariableDescription}
                  onChange={e => setNewVariableDescription(e.target.value)}
                  disabled={readonly}
                  size="small"
                  sx={{ flex: 2 }}
                />
                <Button
                  variant="outlined"
                  onClick={handleAddMemoryVariable}
                  disabled={readonly || !newVariableName.trim() || !newVariableDescription.trim() || !!duplicateVariableWarning}
                  size="small"
                  sx={{ alignSelf: 'flex-end', height: '40px' }}
                >
                  添加
                </Button>
              </Box>

              {/* 预留警告空间，防止按钮移动 */}
              <Box sx={{ minHeight: '20px', pl: '12px' }}>
                {duplicateVariableWarning && (
                  <Typography variant="caption" color="error">
                    {duplicateVariableWarning}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* 变量列表 */}
            {memoryVariables.length > 0 ? (
              <List sx={{ width: '100%', bgcolor: 'background.paper', maxHeight: 300, overflow: 'auto', mt: 0.5 }}>
                {memoryVariables.map(variable => (
                  <ListItem
                    key={variable.id}
                    secondaryAction={
                      <>
                        {!readonly && (
                          <FormControlLabel
                            control={<Switch size="small" checked={variable.enabled !== false} onChange={() => handleToggleVariableEnabled(variable.id)} />}
                            label={variable.enabled !== false ? '启用' : '禁用'}
                            labelPlacement="start"
                            sx={{ mr: 1 }}
                          />
                        )}
                        {!readonly && (
                          <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteMemoryVariable(variable.id)}>
                            <Trash2 className="w-4 h-4 text-gray-600" />
                          </IconButton>
                        )}
                      </>
                    }
                  >
                    <ListItemText primary={variable.name} secondary={<>{variable.description || '无描述'}</>} />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                暂无配置的变量
              </Typography>
            )}
            <Box sx={{ mb: 2, mt: 1 }}>
              <FormControlLabel
                control={<Switch checked={longTermMemoryEnabled} onChange={handleLongTermMemoryToggle} disabled={readonly} />}
                label="启用长期记忆"
              />
              <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                启用后，智能体将能够记住与用户的对话过程中的用户个人信息和偏好数据
              </Typography>
            </Box>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary aria-controls="workflow-content" id="workflow-header">
            <Typography component="span" className="flex items-center">
              工作流
              <span
                className={`inline-flex items-center justify-center ml-2 w-[18px] h-[18px] text-xs font-medium text-white rounded-full ${
                  workflowObjects.length > 0 ? 'bg-blue-500' : 'bg-gray-400'
                }`}
              >
                {workflowObjects.length}
              </span>
              {workflowValidationErrorCount > 0 && (
                <Tooltip title={`所选工作流存在校验不通过（${workflowValidationErrorCount} 个），请跳转对应工作流进行修改`} arrow>
                  <span className="inline-flex items-center ml-2">
                    <AlertCircle className="w-[20px] h-[20px] text-red-500" />
                  </span>
                </Tooltip>
              )}
            </Typography>
            <div className="action-area" onClick={e => e.stopPropagation()} style={{ marginLeft: '16px', display: 'flex', gap: '8px' }}>
              <Tooltip title="刷新工作流信息" arrow>
                <span>
                  <IconButton size="small" onClick={handleRefreshWorkflows} disabled={workflowObjects.length === 0} aria-label="刷新">
                    <RefreshCcw className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} />
                  </IconButton>
                </span>
              </Tooltip>
              <AddButton
                options={[
                  { label: '添加已有工作流', value: 'existing' },
                  { label: '创建新工作流', value: 'new' },
                ]}
                onSelect={addType => {
                  if (addType === 'existing') {
                    setShowWorkflowSelector(true)
                  } else if (addType === 'new') {
                    window.open('/dashboard/workflows/new', '_blank')
                  }
                }}
                disabled={readonly}
              />
            </div>
          </AccordionSummary>
          <AccordionDetails>
            {/* 工作流列表 */}
            <WorkflowList
              workflowObjects={workflowObjects}
              onClick={handleWorkflowOperation}
              disabled={readonly}
              refreshToken={workflowListRefreshToken}
              validationResults={validationResults}
            />
            {workflowObjects.length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                暂无工作流，点击上方按钮添加工作流
              </Alert>
            )}
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary aria-controls="plugin-content" id="plugin-header">
            <Typography component="span" className="flex items-center">
              插件
              <span
                className={`inline-flex items-center justify-center ml-2 w-[18px] h-[18px] text-xs font-medium text-white rounded-full ${
                  pluginObjects.length > 0 ? 'bg-blue-500' : 'bg-gray-400'
                }`}
              >
                {pluginObjects.length}
              </span>
            </Typography>
            <AddButton
              options={[
                { label: '添加已有插件', value: 'existing' },
                { label: '创建新插件', value: 'new' },
              ]}
              onSelect={addType => {
                if (addType === 'existing') {
                  // 打开插件选择器
                  setShowPluginSelector(true)
                } else if (addType === 'new') {
                  // 导航到创建新插件页面
                  window.open('/dashboard/plugins', '_blank ')
                }
              }}
              disabled={readonly}
            />
          </AccordionSummary>
          <AccordionDetails>
            {/* 插件列表 */}
            <PluginList pluginObjects={pluginObjects} onClick={handlePluginOperation} disabled={readonly} />
          </AccordionDetails>
        </Accordion>
      </div>

      <div className="panel3d-form mb-2 p-2">
        <Typography sx={{ mb: 2 }}>对话设置</Typography>
        <Accordion defaultExpanded={true}>
          <AccordionSummary aria-controls="greeting-content" id="greeting-header">
            <Typography component="span">开场白</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TextField
              value={greeting}
              onChange={e => {
                setGreeting(e.target.value)
                updateGreeting(e.target.value)
              }}
              fullWidth
              multiline
              rows={4}
              disabled={readonly}
              sx={{
                '& .MuiInputBase-root.Mui-disabled': {
                  cursor: 'not-allowed',
                },
                '& .MuiInputBase-input.Mui-disabled': {
                  cursor: 'not-allowed',
                },
              }}
            />
          </AccordionDetails>
        </Accordion>
      </div>

      {showWorkflowSelector && !readonly && (
        <WorkflowSelector
          open={showWorkflowSelector}
          onClose={() => setShowWorkflowSelector(false)}
          onConfirm={handleWorkflowConfirm}
          initialSelected={workflowObjects.map(workflow => workflow.workflow_id)}
        />
      )}
      {showPluginSelector && !readonly && (
        <PluginSelector open={showPluginSelector} onClose={() => setShowPluginSelector(false)} onConfirm={handlePluginConfirm} initialSelected={[]} />
      )}
    </div>
  )
}

export default AgentModelSelector
