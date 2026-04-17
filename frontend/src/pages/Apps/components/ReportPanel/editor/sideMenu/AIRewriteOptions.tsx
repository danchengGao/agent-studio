/**
 * AI改写选项组件
 *
 * @description
 * 提供快捷改写选项：润色、扩写、缩写
 * 绝对定位，基于目标元素位置显示
 */

import React, { useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, Expand, Shrink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { OPTIONS_HEIGHT, OPTIONS_OFFSET, REWRITE_ACTIONS } from '../../constants'
import type { ReportRewriteAction } from '@/pages/Apps/types'

interface AIRewriteOptionsProps {
  /** 当前选中的操作（用于高亮显示） */
  selectedAction: ReportRewriteAction | null
  /** 选中操作 */
  onSelect: (action: ReportRewriteAction) => void
  /** 目标元素，选项将显示在其下方 */
  targetElement: HTMLElement | null
}

// 图标映射
const ICON_MAP: Record<string, React.ReactNode> = {
  Sparkles: <Sparkles className="w-4 h-4" />,
  Expand: <Expand className="w-4 h-4" />,
  Shrink: <Shrink className="w-4 h-4" />,
}

export const AIRewriteOptions: React.FC<AIRewriteOptionsProps> = ({
  selectedAction,
  onSelect,
  targetElement,
}) => {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = React.useState({ top: 0, left: 0 })

  // 计算并更新位置（初始 + 滚动/resize）
  useEffect(() => {
    if (!targetElement) return

    const updatePosition = () => {
      const rect = targetElement.getBoundingClientRect()
      const newTop = rect.bottom + window.scrollY + OPTIONS_OFFSET
      const newLeft = rect.left + window.scrollX

      // 仅在位置变化时更新状态
      setCoords(prev => {
        if (prev.top !== newTop || prev.left !== newLeft) {
          return { top: newTop, left: newLeft }
        }
        return prev
      })
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [targetElement])

  if (!targetElement) return null

  return createPortal(
    <div
      ref={containerRef}
      className="ai-rewrite-options fixed z-[1030] flex flex-col gap-1 p-2 bg-white rounded-lg border border-gray-200 shadow-lg"
      style={{
        top: coords.top,
        left: coords.left,
        width: 200,
      }}
    >
      {REWRITE_ACTIONS.map((btn) => (
        <button
          key={btn.action}
          onClick={() => onSelect(btn.action)}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-lg text-left
            transition-all duration-150 cursor-pointer
            border border-transparent
            ${selectedAction === btn.action
              ? 'bg-blue-50 text-blue-600 border-blue-200'
              : 'hover:bg-blue-50 hover:text-blue-600 text-gray-600 hover:border-blue-200'
            }
          `}
        >
          <span className={selectedAction === btn.action ? 'text-blue-500' : 'text-gray-400'}>
            {ICON_MAP[btn.icon]}
          </span>
          <span className="text-sm font-medium">{t(btn.labelKey) || btn.defaultLabel}</span>
        </button>
      ))}
    </div>,
    document.body
  )
}

// 导出高度供其他组件使用
export { OPTIONS_HEIGHT }
