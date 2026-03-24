/**
 * 报告展示面板组件
 *
 * @description
 * 展示报告内容，包含：
 * - ReportContentToolbar: 报告内容工具栏
 * - ReportView: 报告内容展示
 */

import React from 'react'
import type { Report } from '@/pages/Apps/types'
import { ReportContentToolbar } from './ReportContentToolbar'
import { ReportView } from './ReportView'

interface ReportPanelProps {
  /** 报告数据 */
  report: Report
  /** 自定义类名 */
  className?: string
}

/**
 * 报告展示面板组件
 */
const ReportPanel: React.FC<ReportPanelProps> = ({ report, className = '' }) => {
  return (
    <div className={`w-full h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50/30 ${className}`}>
      {/* 内容工具栏 */}
      <ReportContentToolbar report={report} />

      {/* 报告内容 */}
      <div className="flex-1 overflow-auto px-2 pb-2">
        <ReportView report={report} />
      </div>
    </div>
  )
}

ReportPanel.displayName = 'ReportPanel'

export { ReportPanel }
