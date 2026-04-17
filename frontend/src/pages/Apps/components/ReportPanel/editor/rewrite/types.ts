import type { ReportRewriteAction, ReportRewriteParams } from '../../../pages/Apps/types'

export type SelectionSnapshot = {
  text: string
  startBlockId: string | null
  endBlockId: string | null
  startOffsetInStartBlock: number
  endOffsetInEndBlock: number
}

export type RewriteTargetError =
  | { error: 'cross_block' }
  | { error: 'non_paragraph' }
  | { error: 'empty_selection' }
  | { error: 'partial_inline_selection' }

export interface ParagraphRewriteTarget {
  blockId: string
  rawMarkdown: string
  rawStart: number
  rawEnd: number
  visibleSelection: { start: number; end: number }
  rawSelection: { start: number; end: number }
  documentRawMarkdown: string
}

export interface BuildRewriteRequestInput {
  target: ParagraphRewriteTarget
  action: ReportRewriteAction
  conversationId: string
  userInstruction?: string
}

export type CanonicalRewriteRequest = ReportRewriteParams
