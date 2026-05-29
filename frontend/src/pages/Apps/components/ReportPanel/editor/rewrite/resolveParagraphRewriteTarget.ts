import type { ParagraphBlock, CanonicalDocument, CanonicalInline } from '../canonical'
import type { ParagraphRewriteTarget, RewriteTargetError, SelectionSnapshot } from './types'

const isFormattedInline = (inline: CanonicalInline) => inline.kind !== 'text'

const buildInlineBoundaryMap = (inline: CanonicalInline): number[] | null => {
  if (!inline.text) {
    return [0]
  }

  if (inline.kind === 'text') {
    return Array.from({ length: inline.text.length + 1 }, (_, index) => index)
  }

  const matchedRawIndices: number[] = []
  let rawCursor = 0

  for (const char of inline.text) {
    const nextRawIndex = inline.source.rawSlice.indexOf(char, rawCursor)
    if (nextRawIndex < 0) {
      return null
    }

    matchedRawIndices.push(nextRawIndex)
    rawCursor = nextRawIndex + 1
  }

  const boundaryMap = new Array<number>(inline.text.length + 1)
  boundaryMap[0] = 0

  for (let index = 1; index < inline.text.length; index += 1) {
    boundaryMap[index] = matchedRawIndices[index]
  }

  boundaryMap[inline.text.length] = inline.source.rawSlice.length
  return boundaryMap
}

const buildVisibleToRawBoundaryMap = (paragraph: ParagraphBlock): number[] | null => {
  const boundaryMap = new Array<number>(paragraph.visibleText.length + 1).fill(-1)

  for (const inline of paragraph.inlines) {
    const inlineBoundaryMap = buildInlineBoundaryMap(inline)
    if (!inlineBoundaryMap) {
      return null
    }

    for (let i = 0; i <= inline.text.length; i += 1) {
      const visibleBoundary = inline.visibleStart + i
      if (visibleBoundary < 0 || visibleBoundary > paragraph.visibleText.length) {
        continue
      }

      boundaryMap[visibleBoundary] = inline.source.rawStart + inlineBoundaryMap[i]
    }
  }

  if (paragraph.visibleText.length === 0) {
    boundaryMap[0] = paragraph.source.rawStart
    return boundaryMap
  }

  if (boundaryMap[0] === -1) {
    boundaryMap[0] = paragraph.inlines[0]?.source.rawStart ?? paragraph.source.rawStart
  }

  for (let i = 1; i < boundaryMap.length; i += 1) {
    if (boundaryMap[i] === -1) {
      boundaryMap[i] = boundaryMap[i - 1]
    }
  }

  return boundaryMap
}

const normalizeVisibleSelectionForRewrite = (params: {
  paragraph: ParagraphBlock
  visibleStart: number
  visibleEnd: number
}):
  | { visibleStart: number; visibleEnd: number }
  | RewriteTargetError => {
  const { paragraph, visibleStart, visibleEnd } = params

  const intersectedInlines = paragraph.inlines.filter(
    (inline) => inline.visibleStart < visibleEnd && inline.visibleEnd > visibleStart,
  )

  if (intersectedInlines.length === 0) {
    return { visibleStart, visibleEnd }
  }

  const partiallyCoveredFormattedInlines = intersectedInlines.filter((inline) => {
    if (!isFormattedInline(inline)) {
      return false
    }

    return visibleStart > inline.visibleStart || visibleEnd < inline.visibleEnd
  })

  if (partiallyCoveredFormattedInlines.length === 0) {
    return { visibleStart, visibleEnd }
  }

  if (
    partiallyCoveredFormattedInlines.length === 1 &&
    intersectedInlines.length === 1
  ) {
    const inline = partiallyCoveredFormattedInlines[0]
    return {
      visibleStart: inline.visibleStart,
      visibleEnd: inline.visibleEnd,
    }
  }

  return { error: 'partial_inline_selection' }
}

export function resolveParagraphRewriteTarget(params: {
  document: CanonicalDocument
  selection: SelectionSnapshot
}): ParagraphRewriteTarget | RewriteTargetError {
  const { document, selection } = params
  const selectedText = selection.text.trim()

  if (!selectedText) {
    return { error: 'empty_selection' }
  }

  if (
    !selection.startBlockId ||
    !selection.endBlockId ||
    selection.startBlockId !== selection.endBlockId
  ) {
    return { error: 'cross_block' }
  }

  const block = document.blocks.find((item) => item.id === selection.startBlockId)
  if (!block || block.kind !== 'paragraph') {
    return { error: 'non_paragraph' }
  }

  const paragraph = block
  const visibleStart = Math.max(0, selection.startOffsetInStartBlock)
  const visibleEnd = Math.min(paragraph.visibleText.length, selection.endOffsetInEndBlock)

  if (visibleEnd <= visibleStart) {
    return { error: 'empty_selection' }
  }

  const effectiveSelection = normalizeVisibleSelectionForRewrite({
    paragraph,
    visibleStart,
    visibleEnd,
  })
  if ('error' in effectiveSelection) {
    return effectiveSelection
  }

  const visibleToRawBoundaryMap = buildVisibleToRawBoundaryMap(paragraph)
  if (!visibleToRawBoundaryMap) {
    return { error: 'non_paragraph' }
  }

  return {
    blockId: paragraph.id,
    rawMarkdown: paragraph.source.rawSlice,
    rawStart: paragraph.source.rawStart,
    rawEnd: paragraph.source.rawEnd,
    visibleSelection: {
      start: effectiveSelection.visibleStart,
      end: effectiveSelection.visibleEnd,
    },
    rawSelection: {
      start: visibleToRawBoundaryMap[effectiveSelection.visibleStart] ?? paragraph.source.rawStart,
      end: visibleToRawBoundaryMap[effectiveSelection.visibleEnd] ?? paragraph.source.rawEnd,
    },
    documentRawMarkdown: document.rawMarkdown,
  }
}
