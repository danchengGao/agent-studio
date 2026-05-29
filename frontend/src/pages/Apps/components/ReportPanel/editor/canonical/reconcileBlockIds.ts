import type { CanonicalBlock } from './types'

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim()

const getIdentityText = (block: CanonicalBlock) => {
  switch (block.kind) {
    case 'paragraph':
    case 'heading':
      return normalize(block.normalizedVisibleText || block.visibleText)
    default:
      return normalize(block.source.rawSlice)
  }
}

const computeOverlap = (left: CanonicalBlock, right: CanonicalBlock) => {
  const start = Math.max(left.source.rawStart, right.source.rawStart)
  const end = Math.min(left.source.rawEnd, right.source.rawEnd)
  return Math.max(0, end - start)
}

const computeScore = (previous: CanonicalBlock, next: CanonicalBlock) => {
  if (previous.kind !== next.kind) {
    return Number.NEGATIVE_INFINITY
  }

  const previousIdentity = getIdentityText(previous)
  const nextIdentity = getIdentityText(next)
  let score = 0

  if (previousIdentity.length > 0 && previousIdentity === nextIdentity) {
    score += 1000
  }

  if (normalize(previous.source.rawSlice) === normalize(next.source.rawSlice)) {
    score += 200
  }

  score += computeOverlap(previous, next)

  return score
}

export function reconcileBlockIds(params: {
  previousBlocks: CanonicalBlock[]
  nextBlocks: CanonicalBlock[]
}): CanonicalBlock[] {
  const usedPreviousIds = new Set<string>()

  return params.nextBlocks.map((nextBlock) => {
    let bestMatch: CanonicalBlock | null = null
    let bestScore = Number.NEGATIVE_INFINITY

    for (const previousBlock of params.previousBlocks) {
      if (usedPreviousIds.has(previousBlock.id)) {
        continue
      }

      const score = computeScore(previousBlock, nextBlock)
      if (score > bestScore) {
        bestMatch = previousBlock
        bestScore = score
      }
    }

    if (!bestMatch || bestScore < 1000) {
      return nextBlock
    }

    usedPreviousIds.add(bestMatch.id)
    return {
      ...nextBlock,
      id: bestMatch.id,
    }
  })
}
