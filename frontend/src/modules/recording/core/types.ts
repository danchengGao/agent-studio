/**
 * Recording module core interfaces.
 */

import type {
  InteractionEvent,
  PlaybackOptions,
  PlaybackProgress,
  PlaybackState,
  RecordingConfig,
  RecordingSession,
  RewriteRequest,
  SSEData,
} from '../types'

export interface Recorder {
  start(config: RecordingConfig): Promise<string>
  continueSession(config: RecordingConfig): Promise<string>
  record(event: SSEData): void
  stop(): Promise<RecordingSession>
  isRecording(): boolean
  getCurrentRecordingId(): string | null
  recordInteraction(event: Omit<InteractionEvent, 'afterEventCount' | 'timestamp'>): void
  startRewriteRecording(request: RewriteRequest): void
  recordRewriteEvent(event: SSEData): void
  stopRewriteRecording(): void
  isRewriteRecording(): boolean
}

export interface Player {
  play(
    session: RecordingSession,
    onEvent: (event: SSEData) => void | Promise<void>,
    options?: PlaybackOptions
  ): Promise<void>
  pause(): void
  resume(): void
  stop(): void
  getState(): PlaybackState
  getProgress(): PlaybackProgress
}

export interface RecorderDeps {
  storage: import('../storage/types').RecordingStorage
}

export interface PlayerDeps {
  // No external dependencies yet.
}
