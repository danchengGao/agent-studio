import React from 'react'
import { KnowledgeBaseEditorCellTooltip } from './KnowledgeBaseEditorCellTooltip'

const PREVIEW_MAX_LEN = 100

/** 文档 / 网页链接状态项上可能出现的错误字段 */
export type StatusErrorFields = {
  error_msg?: string
  error_message?: string
  message?: string
}

/** 文档状态里的错误文案（文档库与 weblink 知识库共用状态结构） */
export function getStatusErrorMessage(item?: StatusErrorFields | null): string | undefined {
  if (!item) return undefined
  const raw = item.error_msg ?? item.error_message ?? item.message
  const s = typeof raw === 'string' ? raw.trim() : ''
  return s || undefined
}

/**
 * 知识库编辑页「错误信息」列：列表内短预览；悬停展示全文（与名称列同一套 Tooltip，短延迟）。
 */
export const DocumentErrorMessageCell: React.FC<{
  message?: string | null
}> = ({ message }) => {
  const text = (message ?? '').trim()
  if (!text) {
    return <span className="text-gray-400">-</span>
  }

  const preview = text.length > PREVIEW_MAX_LEN ? `${text.slice(0, PREVIEW_MAX_LEN)}...` : text

  return (
    <KnowledgeBaseEditorCellTooltip title={text} longContent>
      <span className="text-red-600 block w-full min-w-0 max-w-full break-words text-left align-top [overflow-wrap:anywhere]">
        {preview}
      </span>
    </KnowledgeBaseEditorCellTooltip>
  )
}
