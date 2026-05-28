import { describe, expect, it } from 'vitest'
import { parseMarkdownToCanonical } from '../../canonical'
import { applyRewriteResult } from '../../rewrite'
import { buildReportEditorViewModel, computeChangedBlockIds } from '..'

describe('computeChangedBlockIds', () => {
  it('marks only the rewritten paragraph block as changed', () => {
    const previous = parseMarkdownToCanonical({
      rawMarkdown: '# 标题\n\n第一段内容。\n\n第二段内容。',
      baseVersion: 'v1',
      draftRevision: 0,
    })
    const next = applyRewriteResult({
      previous,
      nextRawMarkdown: '# 标题\n\n第一段已经被改写。\n\n第二段内容。',
      nextBaseVersion: 'v2',
    })

    const changedBlockIds = computeChangedBlockIds(previous, next)

    expect(changedBlockIds).toEqual([next.blocks[1]?.id])
  })

  it('does not mark untouched heading or paragraph blocks as changed', () => {
    const previous = parseMarkdownToCanonical({
      rawMarkdown: '# 标题\n\n第一段内容。\n\n第二段内容。',
      baseVersion: 'v1',
      draftRevision: 0,
    })
    const next = applyRewriteResult({
      previous,
      nextRawMarkdown: '# 标题\n\n第一段已经被改写。\n\n第二段内容。',
      nextBaseVersion: 'v2',
    })

    const changedBlockIds = computeChangedBlockIds(previous, next)

    expect(changedBlockIds).not.toContain(next.blocks[0]?.id)
    expect(changedBlockIds).not.toContain(next.blocks[2]?.id)
  })
})

describe('buildReportEditorViewModel', () => {
  it('keeps untouched block keys stable when another block changes', () => {
    const previous = parseMarkdownToCanonical({
      rawMarkdown: '# 标题\n\n第一段内容。\n\n第二段内容。',
      baseVersion: 'v1',
      draftRevision: 0,
    })
    const next = applyRewriteResult({
      previous,
      nextRawMarkdown: '# 标题\n\n第一段已经被改写。\n\n第二段内容。',
      nextBaseVersion: 'v2',
    })

    const previousViewModel = buildReportEditorViewModel(previous, [])
    const nextViewModel = buildReportEditorViewModel(
      next,
      computeChangedBlockIds(previous, next),
    )

    expect(nextViewModel.blocks[0]?.contentKey).toBe(previousViewModel.blocks[0]?.contentKey)
    expect(nextViewModel.blocks[2]?.contentKey).toBe(previousViewModel.blocks[2]?.contentKey)
    expect(nextViewModel.blocks[1]?.contentKey).not.toBe(previousViewModel.blocks[1]?.contentKey)
  })
})
