import type { CanonicalBlock, CanonicalDocument } from '../canonical'

const normalizeVisibleText = (input: string) => input.replace(/\s+/g, ' ').trim()

const getBlockNormalizedVisibleText = (block: CanonicalBlock) => {
  if ('normalizedVisibleText' in block && typeof block.normalizedVisibleText === 'string') {
    return block.normalizedVisibleText
  }

  return null
}

export function matchCanonicalBlockByVisibleText(params: {
  editorBlockIndex: number
  editorVisibleText: string
  blocks: CanonicalDocument['blocks']
}): string | null {
  const { editorBlockIndex, editorVisibleText, blocks } = params
  const normalizedEditorVisibleText = normalizeVisibleText(editorVisibleText)

  if (normalizedEditorVisibleText) {
    const candidates = blocks
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => getBlockNormalizedVisibleText(block) === normalizedEditorVisibleText)

    if (candidates.length === 1) {
      return candidates[0].block.id
    }

    if (candidates.length > 1 && editorBlockIndex >= 0) {
      return candidates.reduce((best, current) => {
        const bestDistance = Math.abs(best.index - editorBlockIndex)
        const currentDistance = Math.abs(current.index - editorBlockIndex)
        return currentDistance < bestDistance ? current : best
      }).block.id
    }
  }

  if (editorBlockIndex >= 0 && editorBlockIndex < blocks.length) {
    return blocks[editorBlockIndex].id
  }

  return null
}
