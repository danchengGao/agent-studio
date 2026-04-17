import type { CanonicalDocument } from '../canonical'
import type {
  RecoveryState,
  ReportEditorMode,
  ReportEditorSessionState,
  RewriteOverlayState,
} from './types'

export function deriveEditorSessionState(input: {
  baseVersion: string
  canonical: CanonicalDocument
  mode?: ReportEditorMode
  rewriteOverlayState?: RewriteOverlayState
  recoveryState?: RecoveryState
  isFinalReport?: boolean
  editingEnabled?: boolean
}): ReportEditorSessionState {
  const mode = input.mode ?? 'browse'
  const rewriteOverlayState = input.rewriteOverlayState ?? 'idle'
  const recoveryState = input.recoveryState ?? 'idle'
  const isFinalReport = input.isFinalReport ?? true
  const editingEnabled = input.editingEnabled ?? true

  const isRewriteLocked =
    rewriteOverlayState === 'thinking' || rewriteOverlayState === 'writing'
  const canEnterEditMode =
    mode === 'browse' &&
    isFinalReport &&
    editingEnabled &&
    recoveryState === 'idle'
  const canExitEditMode =
    mode === 'edit' &&
    !isRewriteLocked &&
    recoveryState === 'idle'
  const canTriggerRewrite =
    mode === 'edit' &&
    isFinalReport &&
    editingEnabled &&
    !isRewriteLocked &&
    recoveryState === 'idle'

  return {
    baseVersion: input.baseVersion,
    canonical: input.canonical,
    mode,
    rewriteOverlayState,
    recoveryState,
    isFinalReport,
    editingEnabled,
    isRewriteLocked,
    canEnterEditMode,
    canExitEditMode,
    canTriggerRewrite,
  }
}
