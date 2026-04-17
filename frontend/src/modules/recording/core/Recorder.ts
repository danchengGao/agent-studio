/**
 * Recording module - recorder implementation
 */

import type { Recorder, RecorderDeps } from './types'
import type {
  InteractionEvent,
  SSEData,
  RecordingSession,
  RecordingConfig,
  RewriteEvent,
  RewriteRequest,
} from '../types'
import { RecordingError } from '../types'

export class RecorderImpl implements Recorder {
  private state: 'idle' | 'recording' = 'idle'
  private currentSession: RecordingSession | null = null
  private currentRewriteEvent: RewriteEvent | null = null
  private rewriteTargetSession: RecordingSession | null = null

  constructor(private deps: RecorderDeps) {}

  async start(config: RecordingConfig): Promise<string> {
    if (this.state !== 'idle') {
      throw RecordingError.invalidState('Already recording')
    }

    this.currentRewriteEvent = null
    this.rewriteTargetSession = null

    const id = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    this.currentSession = {
      id,
      query: config.query,
      startTime: Date.now(),
      endTime: Date.now(),
      duration: 0,
      eventCount: 0,
      events: [],
      interactionEvents: [],
      rewriteEvents: [],
      metadata: config.metadata || {},
    }

    this.state = 'recording'
    console.log('[Recorder] Started recording:', id)
    return id
  }

  async continueSession(config: RecordingConfig): Promise<string> {
    if (this.state !== 'idle') {
      throw RecordingError.invalidState('Already recording')
    }

    if (!this.rewriteTargetSession) {
      throw RecordingError.invalidState('No session available to continue')
    }

    this.currentRewriteEvent = null
    this.currentSession = this.cloneSession(this.rewriteTargetSession)
    this.currentSession.metadata = {
      ...(this.currentSession.metadata || {}),
      ...(config.metadata || {}),
    }
    this.state = 'recording'

    console.log('[Recorder] Continuing recording:', this.currentSession.id)
    return this.currentSession.id
  }

  record(event: SSEData): void {
    if (this.state !== 'recording' || !this.currentSession) {
      return
    }

    this.currentSession.events.push({
      data: event,
      timestamp: Date.now(),
    })
    this.currentSession.eventCount = this.currentSession.events.length
  }

  recordInteraction(event: Omit<InteractionEvent, 'afterEventCount' | 'timestamp'>): void {
    if (this.state !== 'recording' || !this.currentSession) {
      return
    }

    if (!this.currentSession.interactionEvents) {
      this.currentSession.interactionEvents = []
    }

    this.currentSession.interactionEvents.push({
      ...event,
      afterEventCount: this.currentSession.events.length,
      timestamp: Date.now(),
    })
  }

  async stop(): Promise<RecordingSession> {
    if (this.state !== 'recording' || !this.currentSession) {
      throw RecordingError.invalidState('Not recording')
    }

    this.state = 'idle'
    const now = Date.now()
    const session: RecordingSession = {
      ...this.cloneSession(this.currentSession),
      endTime: now,
      duration: now - this.currentSession.startTime,
      eventCount: this.currentSession.events.length,
    }

    if (!session.rewriteEvents) {
      session.rewriteEvents = []
    }
    if (!session.interactionEvents) {
      session.interactionEvents = []
    }

    await this.deps.storage.save(session)

    this.rewriteTargetSession = this.cloneSession(session)
    this.currentSession = null

    console.log('[Recorder] Stopped recording:', session.id, 'events:', session.eventCount)
    return session
  }

  isRecording(): boolean {
    return this.state === 'recording'
  }

  getCurrentRecordingId(): string | null {
    return this.currentSession?.id || null
  }

  startRewriteRecording(request: RewriteRequest): void {
    if (this.currentSession) {
      this.rewriteTargetSession = this.currentSession
    } else if (!this.rewriteTargetSession) {
      console.warn('[Recorder] No recording session available for rewrite')
      return
    }

    this.currentRewriteEvent = {
      request,
      responseEvents: [],
      timestamp: Date.now(),
    }

    console.log(
      '[Recorder] Started recording rewrite:',
      request.action,
      'target session:',
      this.rewriteTargetSession?.id
    )
  }

  recordRewriteEvent(event: SSEData): void {
    if (!this.currentRewriteEvent) {
      console.warn('[Recorder] No active rewrite recording')
      return
    }

    this.currentRewriteEvent.responseEvents.push({
      data: event,
      timestamp: Date.now(),
    })
  }

  async stopRewriteRecording(): Promise<void> {
    if (!this.currentRewriteEvent || !this.rewriteTargetSession) {
      return
    }

    const event = this.currentRewriteEvent
    this.rewriteTargetSession.rewriteEvents = this.rewriteTargetSession.rewriteEvents || []
    this.rewriteTargetSession.rewriteEvents.push(event)
    this.rewriteTargetSession.metadata = {
      ...(this.rewriteTargetSession.metadata || {}),
      rewriteCount: this.rewriteTargetSession.rewriteEvents.length,
    }
    this.currentRewriteEvent = null

    if (this.currentSession?.id === this.rewriteTargetSession.id) {
      this.currentSession = this.cloneSession(this.rewriteTargetSession)
    }

    await this.deps.storage.save(this.rewriteTargetSession)
    this.rewriteTargetSession = this.cloneSession(this.rewriteTargetSession)

    console.log(
      '[Recorder] Saved rewrite event, total:',
      this.rewriteTargetSession.rewriteEvents?.length ?? 0
    )
  }

  isRewriteRecording(): boolean {
    return this.currentRewriteEvent !== null
  }

  canRecordRewrite(): boolean {
    return this.currentSession !== null || this.rewriteTargetSession !== null
  }

  private cloneSession(session: RecordingSession): RecordingSession {
    return {
      ...session,
      metadata: session.metadata ? { ...session.metadata } : undefined,
      events: session.events.map((event) => ({ ...event, data: { ...event.data } })),
      interactionEvents: (session.interactionEvents || []).map((event) => ({ ...event })),
      rewriteEvents: (session.rewriteEvents || []).map((event) => ({
        ...event,
        request: { ...event.request },
        responseEvents: event.responseEvents.map((responseEvent) => ({
          ...responseEvent,
          data: { ...responseEvent.data },
        })),
      })),
    }
  }
}
