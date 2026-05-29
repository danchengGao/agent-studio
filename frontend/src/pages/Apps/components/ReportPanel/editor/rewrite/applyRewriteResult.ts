import { parseMarkdownToCanonical } from '../canonical'
import type { CanonicalDocument } from '../canonical'

const validateCanonicalConsistency = (document: CanonicalDocument) => {
  const hasMeaningfulMarkdown = document.rawMarkdown.trim().length > 0

  if (hasMeaningfulMarkdown && document.blocks.length === 0) {
    throw new Error('canonical rebuild failed: markdown did not produce supported blocks')
  }

  for (const block of document.blocks) {
    const nextRawSlice = document.rawMarkdown.slice(block.source.rawStart, block.source.rawEnd)
    if (nextRawSlice !== block.source.rawSlice) {
      throw new Error(`canonical rebuild failed: block ${block.id} source range is inconsistent`)
    }
  }
}

export function applyRewriteResult(params: {
  previous: CanonicalDocument
  nextRawMarkdown: string
  nextBaseVersion: string
}): CanonicalDocument {
  const nextDocument = parseMarkdownToCanonical({
    rawMarkdown: params.nextRawMarkdown,
    baseVersion: params.nextBaseVersion,
    draftRevision: params.previous.meta.draftRevision,
    previous: params.previous,
  })

  validateCanonicalConsistency(nextDocument)
  return nextDocument
}
