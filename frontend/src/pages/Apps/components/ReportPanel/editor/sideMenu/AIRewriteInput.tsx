/**
 * AI改写输入组件
 *
 * @description
 * AI改写面板的输入部分，包含标题、输入框和发送按钮
 */

import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import { Sparkles, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface AIRewriteInputProps {
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  /** 是否可以发送（有输入或有选中操作） */
  canSend?: boolean
  /** 禁用时的提示信息 */
  disabledHint?: string
}

export const AIRewriteInput = forwardRef<HTMLDivElement, AIRewriteInputProps>(({
  input,
  onInputChange,
  onSend,
  canSend = false,
  disabledHint,
}, ref) => {
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  // 同步 ref
  useImperativeHandle(ref, () => innerRef.current!)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  return (
    <div
      ref={innerRef}
      className="ai-rewrite-input bg-white rounded-lg border border-gray-200 shadow-lg"
    >
      <div className="flex items-center gap-2 p-3">
        {/* 标题 */}
        <div className="flex items-center gap-1.5 text-gray-700 shrink-0">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium">{t('apps.report.aiRewrite') || 'AI改写'}</span>
        </div>

        {/* 分隔线 */}
        <div className="w-px h-5 bg-gray-200" />

        {/* 输入框 */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={t('apps.report.howToRewrite') || '你想如何改写？'}
          className="flex-1 resize-none border-0 text-sm focus:outline-none placeholder:text-gray-400"
          rows={1}
        />

        {/* 发送按钮 */}
        <button
          onClick={onSend}
          disabled={!canSend}
          className={`
            shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium
            transition-all duration-200
            ${canSend
              ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:opacity-90 cursor-pointer'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          <Send className="w-3.5 h-3.5" />
          <span>{t('apps.report.send') || '发送'}</span>
        </button>
      </div>

      {/* 禁用提示 */}
      {disabledHint && !canSend && (
        <div className="px-3 pb-2 text-xs text-amber-600">
          {disabledHint}
        </div>
      )}
    </div>
  )
})
