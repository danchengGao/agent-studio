import { utf16IndexToCodePointIndex } from '@/utils/textOffset'
import type { CanonicalRewriteRequest, BuildRewriteRequestInput } from './types'

export function buildRewriteRequest(input: BuildRewriteRequestInput): CanonicalRewriteRequest {
  const { target, action, conversationId, userInstruction, rewrite_scope } = input
  const selectedText = target.documentRawMarkdown.slice(
    target.rawSelection.start,
    target.rawSelection.end,
  )

  return {
    action,
    conversationId,
    selectedText,
    userInstruction,
    rewrite_scope,
    blockId: target.blockId,
    startOffset: utf16IndexToCodePointIndex(target.documentRawMarkdown, target.rawSelection.start),
    endOffset: utf16IndexToCodePointIndex(target.documentRawMarkdown, target.rawSelection.end),
  }
}
