import React, { useMemo, useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Paper } from '@mui/material'
import DeleteConfirmationDialog from '@/components/Common/DeleteConfirmationDialog'

import { useAgentStore } from '@/stores/useAgentStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { ActionSlotMount } from '@/components/Common/ActionSlot'
import AgentAssociatePromptDialog from '@/components/Agent/AgentAssociatePromptDialog'
import {
  RelatedMemberService,
  MemberType,
  type RelatedMemberInfo,
  PromptService,
  type AgentDetailResponse,
  FeedbackOptService,
  type GetRelationsResponse,
} from '@test-agentstudio/api-client'
import { buildModelInfoFromAgent } from '@/utils/prompts/modelInfoBuilder'
import { getDefaultSpaceId } from '@/utils/spaceUtils'
import { ENV_CONFIG } from '@/config/environment'
import SavePromptDialog from '@/components/Agent/SavePromptDialog'
import OverridePromptTemplateDialog from '@/components/Agent/OverridePromptTemplateDialog'
import { getVersionOptions, mergeCurrentVersionOption, fetchPromptText, compareVersions, incrementVersion } from './helper/promptHelpers'
import { isVersionFormatValid } from './helper/promptHelpers'
import UnifiedSnackbar, { SnackbarMessage } from '@/Common/UnifiedSnackbar'
import { PromptTitleActions } from '@/components/Agent/PromptTitleActions'
import { PromptGenerationBanner } from '@/components/Agent/PromptGenerationBanner'
import { PromptRelationInfoBar } from '@/components/Agent/PromptRelationInfoBar'

const PromptEditor: React.FC<{
  textAreaRef: React.RefObject<HTMLTextAreaElement> | React.MutableRefObject<HTMLTextAreaElement | null>
  effectiveText: string
  readonly: boolean
  isLockedForCandidate: boolean
  onChange: (value: string) => void
  placeholder?: string
}> = ({ textAreaRef, effectiveText, readonly, isLockedForCandidate, onChange, placeholder }) => (
  <Paper elevation={0} className="relative flex-1 min-h-0 flex flex-col">
    <textarea
      ref={textAreaRef}
      value={effectiveText}
      onChange={e => {
        const newPrompt = e.target.value
        if (readonly || isLockedForCandidate) return
        onChange(newPrompt)
      }}
      placeholder={placeholder}
      className={`h-full w-full p-2 text-sm placeholder:text-gray-400 text-gray-600 border rounded-xl resize-y min-h-[240px] max-h-[80vh] overflow-auto${readonly || isLockedForCandidate ? ' cursor-not-allowed' : ''}`}
      readOnly={readonly || isLockedForCandidate}
    />
  </Paper>
)
const SystemPromptTab: React.FC<{ agentDetailResponse?: AgentDetailResponse | null }> = ({ agentDetailResponse }) => {
  const { t } = useTranslation()
  const { saveAgentRequest, updateSaveAgentRequest } = useAgentStore()
  const readonly = useAgentStore(s => s.readonly)
  const { user } = useAuthStore()

  // 关联提示词弹窗开关
  const [associateDialogOpen, setAssociateDialogOpen] = useState(false)

  const handleOpenAssociateDialog = () => setAssociateDialogOpen(true)
  const handleCloseAssociateDialog = () => setAssociateDialogOpen(false)

  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  // 当前关联的提示词与版本信息
  const [currentRelation, setCurrentRelation] = useState<{ promptId: string; promptVersion: string; promptName: string } | null>(null)
  // 版本下拉相关状态
  const [versionLoading, setVersionLoading] = useState(false)
  const [versionOptions, setVersionOptions] = useState<{ id: string; version: string }[]>([])
  const [selectedVersion, setSelectedVersion] = useState<string>('')
  // 当选中版本不在选项列表时，回退为空值，避免 MUI Select 越界告警
  const safeSelectedVersion = useMemo(() => (versionOptions.some(v => v.version === selectedVersion) ? selectedVersion : ''), [selectedVersion, versionOptions])

  // 版本比较改为使用 helper 中的 compareVersions
  const latestVersion = useMemo<string | undefined>(() => {
    if (!versionOptions || versionOptions.length === 0) return undefined
    return versionOptions.map(v => v.version).reduce((acc, cur) => (compareVersions(acc, cur) >= 0 ? acc : cur))
  }, [versionOptions])

  // 保存提示词相关状态
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [overrideDraftDialogOpen, setOverrideDraftDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveForm, setSaveForm] = useState<{ promptKey: string; promptName: string; promptVersion: string; promptDesc: string }>({
    promptKey: '',
    promptName: '',
    promptVersion: ENV_CONFIG.DEFAULT_PROMPT_VERSION,
    promptDesc: '',
  })
  const [existingPromptInfo, setExistingPromptInfo] = useState<{ id: string; latestVersion: string } | null>(null)
  const [snackbar, setSnackbar] = useState<SnackbarMessage>({ open: false, severity: 'success', message: '', duration: 3000 })

  const [isGenerating, setIsGenerating] = useState(false)
  const quickOptimizeStreamingRef = useRef<string>('')
  const [candidatePrompt, setCandidatePrompt] = useState<string>('')
  const [displayOverride, setDisplayOverride] = useState<string | null>(null)
  const quickOptimizeAbortRef = useRef<AbortController | null>(null)

  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false)

  const agentId = useMemo(() => saveAgentRequest?.agent_id || '', [saveAgentRequest])
  const agentName = useMemo(() => saveAgentRequest?.name || '', [saveAgentRequest])
  const agentVersion = useMemo(() => saveAgentRequest?.agent_version || 'draft', [saveAgentRequest])

  const workspaceId = useMemo(() => user?.spaceId || getDefaultSpaceId(), [user])
  const userId = useMemo(() => user?.id || ENV_CONFIG.DEFAULT_USER_ID, [user])

  const agentInfoMemo = {
    id: agentId,
    version: agentVersion,
    name: agentName,
    type: MemberType.AGENT,
  }

  const makePromptInfo = (id: string, version: string, name: string) => ({
    id,
    version,
    name,
    type: MemberType.PROMPT,
  })

  const setSystemPrompt = (text: string) => {
    const currentConfigs = saveAgentRequest?.configs || {}
    updateSaveAgentRequest({ configs: { ...currentConfigs, system_prompt: text } })
  }

  const fetchCurrentRelation = async () => {
    const spaceId = workspaceId
    if (!agentId) return
    const agentInfo: RelatedMemberInfo = {
      id: agentId,
      version: agentVersion,
      name: agentName,
      type: MemberType.AGENT,
    }
    try {
      const resp = await RelatedMemberService.getPromptRelations(spaceId, agentInfo, true)
      const list = resp?.data || []
      if (Array.isArray(list) && list.length > 0) {
        const r = list[0]
        setCurrentRelation({ promptId: String(r.prompt_id), promptVersion: String(r.prompt_version || 'draft'), promptName: r.prompt_name || '' })
      } else {
        setCurrentRelation(null)
      }
    } catch (e) {
      // 获取失败不影响主流程
      setCurrentRelation(null)
    }
  }

  // 拉取当前关联提示词的版本列表
  const loadVersionListForCurrentRelation = async () => {
    const pid = currentRelation?.promptId
    if (!pid) {
      setVersionOptions([])
      return
    }
    setVersionLoading(true)
    try {
      const options = await getVersionOptions(pid)
      const merged = mergeCurrentVersionOption(options, pid, currentRelation?.promptVersion)
      setVersionOptions(merged)
    } catch (e) {
      setVersionOptions([])
    } finally {
      setVersionLoading(false)
    }
  }

  // 根据选择的版本加载对应提示词内容并更新编辑器
  const loadPromptContentByVersion = async (promptId: string, commitVersion: string) => {
    const spaceId = workspaceId
    try {
      const text = await fetchPromptText(promptId, commitVersion, spaceId, { includeDraft: true, withDefaultConfig: false })
      if (text) {
        setSystemPrompt(text)
      }
    } catch (e) {
      // 获取失败不阻断
    }
  }

  useEffect(() => {
    fetchCurrentRelation()
  }, [agentId, agentVersion])

  useEffect(() => {
    if (!associateDialogOpen) {
      // 关闭弹窗后重新拉取以获得最新的关联信息（替换时会注册关联）
      fetchCurrentRelation()
    }
  }, [associateDialogOpen])

  // 当关联信息变化时同步选中值并拉取版本列表
  useEffect(() => {
    setSelectedVersion(currentRelation?.promptVersion || '')
    loadVersionListForCurrentRelation()
  }, [currentRelation?.promptId])

  const handleUnlinkRelation = async () => {
    const spaceId = workspaceId
    const agentInfo = agentInfoMemo
    try {
      await RelatedMemberService.deletePromptRelation(spaceId, agentInfo)
      setCurrentRelation(null)
    } catch (e) {
      // 解关联失败不阻断
    }
  }

  // 选择不同版本时，更新关联关系中的版本
  const handleVersionSelectChange = async (nextVersion: string) => {
    setSelectedVersion(nextVersion)
    if (!currentRelation) return
    try {
      const spaceId = workspaceId
      const promptInfo = makePromptInfo(currentRelation.promptId, nextVersion, currentRelation.promptName || '')
      const relatedMemberInfo = agentInfoMemo
      await RelatedMemberService.registerPromptRelation(spaceId, promptInfo, relatedMemberInfo)
      setCurrentRelation(prev => (prev ? { ...prev, promptVersion: nextVersion } : prev))
      // 切换版本后加载对应内容到编辑器
      await loadPromptContentByVersion(currentRelation.promptId, nextVersion)
    } catch (e) {
      // 更新失败不阻断主流程
    }
  }

  // 接收弹窗内替换成功后的关联信息更新（乐观刷新）
  const handleRelationUpdated = (info: { promptId: string; promptName: string; promptVersion: string; promptContent: string }) => {
    setCurrentRelation({ promptId: info.promptId, promptName: info.promptName, promptVersion: info.promptVersion })
    setSelectedVersion(info.promptVersion)
    // 同步更新编辑器内容，确保版本与内容一起替换
    setSystemPrompt(info.promptContent)
  }

  // 替换系统提示词文本为所选模版内容
  const handleReplacePromptText = (text: string) => {
    setSystemPrompt(text)
    setAssociateDialogOpen(false)
  }

  // 插入系统提示词文本到现有末尾（以空行分隔）
  const handleInsertPromptText = (text: string) => {
    if (readonly) return
    const existing = typeof saveAgentRequest?.configs?.system_prompt === 'string' ? saveAgentRequest?.configs?.system_prompt : ''

    const ta = textAreaRef.current
    const start = ta?.selectionStart ?? existing.length
    const end = ta?.selectionEnd ?? start

    const before = existing.slice(0, start)
    const after = existing.slice(end)
    // 若前面无换行且已有内容，则在插入前加一个换行，避免粘连
    const needsLeadingBreak = before && !/\n$/.test(before)
    const insertText = needsLeadingBreak ? `\n${text}` : text
    const combined = `${before}${insertText}${after}`

    setSystemPrompt(combined)
    setAssociateDialogOpen(false)

    // 恢复光标到插入文本末尾
    requestAnimationFrame(() => {
      const ref = textAreaRef.current
      if (ref) {
        const pos = before.length + insertText.length
        ref.focus()
        ref.setSelectionRange(pos, pos)
      }
    })
  }

  // 从 store 中派生系统提示词
  const systemPrompt = useMemo<string>(() => {
    const sp = saveAgentRequest?.configs?.system_prompt
    return typeof sp === 'string' ? sp : ''
  }, [saveAgentRequest])

  const displayedSystemPrompt = useMemo<string>(() => {
    if (readonly) {
      const hist = agentDetailResponse?.data?.agent_info?.configs?.['system_prompt']
      return typeof hist === 'string' ? hist : ''
    }
    return systemPrompt
  }, [readonly, agentDetailResponse, systemPrompt])

  const effectiveText = useMemo(() => displayOverride ?? displayedSystemPrompt, [displayOverride, displayedSystemPrompt])

  const isLockedForCandidate = useMemo(() => isGenerating || !!candidatePrompt, [isGenerating, candidatePrompt])

  const handleQuickOptimizeGenerate = async () => {
    if (readonly) return
    const content = (systemPrompt || '').trim()
    if (!content) {
      setSnackbar({ open: true, severity: 'error', message: '系统提示词为空，无法生成。' })
      return
    }

    quickOptimizeAbortRef.current?.abort()
    quickOptimizeAbortRef.current = null
    setIsGenerating(true)
    quickOptimizeStreamingRef.current = ''
    setCandidatePrompt('')
    setDisplayOverride('')

    // 从模型列表中查找当前模型的 model_id
    const modelList = agentDetailResponse?.data?.agent_option_info?.model_list || []
    const currentModelName = saveAgentRequest.model?.model_info?.model_name || ''
    const matchedModel = modelList.find(model => model.model_name === currentModelName)
    const modelId = matchedModel?.model_id

    if (modelId === undefined || modelId === null) {
      console.warn('⚠️ [SystemPromptTab] 未找到匹配的模型ID，当前模型名称:', currentModelName, '模型列表:', modelList)
      setSnackbar({ open: true, severity: 'warning', message: '未找到匹配的模型ID，将使用默认值' })
    } else {
      console.log('✅ [SystemPromptTab] 找到匹配的模型ID:', modelId, '模型名称:', currentModelName)
    }

    // 将 AgentModelInfo 转换为 QuickOptimizeModelInfo 格式
    const modelInfo = buildModelInfoFromAgent(saveAgentRequest.model, modelId)

    const quickOptimizeRequest = {
      modelInfo,
      instruct: content,
      stream: true,
    }

    try {
      quickOptimizeAbortRef.current = new AbortController()
      await FeedbackOptService.quickOptimize(
        quickOptimizeRequest,
        (data: string) => {
          quickOptimizeStreamingRef.current += data
          setDisplayOverride(quickOptimizeStreamingRef.current)
        },
        (error: string) => {
          setSnackbar({ open: true, severity: 'error', message: `提示词生成失败: ${error}` })
          setIsGenerating(false)
          setDisplayOverride(null)
          quickOptimizeAbortRef.current = null
        },
        () => {
          setIsGenerating(false)
          setCandidatePrompt(quickOptimizeStreamingRef.current)
          setSnackbar({ open: true, severity: 'success', message: '系统提示词自动生成完成，可选择采纳。' })
          setDisplayOverride(quickOptimizeStreamingRef.current)
          quickOptimizeAbortRef.current = null
        },
        quickOptimizeAbortRef.current,
      )
    } catch (e: unknown) {
      const msg = typeof e?.message === 'string' ? e.message : '提示词生成请求失败'
      setSnackbar({ open: true, severity: 'error', message: msg })
      setIsGenerating(false)
      setDisplayOverride(null)
      quickOptimizeAbortRef.current = null
    }
  }

  const handleAdoptCandidate = () => {
    if (readonly) return
    const text = candidatePrompt || quickOptimizeStreamingRef.current || ''
    if (!text.trim()) {
      setSnackbar({ open: true, severity: 'error', message: '无可采纳内容。' })
      return
    }
    setSystemPrompt(text)
    setCandidatePrompt('')
    quickOptimizeStreamingRef.current = ''
    setDisplayOverride(null)
    setSnackbar({ open: true, severity: 'success', message: '已采纳自动生成的提示词。' })
  }

  const handleCancelCandidate = () => {
    quickOptimizeAbortRef.current?.abort()
    quickOptimizeAbortRef.current = null
    setIsGenerating(false)
    setCandidatePrompt('')
    quickOptimizeStreamingRef.current = ''
    setDisplayOverride(null)
    setSnackbar({ open: true, severity: 'success', message: '已取消自动生成结果，恢复原提示词。' })
  }

  // 打开保存提示词对话框并预填信息
  const handleOpenSaveDialog = async () => {
    const content = (systemPrompt || '').trim()
    if (!content) {
      setSnackbar({ open: true, severity: 'error', message: '系统提示词为空，无法保存。' })
      return
    }

    try {
      // 检查是否已有关联的提示词
      const agentInfo: RelatedMemberInfo = {
        id: agentId,
        version: agentVersion,
        name: agentName,
        type: MemberType.AGENT,
      }
      const resp = await RelatedMemberService.getPromptRelations(workspaceId, agentInfo, true)
      const list = resp?.data || []
      if (Array.isArray(list) && list.length > 0) {
        const r = list[0]
        const pid = String(r.prompt_id)
        const detail = await PromptService.getPromptDetail(pid, {
          workspaceId,
          withCommit: false,
          withDraft: false,
          withDefaultConfig: false,
        })
        const promptBasic = detail?.prompt?.[0]?.prompt_basic
        const latest = promptBasic?.latest_version || ENV_CONFIG.DEFAULT_PROMPT_VERSION
        const key = detail?.prompt?.[0]?.prompt_key || ''
        const name = promptBasic?.display_name || r.prompt_name || ''
        setExistingPromptInfo({ id: pid, latestVersion: latest })
        setSaveForm({
          promptKey: key,
          promptName: name,
          promptVersion: incrementVersion(latest, ENV_CONFIG.DEFAULT_PROMPT_VERSION),
          promptDesc: '',
        })
      } else {
        // 默认填充：基于Agent信息
        const defaultKey = agentId ? `agent_${agentId}` : `prompt_${Date.now()}`
        const defaultName = agentName || '未命名提示词'
        setExistingPromptInfo(null)
        setSaveForm({
          promptKey: defaultKey,
          promptName: defaultName,
          promptVersion: ENV_CONFIG.DEFAULT_PROMPT_VERSION,
          promptDesc: '',
        })
      }
      setSaveDialogOpen(true)
    } catch (e: unknown) {
      // 如果是404，表示没有关联，走新建保存流程
      const status = e?.status ?? e?.response?.status
      if (status === 404) {
        setExistingPromptInfo(null)
        setSaveForm({
          promptKey: '',
          promptName: '',
          promptVersion: ENV_CONFIG.DEFAULT_PROMPT_VERSION,
          promptDesc: '',
        })
        setSaveDialogOpen(true)
      } else {
        setSnackbar({ open: true, severity: 'error', message: '预填提示词信息失败，请稍后重试。' })
      }
    }
  }

  const handleConfirmSave = async () => {
    const { promptKey, promptName, promptVersion, promptDesc } = saveForm
    if (!promptKey.trim() || !promptName.trim() || !promptVersion.trim()) {
      setSnackbar({ open: true, severity: 'error', message: '请填写提示词Key、名称与版本。' })
      return
    }
    setSaving(true)
    try {
      let targetPromptId = existingPromptInfo?.id || ''

      // 1) 若无关联，先创建提示词
      if (!targetPromptId) {
        const createResp = await PromptService.createPrompt({
          updated_by: userId,
          prompt_key: promptKey,
          prompt_name: promptName,
          prompt_description: promptDesc || '',
          workspace_id: workspaceId,
        })
        if (createResp.code !== 0 || !createResp.prompt_id) {
          throw new Error('创建提示词失败')
        }
        targetPromptId = String(createResp.prompt_id)
      } else {
        // 已有提示词时，更新基本信息（可选）
        // 不强制修改名称/描述，保持现有；如需更新，可启用：
        // await PromptService.editPromptBasicInfo(targetPromptId, { prompt_name: promptName, prompt_description: promptDesc || '' })
      }

      // 2) 保存草稿（系统提示词）
      await PromptService.saveDraft(targetPromptId, userId, workspaceId, {
        promptMessages: [
          {
            id: 'system-msg-1',
            role: 'system',
            content: systemPrompt,
            placeholderName: undefined,
          },
        ],
        parameters: [],
        modelConfig: {
          model: '1',
          temperature: 0.7,
          maxTokens: 2048,
          top_p: 0.7,
        },
        selectedModel: null,
        templateEngine: 'normal',
        toolsEnabled: false,
        debugMode: false,
        tools: [],
      })

      // 3) 提交版本
      // 提交前的版本校验：需为 x.x.x 且大于现有最新版本
      if (
        !isVersionFormatValid(promptVersion) ||
        (existingPromptInfo?.latestVersion && compareVersions(promptVersion, existingPromptInfo.latestVersion) <= 0)
      ) {
        setSnackbar({
          open: true,
          severity: 'error',
          message: `提交版本需为 x.x.x，并且大于已存在版本${existingPromptInfo?.latestVersion ? `（当前：${existingPromptInfo.latestVersion}）` : ''}`,
        })
        setSaving(false)
        return
      }
      await PromptService.commitVersion(targetPromptId, userId, {
        commit_version: promptVersion,
        commit_description: promptDesc || `Agent ${agentName || agentId} 保存的版本`,
      })

      // 4) 注册关联（提示词 -> Agent），确保版本指向最新提交
      const promptInfo: RelatedMemberInfo = {
        id: targetPromptId,
        version: promptVersion,
        name: promptName,
        type: MemberType.PROMPT,
      }
      const relatedMemberInfo: RelatedMemberInfo = {
        id: agentId,
        version: agentVersion,
        name: agentName,
        type: MemberType.AGENT,
      }
      await RelatedMemberService.registerPromptRelation(workspaceId, promptInfo, relatedMemberInfo)

      // 5) 刷新本地关联与版本列表，并更新编辑器内容
      setCurrentRelation({ promptId: targetPromptId, promptVersion, promptName })
      setSelectedVersion(promptVersion)
      await loadVersionListForCurrentRelation()
      await loadPromptContentByVersion(targetPromptId, promptVersion)

      setSnackbar({ open: true, severity: 'success', message: '提示词已保存并提交版本。' })
      setSaveDialogOpen(false)
    } catch (e: unknown) {
      const msg = typeof e?.message === 'string' ? e.message : '保存提示词失败，请稍后重试。'
      setSnackbar({ open: true, severity: 'error', message: msg })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <ActionSlotMount name="system-title-actions">
        <PromptTitleActions
          readonly={readonly}
          isGenerating={isGenerating}
          candidatePrompt={candidatePrompt}
          saving={saving}
          systemPrompt={systemPrompt}
          onOptimize={handleQuickOptimizeGenerate}
          onAssociate={handleOpenAssociateDialog}
          onSave={handleOpenSaveDialog}
        />
      </ActionSlotMount>

      <PromptGenerationBanner
        isGenerating={isGenerating}
        candidatePrompt={candidatePrompt}
        readonly={readonly}
        onCancel={handleCancelCandidate}
        onAdopt={handleAdoptCandidate}
      />

      {/* 当前关联提示词信息与解关联（信息条样式） */}
      <PromptRelationInfoBar
        currentRelation={currentRelation}
        readonly={readonly}
        safeSelectedVersion={safeSelectedVersion}
        selectedVersion={selectedVersion}
        latestVersion={latestVersion}
        versionOptions={versionOptions}
        versionLoading={versionLoading}
        onVersionChange={handleVersionSelectChange}
        onOpenOverrideDialog={() => setOverrideDraftDialogOpen(true)}
        onOpenUnlinkConfirm={() => setUnlinkConfirmOpen(true)}
      />

      {/* 关联提示词弹窗（独立组件） */}
      <AgentAssociatePromptDialog
        open={associateDialogOpen}
        onClose={handleCloseAssociateDialog}
        onReplace={handleReplacePromptText}
        onInsert={handleInsertPromptText}
        agentInfo={{ agentId, agentName, agentVersion }}
        onRelationUpdated={handleRelationUpdated}
      />

      {/* 保存提示词弹窗（独立组件） */}
      <SavePromptDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        onConfirm={handleConfirmSave}
        saving={saving}
        existingPromptInfo={existingPromptInfo ?? undefined}
        saveForm={saveForm}
        setSaveForm={setSaveForm}
      />

      <OverridePromptTemplateDialog
        open={overrideDraftDialogOpen}
        onClose={() => setOverrideDraftDialogOpen(false)}
        onJump={() => {
          setOverrideDraftDialogOpen(false)
          const pid = currentRelation?.promptId
          if (pid) {
            const versionParam = selectedVersion || versionOptions[0]?.version || ENV_CONFIG.DEFAULT_PROMPT_VERSION
            window.open(`/dashboard/prompts/${pid}?version=${versionParam}&from=agent`, '_blank')
          }
        }}
        onOverwrite={() => {
          setOverrideDraftDialogOpen(false)
          const overrideData = {
            systemPrompt: systemPrompt || '',
            type: 'System',
            fromAgent: true,
            timestamp: Date.now(),
          }
          try {
            sessionStorage.setItem('promptOverrideData', JSON.stringify(overrideData))
          } catch (err) {
            // noop
          }
          const pid = currentRelation?.promptId
          if (pid) {
            window.open(`/dashboard/prompts/${pid}`, '_blank')
          }
        }}
      />

      <DeleteConfirmationDialog
        isOpen={unlinkConfirmOpen}
        onClose={() => setUnlinkConfirmOpen(false)}
        onConfirm={async () => {
          await handleUnlinkRelation()
          setUnlinkConfirmOpen(false)
        }}
        itemType="agent"
        itemName={agentName || agentId}
        title="解除关联"
        message={`确认解除提示词"${currentRelation?.promptName || ''}-${selectedVersion || currentRelation?.promptVersion || ''}"与智能体的关联？此操作无法撤销。`}
        confirmButtonText="确认"
      />

      <PromptEditor
        textAreaRef={textAreaRef}
        effectiveText={effectiveText}
        readonly={readonly}
        isLockedForCandidate={isLockedForCandidate}
        onChange={setSystemPrompt}
        placeholder={t('agents.agentEditor.systemPrompt.defineAgentPlaceholder')}
      />

      <UnifiedSnackbar snackbar={snackbar} onClose={() => setSnackbar(s => ({ ...s, open: false }))} />
    </div>
  )
}

export default SystemPromptTab
