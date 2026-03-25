/**
 * AI Button 组件
 *
 * @description
 * 显示 Sparkles 图标
 * 悬停时高亮对应的块
 */

import React from 'react'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export interface AIButtonProps {
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onClick?: () => void
}

/**
 * AI Button 组件
 */
export const AIButton: React.FC<AIButtonProps> = ({
  onMouseEnter,
  onMouseLeave,
  onClick,
}) => {
  const { t } = useTranslation()

  return (
    <button
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      className="
        group w-7 h-7 flex items-center justify-center rounded-lg
        transition-all duration-300 cursor-pointer outline-none
        pointer-events-auto relative z-10
        text-gray-400 hover:text-blue-500 hover:bg-gradient-to-r
        hover:from-blue-50 hover:to-purple-50 hover:shadow-md hover:shadow-blue-200/50
      "
      title={t('apps.report.aiRewrite') || 'AI改写'}
    >
      <Sparkles className="w-4 h-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
    </button>
  )
}
