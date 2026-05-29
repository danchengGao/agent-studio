import type { CanonicalDocument } from '../canonical'

export function computeChangedBlockIds(
  previous: CanonicalDocument,
  next: CanonicalDocument,
): string[] {
  const previousById = new Map(previous.blocks.map((block) => [block.id, block]))

  return next.blocks
    .filter((block) => {
      const previousBlock = previousById.get(block.id)
      return !previousBlock || previousBlock.source.rawSlice !== block.source.rawSlice
    })
    .map((block) => block.id)
}
