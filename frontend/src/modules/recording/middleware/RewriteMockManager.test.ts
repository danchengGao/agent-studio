import { RewriteMockManager } from './RewriteMockManager'
import type { RewriteEvent, RewriteRequest } from '../types'

const createRequest = (overrides: Partial<RewriteRequest> = {}): RewriteRequest => ({
  action: 'polish',
  selectedText: 'draft paragraph',
  startOffset: 0,
  endOffset: 15,
  userInstruction: 'make it clearer',
  ...overrides,
})

const createRewriteEvent = (request: RewriteRequest, timestamp: number): RewriteEvent => ({
  request,
  timestamp,
  responseEvents: [
    {
      data: {
        event: 'message',
        agent: 'user_feedback_processor',
        content: JSON.stringify({ rewritten_text: `${request.action}-${timestamp}` }),
      },
      timestamp,
    },
  ],
})

describe('RewriteMockManager', () => {
  it('plays an exact match and marks later matches as sequence diagnostics', async () => {
    const manager = new RewriteMockManager()
    const first = createRequest()
    const second = createRequest({
      action: 'expand',
      selectedText: 'summary',
      startOffset: 20,
      endOffset: 27,
      userInstruction: 'add detail',
    })

    manager.loadEvents([
      createRewriteEvent(first, 1000),
      createRewriteEvent(second, 2000),
    ])
    manager.setConfig({ enabled: true })

    const played: string[] = []
    const matched = await manager.play(first, (event) => {
      played.push(String(event.data.content))
    }, () => undefined)

    expect(matched).toBe(true)
    expect(played).toEqual([JSON.stringify({ rewritten_text: 'polish-1000' })])

    const diagnostic = manager.diagnose(second)
    expect(diagnostic?.sequenceHint).toBeUndefined()

    const replayedRequestDiagnostic = manager.diagnose(first)
    expect(replayedRequestDiagnostic).not.toBeNull()
    expect(replayedRequestDiagnostic?.sequenceHint).toBeUndefined()
    expect(replayedRequestDiagnostic?.closestRequest).toEqual(second)
  })

  it('returns sequence diagnostics when a later rewrite is requested too early', () => {
    const manager = new RewriteMockManager()
    const first = createRequest()
    const second = createRequest({
      action: 'shorten',
      selectedText: 'summary',
      startOffset: 20,
      endOffset: 27,
    })

    manager.loadEvents([
      createRewriteEvent(first, 1000),
      createRewriteEvent(second, 2000),
    ])
    manager.setConfig({ enabled: true })

    const diagnostic = manager.diagnose(second)

    expect(diagnostic?.sequenceHint).toEqual({
      expectedOrder: 1,
      attemptedOrder: 2,
    })
  })
})
