/**
 * TopToolbar 顶部工具栏组件
 *
 * @description
 * 提供报告面板的顶部工具栏，包含视图切换和关闭功能
 * - 高度: 52px
 * - 背景: #FFFFFF
 * - 阴影: 0px 1px 8px 0px #1919190F
 *
 * @structure
 * ┌────────────────────────────────────────────────┐
 * │              [ViewToggle]              [X]      │
 * │                居中                  关闭(绝对) │
 * └────────────────────────────────────────────────┘
 */

import React from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ViewToggle, ViewType } from './ViewToggle'

export interface TopToolbarProps {
  /** 当前激活的视图 */
  activeView: ViewType
  /** 视图切换回调 */
  onViewChange: (view: ViewType) => void
  /** 关闭回调 */
  onClose: () => void
  /** 禁用的视图列表（传递给 ViewToggle） */
  disabledViews?: ViewType[]
}

/**
 * TopToolbar 顶部工具栏组件
 */
export const TopToolbar: React.FC<TopToolbarProps> = ({
  activeView,
  onViewChange,
  onClose,
  disabledViews = [],
}) => {
  const { t } = useTranslation()

  return (
    <div className="
      h-[52px]
      flex-shrink-0
      bg-white
      shadow-[0px_1px_8px_0px_#1919190F]
      px-2
      flex items-center justify-center
      relative
      z-10
    ">
      {/* 中间：ViewToggle 组件 */}
      <ViewToggle
        activeView={activeView}
        onViewChange={onViewChange}
        disabledViews={disabledViews}
      />

      {/* 右侧：关闭按钮（绝对定位） */}
      <button
        onClick={onClose}
        type="button"
        className="
          absolute right-2
          w-9 h-9
          rounded-lg
          flex items-center justify-center
          text-gray-500
          transition-colors
          duration-200
          hover:text-gray-700
          hover:bg-gray-100
          focus:outline-none
          focus:ring-2
          focus:ring-gray-400
          focus:ring-offset-2
        "
        aria-label={t('apps.report.closeReportPanel')}
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  )
}

TopToolbar.displayName = 'TopToolbar'

export default TopToolbar