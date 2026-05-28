import { describe, expect, it } from 'vitest'
import {
  advanceRewriteMotionPhase,
  createRewriteMotionSession,
  shouldKeepRewriteLocked,
} from '../../rewriteMotionState'

describe('rewrite motion state', () => {
  it('starts in locked phase and preserves the active block id', () => {
    expect(
      createRewriteMotionSession({
        runId: 7,
        blockId: 'paragraph-1',
      }),
    ).toEqual({
      runId: 7,
      blockId: 'paragraph-1',
      phase: 'locked',
    })
  })

  it('advances through writing, morphing, and settling in order', () => {
    const session = createRewriteMotionSession({ runId: 7, blockId: 'paragraph-1' })

    expect(advanceRewriteMotionPhase(session, 'writing').phase).toBe('writing')
    expect(advanceRewriteMotionPhase(session, 'morphing').phase).toBe('morphing')
    expect(advanceRewriteMotionPhase(session, 'settling').phase).toBe('settling')
  })

  it('keeps the rewrite lock until settling is complete', () => {
    expect(shouldKeepRewriteLocked('locked')).toBe(true)
    expect(shouldKeepRewriteLocked('writing')).toBe(true)
    expect(shouldKeepRewriteLocked('morphing')).toBe(true)
    expect(shouldKeepRewriteLocked('settling')).toBe(true)
    expect(shouldKeepRewriteLocked('idle')).toBe(false)
  })
})
