/**
 * ViewToggle 视图切换组件
 *
 * @description
 * 用于在"思维链"和"报告"视图之间切换的 Tab 组件
 * - Tab 宽度: 60px, 高度: 28px, 圆角: 4px
 * - 容器背景: bg-gray-100, 圆角: 8px, 内边距: 4px
 * - 选中态: 背景渐变 from-blue-500 to-indigo-600, 白色文字
 * - 未选中态: 灰色文字, hover 变深
 *
 * @accessibility
 * - 使用 ARIA tab 模式
 * - 支持键盘导航 (箭头键、Enter、Space)
 */

import React, { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

/** 视图类型 */
export type ViewType = 'thinking' | 'report'

/** ViewToggle 组件 Props */
export interface ViewToggleProps {
  /** 当前激活的视图 */
  activeView: ViewType
  /** 视图切换回调 */
  onViewChange: (view: ViewType) => void
  /** 禁用的视图列表（按钮灰色不可点击） */
  disabledViews?: ViewType[]
}

/** Tab 配置 */
interface TabConfig {
  id: ViewType
  labelKey: string
}

/** Tab 配置列表 */
const TABS: TabConfig[] = [
  {
    id: 'thinking',
    labelKey: 'apps.report.viewToggle.thinkingChain',
  },
  {
    id: 'report',
    labelKey: 'apps.report.viewToggle.reportView',
  },
]

/**
 * ViewToggle 视图切换组件
 */
export const ViewToggle: React.FC<ViewToggleProps> = ({
  activeView,
  onViewChange,
  disabledViews = [],
}) => {
  const { t } = useTranslation()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  /**
   * 检查视图是否被禁用
   */
  const isDisabled = useCallback(
    (view: ViewType) => disabledViews.includes(view),
    [disabledViews]
  )

  /**
   * 处理 Tab 点击
   */
  const handleTabClick = useCallback(
    (view: ViewType) => {
      if (isDisabled(view)) return
      onViewChange(view)
    },
    [onViewChange, isDisabled]
  )

  /**
   * 处理键盘导航
   * - 左右箭头键: 在 Tab 之间切换焦点
   * - Enter/Space: 激活当前 Tab（未禁用时）
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, currentIndex: number) => {
      let newIndex = currentIndex

      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault()
          newIndex = currentIndex === 0 ? TABS.length - 1 : currentIndex - 1
          break
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault()
          newIndex = currentIndex === TABS.length - 1 ? 0 : currentIndex + 1
          break
        case 'Enter':
        case ' ':
          event.preventDefault()
          // 禁用状态下不触发切换
          if (!isDisabled(TABS[currentIndex].id)) {
            onViewChange(TABS[currentIndex].id)
          }
          return
        case 'Home':
          event.preventDefault()
          newIndex = 0
          break
        case 'End':
          event.preventDefault()
          newIndex = TABS.length - 1
          break
        default:
          return
      }

      // 移动焦点到新的 Tab
      tabRefs.current[newIndex]?.focus()
    },
    [onViewChange, isDisabled]
  )

  return (
    <div
      className="inline-flex items-center bg-gray-100 rounded-lg p-1"
      role="tablist"
      aria-label={t('apps.report.viewToggle.ariaLabel')}
    >
      {TABS.map((tab, index) => {
        const isActive = activeView === tab.id
        const disabled = isDisabled(tab.id)
        const label = t(tab.labelKey)

        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[index] = el
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`${tab.id}-panel`}
            aria-disabled={disabled}
            tabIndex={isActive ? 0 : -1}
            disabled={disabled}
            onClick={() => handleTabClick(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={clsx(
              'inline-flex items-center justify-center',
              'w-[60px] h-7 rounded-[4px] text-sm font-medium whitespace-nowrap',
              'transition-all duration-200 ease-in-out',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1',
              disabled && 'opacity-50 cursor-not-allowed',
              !disabled && isActive
                ? 'bg-white text-gray-900 shadow-sm'
                : !disabled && 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

ViewToggle.displayName = 'ViewToggle'

export default ViewToggle
