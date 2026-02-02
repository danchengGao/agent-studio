/**
 * Mermaid 图表组件
 * 支持多种图表类型，优化颜色和布局
 */

import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import mermaid from 'mermaid'
import type { MermaidCodeBlockProps } from '../types'
import { initMermaid } from './utils'
import { adjustViewBox, centerTimelineTitle, centerPieTitle, centerXyTitle, optimizePieColors, optimizeTimelineColors } from './utils'
import { handleXyChart } from './processors'

export const MermaidChart: React.FC<MermaidCodeBlockProps> = ({ code }) => {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const uniqueId = useRef(`mermaid-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`)

  // 渲染图表
  useEffect(() => {
    const renderDiagram = async () => {
      if (!ref.current) return

      try {
        initMermaid()

        // 先验证语法，防止 mermaid 将错误插入到 document.body
        try {
          await mermaid.parse(code)
        } catch (parseError) {
          // 语法验证失败，显示错误而不是让 mermaid 渲染错误SVG
          const errorMessage = parseError instanceof Error ? parseError.message : String(parseError)
          console.error('[MermaidChart] Parse error:', parseError)
          console.error('[MermaidChart] Code:', code.substring(0, 200))
          setError(`${t('apps.chart.syntaxError')}: ${errorMessage}`)
          return
        }

        // 语法验证通过，进行渲染
        const { svg } = await mermaid.render(uniqueId.current, code)

        if (ref.current) {
          ref.current.innerHTML = svg
          const svgElement = ref.current.querySelector('svg')
          if (!svgElement) return

          const chartType = svgElement.getAttribute('aria-roledescription')

          // 调整viewBox避免内容截断
          adjustViewBox(svgElement)

          // 处理不同类型图表的标题和样式
          if (chartType === 'timeline') {
            centerTimelineTitle(svgElement)
          }

          centerPieTitle(svgElement)
          centerXyTitle(svgElement)

          // 优化图表颜色
          optimizePieColors(svgElement)
          optimizeTimelineColors(svgElement)

          // 处理xychart-beta图表
          handleXyChart(svgElement, code)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        console.error('[MermaidChart] Rendering error:', err)
        console.error('[MermaidChart] Code:', code.substring(0, 200))
        setError(`${t('apps.chart.renderFailed')}: ${errorMessage}`)
      }
    }

    renderDiagram()
  }, [code])

  if (error) {
    return (
      <div className="border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 rounded-lg p-4 my-4">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">{t('apps.chart.mermaidError')}</p>
        <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-red-500">{t('apps.chart.viewCode')}</summary>
          <pre className="mt-2 text-xs p-2 bg-red-100 dark:bg-red-900/30 rounded overflow-auto max-h-40">
            {code}
          </pre>
        </details>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className="flex justify-center items-center my-6 overflow-x-auto p-4 rounded-lg bg-white dark:bg-slate-800"
      style={{ minHeight: '100px' }}
    />
  )
}