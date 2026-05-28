import { describe, expect, it } from 'vitest'
import {
  buildBlockTransitionStyleRule,
  buildRewriteDiffStyleRule,
} from '../../blockTransitionStyle'

describe('buildBlockTransitionStyleRule', () => {
  it('builds a selector-driven highlight rule for the targeted block id', () => {
    const rule = buildBlockTransitionStyleRule({
      blockId: 'block-123',
      phase: 'highlight',
    })

    expect(rule).toContain('[data-node-type="blockOuter"][data-id="block-123"]')
    expect(rule).toContain('outline: 2px dashed')
  })

  it('builds a selector-driven fade-in rule that uses the shared keyframe animation', () => {
    const rule = buildBlockTransitionStyleRule({
      blockId: 'block-456',
      phase: 'fadein',
    })

    expect(rule).toContain('contentFadeIn')
    expect(rule).toContain('block-456')
    expect(rule).toContain('.bn-block-content')
    expect(rule).toContain('box-shadow')
    expect(rule).toContain('0.9s')
  })

  it('builds a success rule that also targets the rendered block content', () => {
    const rule = buildBlockTransitionStyleRule({
      blockId: 'block-789',
      phase: 'success',
    })

    expect(rule).toContain('successFlash')
    expect(rule).toContain('.bn-block-content')
    expect(rule).toContain('rgba(34, 197, 94')
    expect(rule).toContain('1.4s')
  })

  it('returns an empty rule when the target block id is missing', () => {
    expect(
      buildBlockTransitionStyleRule({
        blockId: null,
        phase: 'success',
      }),
    ).toBe('')
  })
})

describe('buildRewriteDiffStyleRule', () => {
  it('creates a paragraph-level settle highlight fallback for noisy diffs', () => {
    const rule = buildRewriteDiffStyleRule({
      blockId: 'block-diff',
      paragraphFallback: true,
    })

    expect(rule).toContain('block-diff')
    expect(rule).toContain('.bn-block-content')
    expect(rule).toContain('rgba(34, 197, 94')
  })

  it('returns an empty rule when inline diff emphasis is active', () => {
    expect(
      buildRewriteDiffStyleRule({
        blockId: 'block-inline',
        paragraphFallback: false,
      }),
    ).toBe('')
  })
})
