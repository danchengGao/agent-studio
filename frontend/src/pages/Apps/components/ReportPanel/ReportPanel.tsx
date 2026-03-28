/**
 * 报告展示面板组件
 *
 * @description
 * 展示报告内容，包含：
 * - ReportContentToolbar: 报告内容工具栏
 * - ReportView: 报告内容展示
 * - ReportEditView: 报告编辑器（编辑模式）
 */

import { useState, useCallback, useMemo } from 'react'
import type { Report, ReportRewriteParams } from '@/pages/Apps/types'
import { ReportContentToolbar } from './ReportContentToolbar'
import { ReportView } from './ReportView'
import { ReportEditView } from './ReportEditView'
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
  /** 报告局部改写回调 */
  onReportRewrite?: (params: ReportRewriteParams) => Promise<void>
}

/**
 * 报告展示面板组件
 */
const ReportPanel: React.FC<ReportPanelProps> = ({
  report,
  reportMessageId,
  className = '',
  conversationId,
  onReportRewrite,
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const messagesMap = useConversationStore(state => state.messagesMap)

  // 判断是否为最终报告（子报告不能编辑）
  const isFinalReport = useMemo(() => {
    if (!reportMessageId) return true // 没有传入 messageId 时默认允许编辑
    const message = messagesMap.get(reportMessageId)
    return message ? isFinalReportMessage(message) : true
  }, [reportMessageId, messagesMap])

  const handleEnterEdit = useCallback(() => {
    if (!isFinalReport) return // 子报告不允许进入编辑
    setIsEditing(true)
  }, [isFinalReport])

  const handleExitEdit = useCallback(() => {
    setIsEditing(false)
  }, [])

  return (
    <div className={`w-full h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50/30 ${className}`}>
      {/* 内容工具栏 */}
      <ReportContentToolbar
        report={report}
        isEditing={isEditing}
        onEnterEdit={handleEnterEdit}
        onExitEdit={handleExitEdit}
        isFinalReport={isFinalReport}
      />

      {/* 报告内容 */}
      <div className="flex-1 overflow-auto px-2 pb-2">
        {isEditing ? (
          <ReportEditView
            report={report}
            conversationId={conversationId}
            onReportRewrite={onReportRewrite}
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
