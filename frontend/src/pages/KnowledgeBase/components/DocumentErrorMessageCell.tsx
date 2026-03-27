import React from 'react'
import Tooltip from '@mui/material/Tooltip'

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
 * 知识库编辑页「错误信息」列：列表内短预览，悬停浮层展示全文（可滚动）。
 * 文档型知识库与 weblink 知识库共用同一表格与此组件。
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
    <Tooltip
      title={text}
      placement="top-start"
      arrow
      enterDelay={150}
      slotProps={{
        tooltip: {
          sx: {
            maxWidth: 'min(90vw, 560px)',
            maxHeight: 'min(50vh, 420px)',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: '0.8125rem',
            lineHeight: 1.45,
          },
        },
        popper: {
          sx: { zIndex: (theme) => theme.zIndex.tooltip },
        },
      }}
    >
      <span
        className="text-red-600 cursor-help break-words inline-block align-top"
        style={{
          maxWidth: '400px',
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
        }}
      >
        {preview}
      </span>
    </Tooltip>
  )
}
