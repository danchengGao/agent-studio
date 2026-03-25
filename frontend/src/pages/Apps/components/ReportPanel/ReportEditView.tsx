/**
 * 报告编辑视图组件
 *
 * @description
 * 使用 BlockNote 提供 Notion 风格的块级编辑体验
 */

import React, { useEffect, useState, useRef, useMemo } from 'react'
import { FileText, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Report, ReportRewriteParams } from '@/pages/Apps/types'
import { BlockNoteEditor } from './BlockNoteEditor'
import { useReducedMotion } from '../shared/hooks/usePreferences'
import { LOADING_DELAY, LOADING_TIMEOUT } from './constants'
import { preprocessMarkdown } from '@/utils/markdownCleaner'

type LoadingState = 'loading' | 'loaded' | 'empty' | 'timeout'

export interface ReportEditViewProps {
  report: Report
  className?: string
  /** 会话 ID（用于 AI 改写） */
  conversationId?: string
  /** 报告局部改写回调 */
  onReportRewrite?: (params: ReportRewriteParams) => Promise<void>
}

export const ReportEditView: React.FC<ReportEditViewProps> = ({
  report,
  className = '',
  conversationId,
  onReportRewrite,
}) => {
  const { t } = useTranslation()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()

  const [loadingState, setLoadingState] = useState<LoadingState>('loading')
  const loadingStateRef = useRef<LoadingState>('loading')

  const rawContent = report.rawContent || report.content || ''

  const { cleaned: cleanedContent, offsetMap, blockOffsets } = useMemo(() => {
    return preprocessMarkdown(rawContent)
  }, [rawContent])

  useEffect(() => {
    setLoadingState('loading')
    loadingStateRef.current = 'loading'

    const hasContent = cleanedContent?.trim()

    const normalTimer = setTimeout(() => {
      if (hasContent) {
        setLoadingState('loaded')
        loadingStateRef.current = 'loaded'
      } else {
        setLoadingState('empty')
        loadingStateRef.current = 'empty'
      }
    }, LOADING_DELAY)

    const timeoutTimer = setTimeout(() => {
      if (loadingStateRef.current === 'loading') {
        setLoadingState('timeout')
        loadingStateRef.current = 'timeout'
      }
    }, LOADING_TIMEOUT)

    return () => {
      clearTimeout(normalTimer)
      clearTimeout(timeoutTimer)
    }
  }, [report.id, cleanedContent])

  return (
    <div className={`relative h-full flex flex-col ${className}`}>
      <div
        ref={scrollContainerRef}
        className={`flex-1 overflow-auto ${prefersReducedMotion ? '' : 'scroll-smooth'} group`}
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'transparent transparent',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.scrollbarColor = '#6b7280 transparent'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.scrollbarColor = 'transparent transparent'
        }}
      >
        <article
          className="max-w-10xl mx-auto min-h-[200px] select-text cursor-text p-4"
          aria-label={`${t('apps.report.reportLabel')}: ${report.title || t('apps.report.unnamedReport')}`}
          aria-busy={loadingState === 'loading'}
          role="article"
        >
          {loadingState === 'loading' ? (
            <div className="animate-pulse space-y-3" aria-hidden="true">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-11/12"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-4/5"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          ) : loadingState === 'empty' ? (
            <div className="flex flex-col items-center justify-center py-16">
              <FileText className="w-12 h-12 text-gray-300 mb-4" />
              <p className="text-gray-500 text-sm">{t('apps.report.contentEmpty')}</p>
            </div>
          ) : loadingState === 'timeout' ? (
            <div className="flex flex-col items-center justify-center py-16">
              <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
              <p className="text-gray-700 font-medium mb-1">{t('apps.report.loadingTimeout')}</p>
              <p className="text-gray-500 text-sm text-center">{t('apps.report.timeoutMessage')}</p>
            </div>
          ) : (
            <BlockNoteEditor
              content={cleanedContent}
              rawContent={rawContent}
              offsetMap={offsetMap}
              blockOffsets={blockOffsets}
              readonly={false}
              scrollContainerRef={scrollContainerRef}
              conversationId={conversationId}
              onReportRewrite={onReportRewrite}
            />
          )}
        </article>
      </div>
    </div>
  )
}
