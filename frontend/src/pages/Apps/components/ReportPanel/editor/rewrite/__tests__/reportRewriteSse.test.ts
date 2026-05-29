import { describe, expect, it } from 'vitest'
import { consumeReportRewriteSseChunk } from '../reportRewriteSse'

describe('consumeReportRewriteSseChunk', () => {
  it('keeps the trailing incomplete line buffered until the next chunk', () => {
    const result = consumeReportRewriteSseChunk({
      buffer: '',
      chunkText: 'data: {"agent":"user_feedback_processor"',
      flush: false,
    })

    expect(result.events).toEqual([])
    expect(result.buffer).toBe('data: {"agent":"user_feedback_processor"')
  })

  it('flushes the trailing buffered event when the stream ends without a newline', () => {
    const result = consumeReportRewriteSseChunk({
      buffer: 'data: {"agent":"user_feedback_processor","content":"{\\"final_result\\":{\\"response_content\\":\\"done\\"}}"}',
      chunkText: '',
      flush: true,
    })

    expect(result.buffer).toBe('')
    expect(result.events).toHaveLength(1)
    expect(result.events[0]).toEqual({
      agent: 'user_feedback_processor',
      content: '{"final_result":{"response_content":"done"}}',
    })
  })
})
