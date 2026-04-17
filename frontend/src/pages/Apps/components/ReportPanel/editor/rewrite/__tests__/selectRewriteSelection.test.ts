import { describe, expect, it } from 'vitest'
import type { SelectionSnapshot } from '../types'
import { selectRewriteSelection } from '../selectRewriteSelection'

const selection = (input: Partial<SelectionSnapshot> & { text: string }): SelectionSnapshot => ({
  text: input.text,
  startBlockId: input.startBlockId ?? null,
  endBlockId: input.endBlockId ?? null,
  startOffsetInStartBlock: input.startOffsetInStartBlock ?? 0,
  endOffsetInEndBlock: input.endOffsetInEndBlock ?? input.text.length,
})

describe('selectRewriteSelection', () => {
  it('reuses the cached cross-block selection when the live selection is lost on side-menu click', () => {
    const cachedSelection = selection({
      text: '第一段内容。\n第二段内容。',
      startBlockId: 'block-a',
      endBlockId: 'block-b',
      endOffsetInEndBlock: 5,
    })
    const fallbackBlockSelection = selection({
      text: '第一段内容。',
      startBlockId: 'block-a',
      endBlockId: 'block-a',
    })

    expect(
      selectRewriteSelection({
        liveSelection: null,
        cachedSelection,
        fallbackBlockSelection,
        targetBlockId: 'block-a',
      }),
    ).toEqual(cachedSelection)
  })

  it('uses the live selection when it still targets the current block', () => {
    const liveSelection = selection({
      text: '第二段内容。',
      startBlockId: 'block-b',
      endBlockId: 'block-b',
    })
    const fallbackBlockSelection = selection({
      text: '第二段内容。',
      startBlockId: 'block-b',
      endBlockId: 'block-b',
    })

    expect(
      selectRewriteSelection({
        liveSelection,
        cachedSelection: null,
        fallbackBlockSelection,
        targetBlockId: 'block-b',
      }),
    ).toEqual(liveSelection)
  })

  it('falls back to the hovered block when neither live nor cached selection targets it', () => {
    const cachedSelection = selection({
      text: '第一段内容。',
      startBlockId: 'block-a',
      endBlockId: 'block-a',
    })
    const fallbackBlockSelection = selection({
      text: '第三段内容。',
      startBlockId: 'block-c',
      endBlockId: 'block-c',
    })

    expect(
      selectRewriteSelection({
        liveSelection: null,
        cachedSelection,
        fallbackBlockSelection,
        targetBlockId: 'block-c',
      }),
    ).toEqual(fallbackBlockSelection)
  })
})
