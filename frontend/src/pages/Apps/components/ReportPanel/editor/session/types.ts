import type { CanonicalDocument } from '../canonical'

export type ReportEditorMode = 'browse' | 'edit'
export type RewriteOverlayState = 'idle' | 'thinking' | 'writing' | 'success' | 'error'
export type RecoveryState = 'idle' | 'needsRecovery'

export interface ReportEditorSessionState {
  baseVersion: string
  canonical: CanonicalDocument
  mode: ReportEditorMode
  rewriteOverlayState: RewriteOverlayState
  recoveryState: RecoveryState
  isFinalReport: boolean
  editingEnabled: boolean
  isRewriteLocked: boolean
  canEnterEditMode: boolean
  canExitEditMode: boolean
  canTriggerRewrite: boolean
}
