import { describe, expect, it } from 'vitest'
import { parseMarkdownToCanonical } from '@/pages/Apps/components/ReportPanel/editor/canonical'
import { matchCanonicalBlockByVisibleText } from '@/pages/Apps/components/ReportPanel/editor/presentation/matchCanonicalBlockByVisibleText'

describe('matchCanonicalBlockByVisibleText', () => {
  it('prefers visible-text match over raw index fallback', () => {
    const document = parseMarkdownToCanonical({
      rawMarkdown: ['# 标题', '', '第一段正文', '', '第二段正文'].join('\n'),
      baseVersion: 'report:match-1',
      draftRevision: 0,
    })

    const matchedBlockId = matchCanonicalBlockByVisibleText({
      editorBlockIndex: 0,
      editorVisibleText: '第一段正文',
      blocks: document.blocks,
    })

    expect(document.blocks.find((block) => block.id === matchedBlockId)?.kind).toBe('paragraph')
    expect(document.blocks.find((block) => block.id === matchedBlockId)?.source.rawSlice).toContain(
      '第一段正文',
    )
  })

  it('chooses the nearest candidate when visible text repeats', () => {
    const document = parseMarkdownToCanonical({
      rawMarkdown: ['重复段', '', '中间段', '', '重复段'].join('\n'),
      baseVersion: 'report:match-2',
      draftRevision: 0,
    })

    const matchedBlockId = matchCanonicalBlockByVisibleText({
      editorBlockIndex: 2,
      editorVisibleText: '重复段',
      blocks: document.blocks,
    })

    expect(matchedBlockId).toBe(document.blocks[2].id)
  })

  it('falls back to editor index when visible text match is unavailable', () => {
    const document = parseMarkdownToCanonical({
      rawMarkdown: ['第一段', '', '第二段'].join('\n'),
      baseVersion: 'report:match-3',
      draftRevision: 0,
    })

    expect(
      matchCanonicalBlockByVisibleText({
        editorBlockIndex: 1,
        editorVisibleText: '',
        blocks: document.blocks,
      }),
    ).toBe(document.blocks[1].id)
  })
})
