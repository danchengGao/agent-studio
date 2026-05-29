import type { CanonicalBlockKind, CanonicalDocument } from '../canonical'

export interface ReportEditorBlockViewModel {
  blockId: string
  kind: CanonicalBlockKind
  contentKey: string
  isChanged: boolean
}

export interface ReportEditorViewModel {
  document: CanonicalDocument
  blocks: ReportEditorBlockViewModel[]
}
