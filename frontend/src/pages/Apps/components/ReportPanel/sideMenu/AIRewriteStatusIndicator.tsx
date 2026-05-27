/**
 * AI 改写状态指示器组件
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Brain, PenLine, AlertCircle } from 'lucide-react'
import type { RewriteStatus } from '@/pages/Apps/types'

// 状态配置映射
const STATUS_CONFIG = {
  thinking: {
    icon: Brain,
    text: '思考中',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text_color: 'text-blue-700',
    dot: 'bg-blue-500',
    icon_color: 'text-blue-500',
    animate: true,
  },
  writing: {
    icon: PenLine,
    text: '撰写中',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text_color: 'text-emerald-700',
    dot: 'bg-emerald-500',
    icon_color: 'text-emerald-500',
    animate: false,
  },
  error: {
    icon: AlertCircle,
    text: '',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text_color: 'text-red-700',
    dot: 'bg-red-500',
    icon_color: 'text-red-500',
    animate: false,
  },
} as const

export interface AIRewriteStatusIndicatorProps {
  status: RewriteStatus
  visible: boolean
  errorMessage?: string
}

export const AIRewriteStatusIndicator: React.FC<AIRewriteStatusIndicatorProps> = ({
  status,
  visible,
  errorMessage,
}) => {
  const [isExiting, setIsExiting] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    if (visible && status !== 'idle') {
      setIsExiting(false)
      setShouldRender(true)
    } else if (!visible || status === 'idle') {
      setIsExiting(true)
      const timer = setTimeout(() => {
        setShouldRender(false)
        setIsExiting(false)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [visible, status])

  if (!shouldRender || status === 'idle') return null

  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
  if (!config) return null

  const Icon = config.icon
  const displayText = status === 'error' ? (errorMessage || '改写失败') : config.text

  return createPortal(
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999]"
      style={{
        animation: isExiting
          ? 'status-slide-up 0.3s ease-out forwards'
          : 'status-slide-down 0.3s ease-out forwards',
      }}
    >
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg border ${config.bg} ${config.border} ${config.text_color}`}
      >
        <span
          className="flex items-center justify-center"
          style={{ animation: config.animate ? 'thinking-pulse 1.5s ease-in-out infinite' : undefined }}
        >
          <Icon className={`w-4 h-4 ${config.icon_color}`} />
        </span>
        <span className="font-medium text-sm whitespace-nowrap">{displayText}</span>
        {status !== 'error' && (
          <div className="flex items-center gap-0.5 ml-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`w-1 h-1 rounded-full ${config.dot}`}
                style={{
                  animation: 'writing-wave 1s ease-in-out infinite',
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
