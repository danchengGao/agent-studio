import type { SelectionSnapshot } from './types'

const selectionTouchesBlock = (
  selection: SelectionSnapshot | null | undefined,
  targetBlockId: string | null,
) => {
  if (!selection || !targetBlockId) {
    return false
  }

  return (
    selection.startBlockId === targetBlockId ||
    selection.endBlockId === targetBlockId
  )
}

export function selectRewriteSelection(params: {
  liveSelection: SelectionSnapshot | null
  cachedSelection: SelectionSnapshot | null
  fallbackBlockSelection: SelectionSnapshot | null
  targetBlockId: string | null
}): SelectionSnapshot | null {
  const { liveSelection, cachedSelection, fallbackBlockSelection, targetBlockId } = params

  if (selectionTouchesBlock(liveSelection, targetBlockId)) {
    return liveSelection
  }

  if (selectionTouchesBlock(cachedSelection, targetBlockId)) {
    return cachedSelection
  }

  return fallbackBlockSelection
}
