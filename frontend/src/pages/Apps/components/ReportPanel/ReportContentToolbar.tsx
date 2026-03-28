/**
 * 报告内容工具栏组件
 *
 * @description
 * 包含复制和下载按钮
 * 仅在报告视图显示，高度 52px
 */

import React from 'react'
import { Copy, Check, Download, Loader2, Edit } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Root, Trigger } from '@radix-ui/react-dropdown-menu'
import type { Report } from '@/pages/Apps/types'
import { useClipboard } from '../ClipboardPanel/hooks'
import { useDownload } from '../DownloadPanel/hooks'
import { FormatMenu } from '../DownloadPanel/components/FormatMenu'
import { GRADIENT_BUTTON } from '../../constants/styles'

export interface ReportContentToolbarProps {
  /** 报告数据 */
  report: Report
  /** 是否处于编辑模式 */
  isEditing?: boolean
  /** 是否允许编辑 */
  editingEnabled?: boolean
  /** 进入编辑模式 */
  onEnterEdit?: () => void
  /** 退出编辑模式 */
  onExitEdit?: () => void
  /** 是否为最终报告（子报告不能编辑） */
  isFinalReport?: boolean
}

/**
 * 报告内容工具栏组件
 */
export const ReportContentToolbar: React.FC<ReportContentToolbarProps> = ({
  report,
  isEditing = false,
  editingEnabled = true,
  onEnterEdit,
  onExitEdit,
  isFinalReport = true,
}) => {
  const { t } = useTranslation()
  const clipboard = useClipboard()

  // 使用 useMemo 避免每次渲染重新计算
  const content = React.useMemo(
    () => report.content || '',
    [report.content]
  )

  const download = useDownload(content, report.title || 'report')

  const handleCopy = () => {
    clipboard.copy(content)
  }

  const handleEditClick = () => {
    if (isEditing && onExitEdit) {
      onExitEdit()
    } else if (!isEditing && onEnterEdit) {
      onEnterEdit()
    }
  }

  return (
    <div className="h-[52px] pl-6 pr-8 flex justify-end items-center gap-3 bg-gray-50">
      {/* 复制按钮 */}
      <button
        onClick={handleCopy}
        className="w-[21px] h-[21px] flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
        title={clipboard.copied ? t('apps.clipboard.copied') : t('apps.clipboard.copy')}
        aria-label={clipboard.copied ? t('apps.clipboard.copiedToClipboard') : t('apps.clipboard.copyReport')}
      >
        {clipboard.copied ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </button>

      {/* 下载按钮 */}
      <Root modal={false}>
        <Trigger asChild>
          <button
            className="w-[21px] h-[21px] flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={download.isDownloading ? t('apps.download.downloading') : t('apps.download.downloadReport')}
            aria-label={download.isDownloading ? t('apps.download.downloadingReport') : t('apps.download.downloadReport')}
            disabled={download.isDownloading}
          >
            {download.isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>
        </Trigger>

        {/* 复用 FormatMenu 组件 */}
        <FormatMenu
          onSelect={async (format) => download.selectFormat(format)}
          isDownloading={download.isDownloading}
        />
      </Root>

      {/* 编辑按钮 - 只有最终报告才显示 */}
      {editingEnabled && onEnterEdit && onExitEdit && isFinalReport && (
        <button
          onClick={handleEditClick}
          className="w-[88px] h-8 flex items-center justify-center gap-1.5 rounded-[4px] text-white text-sm font-medium transition-all duration-200 hover:opacity-90"
          style={{ background: GRADIENT_BUTTON }}
          aria-label={isEditing ? t('apps.report.exitEdit') : t('apps.report.edit')}
        >
          <Edit className="w-4 h-4" />
          <span>{isEditing ? t('apps.report.exitEdit') : t('apps.report.edit')}</span>
        </button>
      )}
    </div>
  )
}
