/**
 * AI rewrite entry button shown in the BlockNote side menu.
 *
 * The button prevents default on mousedown so the current text selection stays
 * alive when the user clicks the AI action.
 */

import React from 'react'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export interface AIButtonProps {
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onClick?: () => void
}

export const AIButton: React.FC<AIButtonProps> = ({
  onMouseEnter,
  onMouseLeave,
  onClick,
}) => {
  const { t } = useTranslation()

  return (
    <button
      onMouseDown={(event) => {
        event.preventDefault()
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      className="
        group relative z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg
        text-gray-400 outline-none transition-all duration-300
        hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50
        hover:text-blue-500 hover:shadow-md hover:shadow-blue-200/50
      "
      title={t('apps.report.aiRewrite') || 'AI改写'}
      type="button"
    >
      <Sparkles className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
    </button>
  )
}
