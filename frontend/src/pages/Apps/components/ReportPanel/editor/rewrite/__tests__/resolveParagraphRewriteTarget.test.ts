import { describe, expect, it } from 'vitest'
import { parseMarkdownToCanonical } from '../../canonical'
import { buildRewriteRequest, resolveParagraphRewriteTarget } from '../index'
import type { SelectionSnapshot } from '../types'

const buildSelection = (input: SelectionSnapshot): SelectionSnapshot => input

describe('resolveParagraphRewriteTarget', () => {
  it('accepts a single paragraph selection and returns the full paragraph raw slice', () => {
    const rawMarkdown =
      '第一段保留不动。\n\n京东集团2025年经济状况呈现“整体稳健、结构分化”特征，全年总收入达**13091亿元**，同比增长**13.0%**。'
    const document = parseMarkdownToCanonical({
      rawMarkdown,
      baseVersion: 'test-v1',
      draftRevision: 0,
    })

    const paragraph = document.blocks[1]
    expect(paragraph?.kind).toBe('paragraph')
    if (!paragraph || paragraph.kind !== 'paragraph') {
      throw new Error('expected paragraph block')
    }

    const selectedText = '全年总收入达13091亿元'
    const start = paragraph.visibleText.indexOf(selectedText)
    const end = start + selectedText.length
    const selection = buildSelection({
      text: selectedText,
      startBlockId: paragraph.id,
      endBlockId: paragraph.id,
      startOffsetInStartBlock: start,
      endOffsetInEndBlock: end,
    })

    const target = resolveParagraphRewriteTarget({ document, selection })

    expect('error' in target).toBe(false)
    if ('error' in target) {
      throw new Error(`unexpected error: ${target.error}`)
    }

    expect(target.blockId).toBe(paragraph.id)
    expect(target.rawMarkdown).toBe(paragraph.source.rawSlice)
    expect(target.rawStart).toBe(paragraph.source.rawStart)
    expect(target.rawEnd).toBe(paragraph.source.rawEnd)
    expect(target.visibleSelection).toEqual({ start, end })
  })

  it('supports inline text whose visible content is split by markdown wrappers', () => {
    const rawMarkdown = '新业务收入激增**156.8%**至**493亿元**，但亏损扩大至**466.41亿元**。'
    const document = parseMarkdownToCanonical({
      rawMarkdown,
      baseVersion: 'test-v1',
      draftRevision: 0,
    })

    const paragraph = document.blocks[0]
    expect(paragraph?.kind).toBe('paragraph')
    if (!paragraph || paragraph.kind !== 'paragraph') {
      throw new Error('expected paragraph block')
    }

    const selectedText = '156.8%至493亿元'
    const start = paragraph.visibleText.indexOf(selectedText)
    const end = start + selectedText.length

    const target = resolveParagraphRewriteTarget({
      document,
      selection: buildSelection({
        text: selectedText,
        startBlockId: paragraph.id,
        endBlockId: paragraph.id,
        startOffsetInStartBlock: start,
        endOffsetInEndBlock: end,
      }),
    })

    expect('error' in target).toBe(false)
    if ('error' in target) {
      throw new Error(`unexpected error: ${target.error}`)
    }

    expect(
      target.rawMarkdown.slice(
        target.rawSelection.start - target.rawStart,
        target.rawSelection.end - target.rawStart,
      ),
    ).toContain('156.8%**至**493亿元**')
  })

  it('preserves wrapped raw syntax at inline boundaries', () => {
    const rawMarkdown = '[abc](#inference:1) trailing text'
    const document = parseMarkdownToCanonical({
      rawMarkdown,
      baseVersion: 'test-v1',
      draftRevision: 0,
    })

    const paragraph = document.blocks[0]
    expect(paragraph?.kind).toBe('paragraph')
    if (!paragraph || paragraph.kind !== 'paragraph') {
      throw new Error('expected paragraph block')
    }

    const selectedText = 'abc'
    const start = paragraph.visibleText.indexOf(selectedText)
    const end = start + selectedText.length

    const target = resolveParagraphRewriteTarget({
      document,
      selection: buildSelection({
        text: selectedText,
        startBlockId: paragraph.id,
        endBlockId: paragraph.id,
        startOffsetInStartBlock: start,
        endOffsetInEndBlock: end,
      }),
    })

    expect('error' in target).toBe(false)
    if ('error' in target) {
      throw new Error(`unexpected error: ${target.error}`)
    }

    expect(
      rawMarkdown.slice(target.rawSelection.start, target.rawSelection.end),
    ).toBe('[abc](#inference:1)')
  })

  it('expands a partial strong selection to the full inline token', () => {
    const rawMarkdown = 'prefix **abcdef** suffix'
    const document = parseMarkdownToCanonical({
      rawMarkdown,
      baseVersion: 'test-v1',
      draftRevision: 0,
    })

    const paragraph = document.blocks[0]
    expect(paragraph?.kind).toBe('paragraph')
    if (!paragraph || paragraph.kind !== 'paragraph') {
      throw new Error('expected paragraph block')
    }

    const selectedText = 'abc'
    const start = paragraph.visibleText.indexOf(selectedText)
    const end = start + selectedText.length

    const target = resolveParagraphRewriteTarget({
      document,
      selection: buildSelection({
        text: selectedText,
        startBlockId: paragraph.id,
        endBlockId: paragraph.id,
        startOffsetInStartBlock: start,
        endOffsetInEndBlock: end,
      }),
    })

    expect('error' in target).toBe(false)
    if ('error' in target) {
      throw new Error(`unexpected error: ${target.error}`)
    }

    expect(
      rawMarkdown.slice(target.rawSelection.start, target.rawSelection.end),
    ).toBe('**abcdef**')
  })

  it('accepts a mixed text and formatted selection when formatted tokens are fully covered', () => {
    const rawMarkdown = 'abc **def** ghi'
    const document = parseMarkdownToCanonical({
      rawMarkdown,
      baseVersion: 'test-v1',
      draftRevision: 0,
    })

    const paragraph = document.blocks[0]
    expect(paragraph?.kind).toBe('paragraph')
    if (!paragraph || paragraph.kind !== 'paragraph') {
      throw new Error('expected paragraph block')
    }

    const selectedText = 'abc def'
    const start = paragraph.visibleText.indexOf(selectedText)
    const end = start + selectedText.length

    const target = resolveParagraphRewriteTarget({
      document,
      selection: buildSelection({
        text: selectedText,
        startBlockId: paragraph.id,
        endBlockId: paragraph.id,
        startOffsetInStartBlock: start,
        endOffsetInEndBlock: end,
      }),
    })

    expect('error' in target).toBe(false)
    if ('error' in target) {
      throw new Error(`unexpected error: ${target.error}`)
    }

    expect(
      rawMarkdown.slice(target.rawSelection.start, target.rawSelection.end),
    ).toBe('abc **def**')
  })

  it('rejects a mixed selection when it only partially covers a formatted token', () => {
    const rawMarkdown = 'abc **def** ghi'
    const document = parseMarkdownToCanonical({
      rawMarkdown,
      baseVersion: 'test-v1',
      draftRevision: 0,
    })

    const paragraph = document.blocks[0]
    expect(paragraph?.kind).toBe('paragraph')
    if (!paragraph || paragraph.kind !== 'paragraph') {
      throw new Error('expected paragraph block')
    }

    const selectedText = 'c de'
    const start = paragraph.visibleText.indexOf(selectedText)
    const end = start + selectedText.length

    const target = resolveParagraphRewriteTarget({
      document,
      selection: buildSelection({
        text: selectedText,
        startBlockId: paragraph.id,
        endBlockId: paragraph.id,
        startOffsetInStartBlock: start,
        endOffsetInEndBlock: end,
      }),
    })

    expect(target).toEqual({ error: 'partial_inline_selection' })
  })


  it('rejects cross-block selection with cross_block', () => {
    const document = parseMarkdownToCanonical({
      rawMarkdown: '第一段内容。\n\n第二段内容。',
      baseVersion: 'test-v1',
      draftRevision: 0,
    })

    const first = document.blocks[0]
    const second = document.blocks[1]
    expect(first?.kind).toBe('paragraph')
    expect(second?.kind).toBe('paragraph')
    if (!first || !second) {
      throw new Error('expected paragraph blocks')
    }

    const result = resolveParagraphRewriteTarget({
      document,
      selection: buildSelection({
        text: '第一段内容。第二段内容。',
        startBlockId: first.id,
        endBlockId: second.id,
        startOffsetInStartBlock: 0,
        endOffsetInEndBlock: 5,
      }),
    })

    expect(result).toEqual({ error: 'cross_block' })
  })

  it('rejects protected block targets in phase 1', () => {
    const document = parseMarkdownToCanonical({
      rawMarkdown: '# 标题\n\n正文段落',
      baseVersion: 'test-v1',
      draftRevision: 0,
    })

    const heading = document.blocks[0]
    expect(heading?.kind).toBe('heading')
    if (!heading) {
      throw new Error('expected heading block')
    }

    const result = resolveParagraphRewriteTarget({
      document,
      selection: buildSelection({
        text: '标题',
        startBlockId: heading.id,
        endBlockId: heading.id,
        startOffsetInStartBlock: 0,
        endOffsetInEndBlock: 2,
      }),
    })

    expect(result).toEqual({ error: 'non_paragraph' })
  })
})

describe('buildRewriteRequest', () => {
  it('builds request payload from canonical target instead of cleaned fallback data', () => {
    const rawMarkdown =
      '京东集团2025年经济状况呈现“整体稳健、结构分化”特征，全年总收入达**13091亿元**，同比增长**13.0%**。'
    const document = parseMarkdownToCanonical({
      rawMarkdown,
      baseVersion: 'test-v1',
      draftRevision: 0,
    })

    const paragraph = document.blocks[0]
    expect(paragraph?.kind).toBe('paragraph')
    if (!paragraph || paragraph.kind !== 'paragraph') {
      throw new Error('expected paragraph block')
    }

    const selectedText = '全年总收入达13091亿元'
    const start = paragraph.visibleText.indexOf(selectedText)
    const end = start + selectedText.length
    const target = resolveParagraphRewriteTarget({
      document,
      selection: buildSelection({
        text: selectedText,
        startBlockId: paragraph.id,
        endBlockId: paragraph.id,
        startOffsetInStartBlock: start,
        endOffsetInEndBlock: end,
      }),
    })

    expect('error' in target).toBe(false)
    if ('error' in target) {
      throw new Error(`unexpected error: ${target.error}`)
    }

    const request = buildRewriteRequest({
      target,
      action: 'polish',
      conversationId: 'conversation-1',
      userInstruction: '更精炼',
    })

    expect(request.action).toBe('polish')
    expect(request.conversationId).toBe('conversation-1')
    expect(request.selectedText).toBe(
      rawMarkdown.slice(target.rawSelection.start, target.rawSelection.end),
    )
    expect(request.userInstruction).toBe('更精炼')
    expect(request.blockId).toBe(paragraph.id)
    expect(request.startOffset).toBeGreaterThanOrEqual(0)
    expect(request.endOffset).toBeGreaterThan(request.startOffset)
  })

  it('preserves inline newlines in selected_text instead of normalizing them to spaces', () => {
    const rawMarkdown = 'alpha line\nbeta line'
    const document = parseMarkdownToCanonical({
      rawMarkdown,
      baseVersion: 'test-v1',
      draftRevision: 0,
    })

    const paragraph = document.blocks[0]
    expect(paragraph?.kind).toBe('paragraph')
    if (!paragraph || paragraph.kind !== 'paragraph') {
      throw new Error('expected paragraph block')
    }

    expect(paragraph.visibleText).toContain('\n')

    const selectedText = paragraph.visibleText
    const target = resolveParagraphRewriteTarget({
      document,
      selection: buildSelection({
        text: selectedText,
        startBlockId: paragraph.id,
        endBlockId: paragraph.id,
        startOffsetInStartBlock: 0,
        endOffsetInEndBlock: selectedText.length,
      }),
    })

    expect('error' in target).toBe(false)
    if ('error' in target) {
      throw new Error(`unexpected error: ${target.error}`)
    }

    const request = buildRewriteRequest({
      target,
      action: 'polish',
      conversationId: 'conversation-1',
    })

    expect(request.selectedText).toBe('alpha line\nbeta line')
    expect(request.selectedText).not.toBe('alpha line beta line')
  })
})
