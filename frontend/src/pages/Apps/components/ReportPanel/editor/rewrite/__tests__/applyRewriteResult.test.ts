import { describe, expect, it } from 'vitest'
import { parseMarkdownToCanonical } from '../../canonical'
import { applyRewriteResult } from '../applyRewriteResult'

describe('applyRewriteResult', () => {
  it('rebuilds canonical document from backend returned raw markdown', () => {
    const previous = parseMarkdownToCanonical({
      rawMarkdown: '第一段内容。\n\n第二段内容。',
      baseVersion: 'v1',
      draftRevision: 0,
    })

    const next = applyRewriteResult({
      previous,
      nextRawMarkdown: '第一段内容。\n\n第二段已经被改写。',
      nextBaseVersion: 'v2',
    })

    expect(next.rawMarkdown).toBe('第一段内容。\n\n第二段已经被改写。')
    expect(next.meta.baseVersion).toBe('v2')
    expect(next.meta.draftRevision).toBe(0)
    expect(next.blocks).toHaveLength(2)
    expect(next.blocks[1]?.kind).toBe('paragraph')
  })

  it('preserves stable ids for untouched blocks after a paragraph rewrite', () => {
    const previous = parseMarkdownToCanonical({
      rawMarkdown: '第一段内容。\n\n第二段内容。',
      baseVersion: 'v1',
      draftRevision: 0,
    })

    const next = applyRewriteResult({
      previous,
      nextRawMarkdown: '第一段内容。\n\n第二段已经被改写。',
      nextBaseVersion: 'v2',
    })

    expect(next.blocks[0]?.id).toBe(previous.blocks[0]?.id)
  })

  it('creates a new canonical paragraph when backend replaces the paragraph text', () => {
    const previous = parseMarkdownToCanonical({
      rawMarkdown: '第一段内容。\n\n第二段内容。',
      baseVersion: 'v1',
      draftRevision: 0,
    })

    const next = applyRewriteResult({
      previous,
      nextRawMarkdown: '第一段内容。\n\n这是全新的第二段。',
      nextBaseVersion: 'v2',
    })

    expect(next.blocks[1]?.kind).toBe('paragraph')
    expect(next.blocks[1]?.id).not.toBe(previous.blocks[1]?.id)
  })

  it('fails in a controlled way when backend returned markdown cannot rebuild into a consistent canonical snapshot', () => {
    const previous = parseMarkdownToCanonical({
      rawMarkdown: '第一段内容。',
      baseVersion: 'v1',
      draftRevision: 0,
    })

    expect(() =>
      applyRewriteResult({
        previous,
        nextRawMarkdown: '<div>only html without supported blocks</div>',
        nextBaseVersion: 'v2',
      }),
    ).toThrowError(/canonical/i)
  })
})
