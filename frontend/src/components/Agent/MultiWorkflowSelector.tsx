import { styled } from '@mui/material/styles'
import ArrowForwardIosSharpIcon from '@mui/icons-material/ArrowForwardIosSharp'
import MuiAccordion, { AccordionProps } from '@mui/material/Accordion'
import MuiAccordionSummary, { AccordionSummaryProps, accordionSummaryClasses } from '@mui/material/AccordionSummary'
import MuiAccordionDetails from '@mui/material/AccordionDetails'
import Typography from '@mui/material/Typography'
import { AgentDetailResponse, SaveAgentRequest } from '@test-agentstudio/api-client'
import { useState, useEffect, useRef } from 'react'
import { ModelDetail, WorkflowDetail, WorkflowSelectDetail } from '../../types/agentTypes'
import { Button, Alert, TextField, Select, MenuItem, Slider, Box, IconButton, Popover, Tooltip, InputAdornment } from '@mui/material'
import { Link } from 'react-router-dom'
import SettingsIcon from '@mui/icons-material/Settings'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import WorkflowSelector from './WorkflowSelector'
import { useAgentStore } from '@/stores/useAgentStore'
import AddButton from './AddButton'
import WorkflowList from './WorkflowList'
import ModelDetailForm from './ModelDetailForm'
import { useModels } from '@test-agentstudio/api-client'
import { useAuthStore } from '../../stores/useAuthStore'

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
})(theme => ({
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

const MultiWorkflowSelector = (props: { agentDetailResponse: AgentDetailResponse | null; saveAgentRequest: SaveAgentRequest }) => {
  const { agentDetailResponse, saveAgentRequest } = props
  const { updateWorkflowDetail, updateModelDetail, updateGreeting, updateSaveAgentRequest } = useAgentStore()
  const readonly = useAgentStore(s => s.readonly)
  const { user } = useAuthStore()
  const [selectedModelName, setSelectedModelName] = useState<string>('')
  const [selectedModel, setSelectedModel] = useState<ModelDetail | null>(null)
  const [modelsList, setModelsList] = useState<ModelDetail[]>([])
  const [modelExpanded, setModelExpanded] = useState<boolean>(true)

  // 使用 ref 来跟踪是否已经初始化
  const initializedRef = useRef(false)
  const [workflowObjects, setWorkflowObjects] = useState<WorkflowDetail[]>([])
  const [showWorkflowSelector, setShowWorkflowSelector] = useState(false)
  const [greeting, setGreeting] = useState<string>('')
  const [defaultResponse, setDefaultResponse] = useState<string>('')
  const [maxMessageRounds, setMaxMessageRounds] = useState<number>(3)
  const [conversationSettingsAnchorEl, setConversationSettingsAnchorEl] = useState<null | HTMLElement>(null)

  // 获取模型管理API的完整模型列表
  const {
    data: modelsData,
    isLoading: modelsLoading,
    error: modelsError,
  } = useModels({
    spaceId: user?.spaceId || '0',
    size: 100,
    sort_by: 'update_time',
    sort_order: 'desc',
  })

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
          // 合并模型列表中的默认值和保存的数据中的值
          // 优先使用保存的数据中的参数值（temperature、top_p、timeout），这些是用户实际保存的值
          const modelToUpdate: ModelDetail = {
            ...matchedModel,
            // 使用保存的数据中的参数值，这些值可能是用户修改过的
            temperature: initModelInfo?.temperature ?? matchedModel.temperature,
            top_p: initModelInfo?.top_p ?? matchedModel.top_p,
            timeout: initModelInfo?.timeout ?? matchedModel.timeout,
            max_tokens: initModelInfo?.max_tokens ?? matchedModel.max_tokens,
            // 保留其他保存的字段（如果存在）
            api_key: initModelInfo?.api_key || matchedModel.api_key,
            api_base: initModelInfo?.api_base || matchedModel.api_base,
            streaming: initModelInfo?.streaming ?? matchedModel.streaming,
          }
          setSelectedModel(modelToUpdate)
          updateModelDetail(modelToUpdate)
        } else {
          // 如果模型列表中没有找到匹配的模型，使用保存的数据
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

      // 获取详情中的开场白数据
      const initGreeting = saveAgentRequest?.opening_remarks || ''
      setGreeting(initGreeting)

      const initDefaultResponse = saveAgentRequest?.default_response || ''
      setDefaultResponse(initDefaultResponse)

      // 获取详情中的最大消息轮数 - 只在初始化时设置，避免循环依赖
      const currentMaxRounds = saveAgentRequest?.constraint?.reserved_max_chat_rounds
      if (currentMaxRounds !== undefined) {
        setMaxMessageRounds(currentMaxRounds)
      }
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
  }

  // 处理工作流操作（删除/设置）
  const handleWorkflowOperation = (operate: 'delete' | 'setting', workflowId: string, version?: string) => {
    if (operate === 'delete') {
      setWorkflowObjects(prevWorkflows => {
        const updatedWorkflows = prevWorkflows.filter(workflow => workflow.workflow_id !== workflowId)
        updateWorkflowDetail(updatedWorkflows)
        return updatedWorkflows
      })
    } else if (operate === 'setting') {
      // 处理设置操作，打开新页面设置工作流，携带版本信息
      const spaceId = agentDetailResponse?.data?.agent_info?.space_id || ''
      const versionParam = version && version !== 'draft' ? `&version=${version}` : ''
      window.open(`/dashboard/workflows/editor/${workflowId}?spaceId=${spaceId}${versionParam}`, '_blank')
    }
  }

  // 处理最大消息轮数变化
  const handleMaxMessageRoundsChange = (value: number) => {
    setMaxMessageRounds(value)
    // 使用函数式更新避免useEffect依赖循环
    updateSaveAgentRequest(prev => ({
      ...prev,
      constraint: {
        ...prev?.constraint,
        reserved_max_chat_rounds: value,
        max_iteration: prev?.constraint?.max_iteration || 10,
      },
    }))
  }

  // 处理对话设置按钮点击
  const handleConversationSettingsClick = (event: React.MouseEvent<HTMLElement>) => {
    setConversationSettingsAnchorEl(event.currentTarget)
  }

  // 处理对话设置关闭
  const handleConversationSettingsClose = () => {
    setConversationSettingsAnchorEl(null)
  }

  return (
    <div className="h-full overflow-auto">
      <div className="workflow-form mb-2 p-2">
        <Typography sx={{ mb: 2 }}>编排配置</Typography>
        <Accordion defaultExpanded={true}>
          <AccordionSummary aria-controls="workflow-content" id="workflow-header">
            <Typography component="span" className="flex items-center">
              工作流
              <span
                className={`inline-flex items-center justify-center ml-2 w-[18px] h-[18px] text-xs font-medium text-white rounded-full ${workflowObjects.length > 0 ? 'bg-blue-500' : 'bg-gray-400'}`}
              >
                {workflowObjects.length}
              </span>
            </Typography>
            <div className="action-area" onClick={e => e.stopPropagation()} style={{ marginLeft: '16px', display: 'flex', gap: '8px' }}>
              {/* <Tooltip title="对话设置" arrow>
                <IconButton
                  size="small"
                  onClick={handleConversationSettingsClick}
                  disabled={readonly}
                  sx={{
                    color: 'text.secondary',
                    '&:hover': { color: 'primary.main' },
                    '&.Mui-disabled': { cursor: 'not-allowed' },
                  }}
                >
                  <SettingsIcon fontSize="small" />
                </IconButton>
              </Tooltip> */}
              <AddButton
                options={[
                  { label: '添加已有工作流', value: 'existing' },
                  { label: '创建新工作流', value: 'new' },
                ]}
                onSelect={addType => {
                  if (addType === 'existing') {
                    // 打开工作流选择器
                    setShowWorkflowSelector(true)
                  } else if (addType === 'new') {
                    // 创建工作流的逻辑，在新页面打开
                    window.open('/dashboard/workflows/new', '_blank')
                  }
                }}
                disabled={readonly}
              />
            </div>
          </AccordionSummary>
          <AccordionDetails>
            {/* 工作流列表 */}
            <WorkflowList workflowObjects={workflowObjects} onClick={handleWorkflowOperation} disabled={readonly} />
            {workflowObjects.length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                暂无工作流，点击上方按钮添加工作流
              </Alert>
            )}
          </AccordionDetails>
        </Accordion>
      </div>
      <div className="model-form mb-2 p-2">
        <Typography sx={{ mb: 2 }}>控制器配置</Typography>
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
                    '&.Mui-disabled': { cursor: 'not-allowed' },
                    '& .MuiOutlinedInput-root.Mui-disabled': { cursor: 'not-allowed' },
                    '& .MuiSelect-select.Mui-disabled': { cursor: 'not-allowed' },
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
        <Accordion defaultExpanded={true}>
          <AccordionSummary aria-controls="default-response-content" id="default-response-header">
            <Typography component="span">默认回复</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TextField
              value={defaultResponse}
              onChange={e => {
                const val = e.target.value
                setDefaultResponse(val)
                updateSaveAgentRequest({
                  default_response: val,
                })
              }}
              fullWidth
              multiline
              rows={4}
              placeholder="设置默认回复文本，用于无工作流匹配或需提供通用回复的场景..."
              disabled={readonly}
              sx={{
                '& .MuiInputBase-root.Mui-disabled': { cursor: 'not-allowed' },
                '& .MuiInputBase-input.Mui-disabled': { cursor: 'not-allowed' },
              }}
            />
          </AccordionDetails>
        </Accordion>
      </div>
      <div className="dialog-form mb-2 p-2">
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
              placeholder="设置智能体的开场白，让用户了解如何开始对话..."
              disabled={readonly}
              sx={{
                '& .MuiInputBase-root.Mui-disabled': { cursor: 'not-allowed' },
                '& .MuiInputBase-input.Mui-disabled': { cursor: 'not-allowed' },
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

      {/* 对话设置 Popover */}
      <Popover
        open={Boolean(conversationSettingsAnchorEl)}
        anchorEl={conversationSettingsAnchorEl}
        onClose={handleConversationSettingsClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        PaperProps={{
          sx: {
            p: 2,
            minWidth: 280,
            maxWidth: 320,
          },
        }}
      >
        <Typography variant="h6" sx={{ mb: 1, fontSize: '1rem' }}>
          对话设置
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          设置工作流执行时携带的最大消息轮数
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* 减少按钮 */}
          <IconButton
            onClick={() => handleMaxMessageRoundsChange(Math.max(0, maxMessageRounds - 1))}
            disabled={readonly || maxMessageRounds <= 0}
            size="small"
            sx={{
              width: 28,
              height: 28,
              color: 'text.secondary',
              '&.Mui-disabled': { color: 'action.disabled' },
            }}
          >
            <RemoveIcon fontSize="small" />
          </IconButton>

          {/* 输入框 */}
          <TextField
            value={maxMessageRounds}
            onChange={e => {
              const inputValue = e.target.value.trim()

              // 允许空字符串（用户正在删除输入）
              if (inputValue === '') {
                return
              }

              // 检查是否只包含数字
              if (!/^\d+$/.test(inputValue)) {
                return
              }

              // 转换为数字，支持0值
              const value = parseInt(inputValue, 10)

              // 验证范围：0-100，且为有效数字
              if (!isNaN(value) && value >= 0 && value <= 100) {
                handleMaxMessageRoundsChange(value)
              }
            }}
            onBlur={e => {
              // 失焦时确保有有效值，如果没有则设置为0
              const inputValue = e.target.value.trim()
              if (inputValue === '') {
                handleMaxMessageRoundsChange(0)
              } else if (/^\d+$/.test(inputValue)) {
                const value = parseInt(inputValue, 10)
                if (!isNaN(value) && value >= 0 && value <= 100) {
                  handleMaxMessageRoundsChange(value)
                } else {
                  handleMaxMessageRoundsChange(0)
                }
              } else {
                handleMaxMessageRoundsChange(0)
              }
            }}
            type="text"
            inputProps={{
              inputMode: 'numeric',
              pattern: '[0-9]*',
              min: 0,
              max: 100,
              style: {
                textAlign: 'center',
                fontSize: '14px',
                padding: '4px 8px',
                height: '28px',
              },
            }}
            disabled={readonly}
            sx={{
              width: 60,
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'rgba(0, 0, 0, 0.23)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(0, 0, 0, 0.87)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.main',
                },
                '&.Mui-disabled fieldset': {
                  borderColor: 'rgba(0, 0, 0, 0.12)',
                },
              },
              '& .MuiInputBase-input': {
                height: '20px',
                padding: '4px 8px !important',
              },
              '& .MuiFormHelperText-root': {
                display: 'none',
              },
            }}
          />

          {/* 增加按钮 */}
          <IconButton
            onClick={() => handleMaxMessageRoundsChange(Math.min(100, maxMessageRounds + 1))}
            disabled={readonly || maxMessageRounds >= 100}
            size="small"
            sx={{
              width: 28,
              height: 28,
              color: 'text.secondary',
              '&.Mui-disabled': { color: 'action.disabled' },
            }}
          >
            <AddIcon fontSize="small" />
          </IconButton>

          {/* 提示文字 */}
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            最大消息轮数
          </Typography>
        </Box>
      </Popover>
    </div>
  )
}

export default MultiWorkflowSelector
