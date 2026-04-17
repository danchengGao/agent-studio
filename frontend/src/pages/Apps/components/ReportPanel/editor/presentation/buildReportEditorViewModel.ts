import type { CanonicalDocument } from '../canonical'
import type { ReportEditorViewModel } from './types'

export function buildReportEditorViewModel(
  document: CanonicalDocument,
  changedBlockIds: string[],
): ReportEditorViewModel {
  const changedIdSet = new Set(changedBlockIds)

  return {
    document,
    blocks: document.blocks.map((block) => ({
      blockId: block.id,
      kind: block.kind,
      contentKey: `${block.id}:${block.source.rawSlice}`,
      isChanged: changedIdSet.has(block.id),
    })),
  }
}
