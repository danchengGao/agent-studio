/**
 * ReportMarkdown 组件主入口
 */

import React from 'react'
import type { MarkdownProps } from './types'
import { MarkdownRenderer } from './MarkdownRenderer'

/**
 * ReportMarkdown 组件
 *
 * @description
 * 专用于报告展示的增强型 Markdown 组件
 * 支持：
 * - 标准 Markdown 语法（GFM）
 * - 数学公式（LaTeX）
 * - Mermaid 图表
 * - 引用链接和提示
 * - 溯源推理图谱链接
 * - 图片懒加载和错误处理
 */
export const ReportMarkdown: React.FC<MarkdownProps> = ({
  instanceId,
  className = '',
  content,
  citations,
  inferMessages,
  chartMessages,
}) => {
  return (
    <div
      className={`markdown-content prose max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 ${className}`}
    >
      <MarkdownRenderer
        instanceId={instanceId}
        content={content}
        citations={citations}
        inferMessages={inferMessages}
        chartMessages={chartMessages}
      />
    </div>
  )
}
