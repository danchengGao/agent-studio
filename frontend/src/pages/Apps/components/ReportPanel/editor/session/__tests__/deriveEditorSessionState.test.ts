import { describe, expect, it } from 'vitest'
import { parseMarkdownToCanonical } from '../../canonical'
import { deriveEditorSessionState } from '../deriveEditorSessionState'

const canonical = parseMarkdownToCanonical({
  rawMarkdown: 'First paragraph.\n\nSecond paragraph.',
  baseVersion: 'report:test',
  draftRevision: 0,
})

describe('deriveEditorSessionState', () => {
  it('allows entering edit mode only for editable final reports', () => {
    const state = deriveEditorSessionState({
      baseVersion: 'report:test',
      canonical,
      mode: 'browse',
      isFinalReport: true,
      editingEnabled: true,
      rewriteOverlayState: 'idle',
      recoveryState: 'idle',
    })

    expect(state.canEnterEditMode).toBe(true)
    expect(state.canExitEditMode).toBe(false)
    expect(state.canTriggerRewrite).toBe(false)
  })

  it('locks the edit session while rewrite is thinking or writing', () => {
    const state = deriveEditorSessionState({
      baseVersion: 'report:test',
      canonical,
      mode: 'edit',
      isFinalReport: true,
      editingEnabled: true,
      rewriteOverlayState: 'thinking',
      recoveryState: 'idle',
    })

    expect(state.isRewriteLocked).toBe(true)
    expect(state.canExitEditMode).toBe(false)
    expect(state.canTriggerRewrite).toBe(false)
  })

  it('disables rewrite and exit when the session is in recovery', () => {
    const state = deriveEditorSessionState({
      baseVersion: 'report:test',
      canonical,
      mode: 'edit',
      isFinalReport: true,
      editingEnabled: true,
      rewriteOverlayState: 'idle',
      recoveryState: 'needsRecovery',
    })

    expect(state.recoveryState).toBe('needsRecovery')
    expect(state.canExitEditMode).toBe(false)
    expect(state.canTriggerRewrite).toBe(false)
  })
})
