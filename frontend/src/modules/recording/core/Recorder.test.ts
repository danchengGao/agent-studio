import { RecorderImpl } from './Recorder'
import { MemoryStorage } from '../storage/MemoryStorage'

describe('RecorderImpl', () => {
  it('persists events, interactions, rewrites, and continued sessions', async () => {
    const storage = new MemoryStorage()
    const recorder = new RecorderImpl({ storage })

    const firstId = await recorder.start({
      query: 'first run',
      metadata: { conversationId: 'conversation-1' },
    })

    recorder.record({
      event: 'message',
      agent: 'planner',
      content: 'step 1',
    })
    recorder.recordInteraction({
      kind: 'hitl',
      feedback: 'accepted',
      userMessage: 'continue',
    })

    const firstSession = await recorder.stop()

    expect(firstSession.id).toBe(firstId)
    expect(firstSession.events).toHaveLength(1)
    expect(firstSession.interactionEvents).toHaveLength(1)
    expect(firstSession.interactionEvents?.[0]?.afterEventCount).toBe(1)

    recorder.startRewriteRecording({
      action: 'polish',
      selectedText: 'draft',
      startOffset: 0,
      endOffset: 5,
      userInstruction: 'keep concise',
    })
    recorder.recordRewriteEvent({
      event: 'message',
      agent: 'user_feedback_processor',
      content: '{"rewritten_text":"done"}',
    })
    await recorder.stopRewriteRecording()

    const savedAfterRewrite = await storage.get(firstId)
    expect(savedAfterRewrite?.rewriteEvents).toHaveLength(1)
    expect(savedAfterRewrite?.rewriteEvents?.[0]?.responseEvents).toHaveLength(1)

    const continuedId = await recorder.continueSession({
      query: 'follow up',
      metadata: { conversationId: 'conversation-1' },
    })
    expect(continuedId).toBe(firstId)

    recorder.record({
      event: 'message',
      agent: 'writer',
      content: 'step 2',
    })

    const continuedSession = await recorder.stop()
    expect(continuedSession.events).toHaveLength(2)
    expect(continuedSession.rewriteEvents).toHaveLength(1)
    expect(continuedSession.interactionEvents).toHaveLength(1)
  })
})
