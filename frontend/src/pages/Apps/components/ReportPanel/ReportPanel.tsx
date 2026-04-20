/**
 * 报告展示面板组件
 *
 * @description
 * 展示报告内容，包含：
 * - ReportContentToolbar: 报告内容工具栏
 * - ReportView: 报告内容展示
 * - ReportEditView: 报告编辑器（编辑模式）
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import type { Report, ReportRewriteParams } from '@/pages/Apps/types'
import { parseMarkdownToCanonical } from '@/pages/Apps/components/ReportPanel/editor/canonical'
import {
  buildReportSyncRequest,
  createReportSyncScheduler,
  flushLatestReportDraft,
  type ReportSyncScheduler,
  type ReportSyncStatus,
} from '@/pages/Apps/components/ReportPanel/editor/sync'
import {
  deriveEditorSessionState,
  type RecoveryState,
  type RewriteOverlayState,
} from '@/pages/Apps/components/ReportPanel/editor/session'
import { ReportContentToolbar } from './ReportContentToolbar'
import { ReportView } from './ReportView'
import { ReportEditView, type ReportEditViewHandle } from './ReportEditView'
import { useConversationStore, isFinalReportMessage } from '@/stores/useConversationStore'

interface ReportPanelProps {
  /** 报告数据 */
  report: Report
  /** 报告消息 ID（用于判断是否为最终报告） */
  reportMessageId?: string
  /** 自定义类名 */
  className?: string
  /** 会话 ID（用于 AI 改写） */
  conversationId?: string
  /** 是否允许用户反馈优化/编辑 */
  feedbackOptimizationEnabled?: boolean
  /** 报告局部改写回调 */
  onReportRewrite?: (params: ReportRewriteParams) => Promise<void>
}

type ReportHistoryControls = {
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

/**
 * 报告展示面板组件
 */
const ReportPanel: React.FC<ReportPanelProps> = ({
  report,
  reportMessageId,
  className = '',
  conversationId,
  feedbackOptimizationEnabled = true,
  onReportRewrite,
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<ReportSyncStatus>('synced')
  const [historyControls, setHistoryControls] = useState<ReportHistoryControls>({
    canUndo: false,
    canRedo: false,
    undo: () => {},
    redo: () => {},
  })
  const [rewriteOverlayState, setRewriteOverlayState] = useState<RewriteOverlayState>('idle')
  const [recoveryState, setRecoveryState] = useState<RecoveryState>('idle')
  const syncSchedulerRef = useRef<ReportSyncScheduler | null>(null)
  const editViewRef = useRef<ReportEditViewHandle | null>(null)
  const messagesMap = useConversationStore(state => state.messagesMap)

  // 判断是否为最终报告（子报告不能编辑）
  const isFinalReport = useMemo(() => {
    if (!reportMessageId) return true // 没有传入 messageId 时默认允许编辑
    const message = messagesMap.get(reportMessageId)
    return message ? isFinalReportMessage(message) : true
  }, [reportMessageId, messagesMap])

  const canEditReport = isFinalReport && feedbackOptimizationEnabled
  const initialCanonicalDocument = useMemo(() => {
    if (report.canonicalDocument) {
      return report.canonicalDocument
    }

    return parseMarkdownToCanonical({
      rawMarkdown: report.rawContent || report.content || '',
      baseVersion: `report:${report.id}`,
      draftRevision: 0,
    })
  }, [report.canonicalDocument, report.content, report.id, report.rawContent])

  const sessionState = useMemo(
    () =>
      deriveEditorSessionState({
        baseVersion: initialCanonicalDocument.meta.baseVersion,
        canonical: initialCanonicalDocument,
        mode: isEditing ? 'edit' : 'browse',
        rewriteOverlayState,
        recoveryState,
        isFinalReport,
        editingEnabled: canEditReport,
      }),
    [
      canEditReport,
      initialCanonicalDocument,
      isEditing,
      isFinalReport,
      recoveryState,
      rewriteOverlayState,
    ],
  )

  const handleEnterEdit = useCallback(() => {
    if (!sessionState.canEnterEditMode) return
    setIsEditing(true)
  }, [sessionState.canEnterEditMode])

  const syncReportMarkdown = useCallback(
    (markdown: string) =>
      new Promise<void>((resolve, reject) => {
        if (!conversationId || !onReportRewrite) {
          reject(new Error('当前没有可用会话，无法同步报告。'))
          return
        }

        let settled = false
        const settleResolve = () => {
          if (settled) return
          settled = true
          resolve()
        }
        const settleReject = (error: string) => {
          if (settled) return
          settled = true
          reject(new Error(error))
        }

        void onReportRewrite({
          ...buildReportSyncRequest({
            markdown,
            conversationId,
          }),
          onEnd: settleResolve,
          onError: settleReject,
        }).catch((error) => {
          settleReject(error instanceof Error ? error.message : '报告同步失败')
        })
      }),
    [conversationId, onReportRewrite],
  )

  useEffect(() => {
    if (!isEditing) {
      syncSchedulerRef.current?.dispose()
      syncSchedulerRef.current = null
      setSyncStatus('synced')
      return
    }

    syncSchedulerRef.current?.dispose()
    syncSchedulerRef.current = createReportSyncScheduler({
      initialMarkdown: report.rawContent || report.content || '',
      debounceMs: 3000,
      sync: syncReportMarkdown,
      onStatusChange: setSyncStatus,
    })

    return () => {
      syncSchedulerRef.current?.dispose()
      syncSchedulerRef.current = null
    }
  }, [isEditing, report.content, report.rawContent, syncReportMarkdown])

  const handleDraftChange = useCallback((markdown: string) => {
    syncSchedulerRef.current?.markChanged(markdown)
  }, [])

  const handleManualSync = useCallback(async () => {
    try {
      await flushLatestReportDraft({
        scheduler: syncSchedulerRef.current,
        getCurrentMarkdown: editViewRef.current?.getCurrentMarkdown,
      })
    } catch (error) {
      console.error('[ReportPanel] 手动同步失败:', error)
    }
  }, [])

  const handleExitEdit = useCallback(async () => {
    if (!sessionState.canExitEditMode) return
    try {
      await flushLatestReportDraft({
        scheduler: syncSchedulerRef.current,
        getCurrentMarkdown: editViewRef.current?.getCurrentMarkdown,
      })
      setIsEditing(false)
    } catch (error) {
      console.error('[ReportPanel] 退出编辑前同步失败:', error)
    }
  }, [sessionState.canExitEditMode])

  const handleSessionStateChange = useCallback(
    (state: { rewriteOverlayState: RewriteOverlayState; recoveryState: RecoveryState }) => {
      setRewriteOverlayState(state.rewriteOverlayState)
      setRecoveryState(state.recoveryState)
    },
    [],
  )

  useEffect(() => {
    if (!canEditReport && isEditing) {
      setIsEditing(false)
    }
  }, [canEditReport, isEditing])

  return (
    <div className={`w-full h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50/30 ${className}`}>
      {/* 内容工具栏 */}
      <ReportContentToolbar
        report={report}
        isEditing={sessionState.mode === 'edit'}
        editingEnabled={canEditReport}
        onEnterEdit={handleEnterEdit}
        onExitEdit={handleExitEdit}
        isFinalReport={isFinalReport}
        mode={sessionState.mode}
        recoveryState={sessionState.recoveryState}
        canEnterEditMode={sessionState.canEnterEditMode}
        canExitEditMode={sessionState.canExitEditMode}
        syncStatus={syncStatus}
        onManualSync={handleManualSync}
        onUndo={historyControls.undo}
        onRedo={historyControls.redo}
        canUndo={historyControls.canUndo}
        canRedo={historyControls.canRedo}
      />

      {/* 报告内容 */}
      <div className="flex-1 overflow-auto px-2 pb-2">
        {sessionState.mode === 'edit' && canEditReport ? (
          <ReportEditView
            ref={editViewRef}
            report={report}
            conversationId={conversationId}
            onReportRewrite={onReportRewrite}
            onDraftChange={handleDraftChange}
            onHistoryStateChange={setHistoryControls}
            onSessionStateChange={handleSessionStateChange}
          />
        ) : (
          <ReportView report={report} />
        )}
      </div>
    </div>
  )
}

ReportPanel.displayName = 'ReportPanel'

export { ReportPanel }
