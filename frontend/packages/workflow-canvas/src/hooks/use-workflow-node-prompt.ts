/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { RelatedMemberService, MemberType, type RelatedMemberInfo, PromptService, FeedbackOptService } from '@test-agentstudio/api-client'
import { useAuthStore } from '@/stores/useAuthStore'
import { getDefaultSpaceId } from '@/utils/spaceUtils'
import { ENV_CONFIG } from '@/config/environment'
import {
  getVersionOptions,
  mergeCurrentVersionOption,
  fetchPromptText,
  compareVersions,
  incrementVersion,
  isVersionFormatValid,
} from '@/components/Agent/helper/promptHelpers'
import UnifiedSnackbar, { SnackbarMessage } from '@/Common/UnifiedSnackbar'
import { useWorkflowCanvasData } from './use-workflow-data'

export interface UseWorkflowNodePromptOptions {
  nodeId: string
  nodeName?: string
  systemPrompt: string
  onSystemPromptChange: (value: string) => void
  readonly?: boolean
  modelInfo?: any
}

export function useWorkflowNodePrompt({ nodeId, nodeName, systemPrompt, onSystemPromptChange, readonly = false, modelInfo }: UseWorkflowNodePromptOptions) {
  const { user } = useAuthStore()
  const { id: workflowId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const spaceId = searchParams.get('spaceId') || user?.spaceId || getDefaultSpaceId() || ENV_CONFIG.DEFAULT_SPACE_ID

  // 获取工作流数据以获取工作流名称
  const { canvasData, isLoading: canvasDataLoading } = useWorkflowCanvasData(workflowId, spaceId)
  const workflowName = useMemo(() => {
    // 如果数据还在加载中，返回空字符串（不立即回退到 workflowId）
    if (canvasDataLoading) {
      return ''
    }
    // 如果 canvasData 不存在，可能是 spaceId 为空或数据加载失败
    if (!canvasData) {
      // 如果 spaceId 为空，useWorkflowCanvasData 会返回 null，此时无法获取名称
      return ''
    }
    // 优先使用 name 字段（根据 WorkflowCanvasResponse 类型定义，name 字段应该存在）
    const name = canvasData.name
    if (name && typeof name === 'string' && name.trim()) {
      return name.trim()
    }
    // 如果没有 name，尝试其他可能的字段
    return canvasData.workflow_name || canvasData.display_name || ''
  }, [canvasData, canvasDataLoading])

  // 关联提示词弹窗开关
  const [associateDialogOpen, setAssociateDialogOpen] = useState(false)
  const handleOpenAssociateDialog = () => setAssociateDialogOpen(true)
  const handleCloseAssociateDialog = () => setAssociateDialogOpen(false)

  // 当前关联的提示词与版本信息
  const [currentRelation, setCurrentRelation] = useState<{ promptId: string; promptVersion: string; promptName: string } | null>(null)
  // 版本下拉相关状态
  const [versionLoading, setVersionLoading] = useState(false)
  const [versionOptions, setVersionOptions] = useState<{ id: string; version: string }[]>([])
  const [selectedVersion, setSelectedVersion] = useState<string>('')
  const safeSelectedVersion = useMemo(() => (versionOptions.some(v => v.version === selectedVersion) ? selectedVersion : ''), [selectedVersion, versionOptions])

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

  const userId = useMemo(() => user?.id || ENV_CONFIG.DEFAULT_USER_ID, [user])

  // 工作流节点信息 - id 格式为: 工作流id&节点id
  // 注意：优先使用 workflowName，只有在数据已加载完成且确实没有名称时才回退
  const nodeInfoMemo = useMemo(() => {
    let finalName = workflowName

    // 如果 workflowName 为空
    if (!finalName) {
      // 如果数据还在加载中，暂时使用 workflowId（会在数据加载完成后更新）
      if (canvasDataLoading) {
        finalName = workflowId || nodeId
      }
      // 如果数据已加载完成但 canvasData 为 null（可能是 spaceId 问题）
      else if (!canvasData) {
        finalName = workflowId || nodeId
      }
      // 如果数据已加载完成且有 canvasData，但 name 字段为空（数据问题）
      else {
        finalName = workflowId || nodeId
      }
    }

    return {
      id: workflowId && nodeId ? `${workflowId}&${nodeId}` : nodeId,
      version: 'draft',
      name: finalName,
      type: MemberType.WORKFLOW,
    }
  }, [workflowId, nodeId, workflowName, canvasDataLoading, canvasData])

  // 调试：打印 canvasData 信息（开发环境）- 必须在 nodeInfoMemo 定义之后
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[useWorkflowNodePrompt] Debug info:', {
        workflowId,
        spaceId,
        canvasDataLoading,
        canvasData: canvasData
          ? {
              name: canvasData.name,
              workflow_name: canvasData.workflow_name,
              display_name: canvasData.display_name,
              workflow_id: canvasData.workflow_id,
              keys: Object.keys(canvasData),
            }
          : null,
        workflowName,
        nodeInfoMemo,
      })
    }
  }, [workflowId, spaceId, canvasData, canvasDataLoading, workflowName, nodeInfoMemo])

  const makePromptInfo = (id: string, version: string, name: string) => ({
    id,
    version,
    name,
    type: MemberType.PROMPT,
  })

  const fetchCurrentRelation = async () => {
    if (!nodeId) return
    try {
      const resp: any = await RelatedMemberService.getPromptRelations(spaceId, nodeInfoMemo, true)
      const list = resp?.data || []
      if (Array.isArray(list) && list.length > 0) {
        const r = list[0]
        setCurrentRelation({ promptId: String(r.prompt_id), promptVersion: String(r.prompt_version || 'draft'), promptName: r.prompt_name || '' })
      } else {
        setCurrentRelation(null)
      }
    } catch (e) {
      setCurrentRelation(null)
    }
  }

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

  const loadPromptContentByVersion = async (promptId: string, commitVersion: string) => {
    try {
      const text = await fetchPromptText(promptId, commitVersion, spaceId, { includeDraft: true, withDefaultConfig: false })
      if (text) {
        onSystemPromptChange(text)
      }
    } catch (e) {
      // 获取失败不阻断
    }
  }

  useEffect(() => {
    fetchCurrentRelation()
  }, [nodeId])

  useEffect(() => {
    if (!associateDialogOpen) {
      fetchCurrentRelation()
    }
  }, [associateDialogOpen])

  useEffect(() => {
    setSelectedVersion(currentRelation?.promptVersion || '')
    loadVersionListForCurrentRelation()
  }, [currentRelation?.promptId])

  const handleUnlinkRelation = async () => {
    try {
      await RelatedMemberService.deletePromptRelation(spaceId, nodeInfoMemo)
      setCurrentRelation(null)
    } catch (e) {
      // 解关联失败不阻断
    }
  }

  const handleVersionSelectChange = async (nextVersion: string) => {
    setSelectedVersion(nextVersion)
    if (!currentRelation) return
    try {
      const promptInfo = makePromptInfo(currentRelation.promptId, nextVersion, currentRelation.promptName || '')
      await RelatedMemberService.registerPromptRelation(spaceId, promptInfo, nodeInfoMemo)
      setCurrentRelation(prev => (prev ? { ...prev, promptVersion: nextVersion } : prev))
      await loadPromptContentByVersion(currentRelation.promptId, nextVersion)
    } catch (e) {
      // 更新失败不阻断主流程
    }
  }

  const handleRelationUpdated = (info: { promptId: string; promptName: string; promptVersion: string; promptContent: string }) => {
    setCurrentRelation({ promptId: info.promptId, promptName: info.promptName, promptVersion: info.promptVersion })
    setSelectedVersion(info.promptVersion)
    onSystemPromptChange(info.promptContent)
  }

  const handleReplacePromptText = (text: string) => {
    onSystemPromptChange(text)
    setAssociateDialogOpen(false)
  }

  const handleInsertPromptText = (text: string) => {
    if (readonly) return
    const existing = systemPrompt || ''
    const combined = existing ? `${existing}\n${text}` : text
    onSystemPromptChange(combined)
    setAssociateDialogOpen(false)
  }

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

    const quickOptimizeRequest = {
      modelInfo: modelInfo || {
        id: 0,
        model: '',
        model_from: 'db',
        headers: {
          temperature: 0.7,
          max_tokens: 4000,
          top_p: 0.9,
        },
      },
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
    } catch (e: any) {
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
    onSystemPromptChange(text)
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

  const handleOpenSaveDialog = async () => {
    const content = (systemPrompt || '').trim()
    if (!content) {
      setSnackbar({ open: true, severity: 'error', message: '系统提示词为空，无法保存。' })
      return
    }

    try {
      const resp: any = await RelatedMemberService.getPromptRelations(spaceId, nodeInfoMemo, true)
      const list = resp?.data || []
      if (Array.isArray(list) && list.length > 0) {
        const r = list[0]
        const pid = String(r.prompt_id)
        const detail = await PromptService.getPromptDetail(pid, {
          workspaceId: spaceId,
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
        const defaultKey = nodeId ? `workflow_${nodeId}_${Date.now()}` : `workflow_${Date.now()}`
        const defaultName = nodeName || '未命名提示词'
        setExistingPromptInfo(null)
        setSaveForm({
          promptKey: defaultKey,
          promptName: defaultName,
          promptVersion: ENV_CONFIG.DEFAULT_PROMPT_VERSION,
          promptDesc: '',
        })
      }
      setSaveDialogOpen(true)
    } catch (e: any) {
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

      if (!targetPromptId) {
        const createResp = await PromptService.createPrompt({
          updated_by: userId,
          prompt_key: promptKey,
          prompt_name: promptName,
          prompt_description: promptDesc || '',
          workspace_id: spaceId,
        })
        if (createResp.code !== 0 || !createResp.prompt_id) {
          throw new Error('创建提示词失败')
        }
        targetPromptId = String(createResp.prompt_id)
      }

      await PromptService.saveDraft(targetPromptId, userId, spaceId, {
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
        commit_description: promptDesc || `工作流节点 ${nodeName || nodeId} 保存的版本`,
      })

      const promptInfo: RelatedMemberInfo = {
        id: targetPromptId,
        version: promptVersion,
        name: promptName,
        type: MemberType.PROMPT,
      }
      await RelatedMemberService.registerPromptRelation(spaceId, promptInfo, nodeInfoMemo)

      setCurrentRelation({ promptId: targetPromptId, promptVersion, promptName })
      setSelectedVersion(promptVersion)
      await loadVersionListForCurrentRelation()
      await loadPromptContentByVersion(targetPromptId, promptVersion)

      setSnackbar({ open: true, severity: 'success', message: '提示词已保存并提交版本。' })
      setSaveDialogOpen(false)
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : '保存提示词失败，请稍后重试。'
      setSnackbar({ open: true, severity: 'error', message: msg })
    } finally {
      setSaving(false)
    }
  }

  const effectiveText = useMemo(() => displayOverride ?? systemPrompt, [displayOverride, systemPrompt])
  const isLockedForCandidate = useMemo(() => isGenerating || !!candidatePrompt, [isGenerating, candidatePrompt])

  return {
    // 状态
    isGenerating,
    candidatePrompt,
    saving,
    currentRelation,
    safeSelectedVersion,
    selectedVersion,
    latestVersion,
    versionOptions,
    versionLoading,
    effectiveText,
    isLockedForCandidate,
    associateDialogOpen,
    saveDialogOpen,
    overrideDraftDialogOpen,
    unlinkConfirmOpen,
    saveForm,
    existingPromptInfo,
    snackbar,
    // 方法
    handleOpenAssociateDialog,
    handleCloseAssociateDialog,
    handleReplacePromptText,
    handleInsertPromptText,
    handleRelationUpdated,
    handleQuickOptimizeGenerate,
    handleAdoptCandidate,
    handleCancelCandidate,
    handleOpenSaveDialog,
    handleConfirmSave,
    handleVersionSelectChange,
    handleUnlinkRelation,
    setSaveDialogOpen,
    setOverrideDraftDialogOpen,
    setUnlinkConfirmOpen,
    setSaveForm,
    setSnackbar,
    nodeInfo: nodeInfoMemo,
    workspaceId: spaceId,
  }
}
