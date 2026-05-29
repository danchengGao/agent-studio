import { PlayerImpl } from './Player'
import type { RecordingSession } from '../types'

describe('PlayerImpl', () => {
  it('replays interaction replies after their boundary event and reports progress', async () => {
    const player = new PlayerImpl()
    const calls: string[] = []
    const progress: number[] = []

    const session: RecordingSession = {
      id: 'rec-1',
      query: 'test query',
      startTime: 1000,
      endTime: 1200,
      duration: 200,
      eventCount: 2,
      metadata: { conversationId: 'conversation-1' },
      events: [
        {
          data: { event: 'message', agent: 'planner', content: 'step 1' },
          timestamp: 1010,
        },
        {
          data: { event: 'message', agent: 'writer', content: 'step 2' },
          timestamp: 1020,
        },
      ],
      interactionEvents: [
        {
          kind: 'hitl',
          feedback: 'accepted',
          userMessage: 'continue',
          afterEventCount: 1,
          timestamp: 1015,
        },
      ],
      rewriteEvents: [],
    }

    await player.play(session, async (event) => {
      calls.push(`event:${event.agent}`)
    }, {
      onInteraction: async (interaction) => {
        calls.push(`interaction:${interaction.kind}:${interaction.userMessage}`)
      },
      onProgress: (value) => {
        progress.push(value.percentage)
      },
    })

    expect(calls).toEqual([
      'event:planner',
      'interaction:hitl:continue',
      'event:writer',
    ])
    expect(progress.at(-1)).toBe(100)
    expect(player.getState()).toBe('completed')
  })
})
