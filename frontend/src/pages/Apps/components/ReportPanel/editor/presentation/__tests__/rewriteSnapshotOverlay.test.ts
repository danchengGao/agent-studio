import { describe, expect, it } from 'vitest'
import {
  buildRewriteSnapshotOverlay,
  shouldRenderSnapshotOverlay,
} from '../../rewriteSnapshotOverlay'

describe('rewrite snapshot overlay', () => {
  it('captures block text and geometry for morphing', () => {
    expect(
      buildRewriteSnapshotOverlay({
        blockId: 'paragraph-1',
        text: 'Original paragraph',
        top: 12,
        left: 24,
        width: 320,
        height: 56,
      }),
    ).toEqual({
      blockId: 'paragraph-1',
      text: 'Original paragraph',
      rect: { top: 12, left: 24, width: 320, height: 56 },
    })
  })

  it('renders only while the motion phase is writing or morphing', () => {
    expect(shouldRenderSnapshotOverlay('locked')).toBe(false)
    expect(shouldRenderSnapshotOverlay('writing')).toBe(true)
    expect(shouldRenderSnapshotOverlay('morphing')).toBe(true)
    expect(shouldRenderSnapshotOverlay('settling')).toBe(false)
  })
})
