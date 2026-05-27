import Tooltip from '@mui/material/Tooltip'
import type { ReactElement } from 'react'

/** 明显快于浏览器原生 title（通常 ~0.5–1s） */
const ENTER_MS = 150

type Props = {
  title: string
  children: ReactElement
  /** 错误信息等长文案：浮层可滚动、自动换行 */
  longContent?: boolean
}

/**
 * 知识库编辑表格内单元格悬停全文：名称列与错误信息列共用，延迟一致。
 */
export function KnowledgeBaseEditorCellTooltip({ title, children, longContent }: Props) {
  return (
    <Tooltip
      title={title}
      placement="top"
      enterDelay={ENTER_MS}
      enterNextDelay={ENTER_MS}
      slotProps={{
        tooltip: {
          sx: {
            maxWidth: 'min(90vw, 32rem)',
            fontSize: '0.8125rem',
            lineHeight: 1.45,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            ...(longContent
              ? {
                  maxHeight: 'min(42vh, 320px)',
                  overflow: 'auto',
                }
              : {}),
          },
        },
      }}
    >
      {children}
    </Tooltip>
  )
}
