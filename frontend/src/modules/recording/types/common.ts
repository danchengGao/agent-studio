/**
 * Recording module shared types.
 */

import type { InteractionEvent, RecordedEvent, RewriteEvent } from './events'

export interface RecordingMeta {
  id: string
  query: string
  startTime: number
  endTime: number
  duration: number
  eventCount: number
  metadata?: Record<string, unknown>
}

export interface RecordingSession extends RecordingMeta {
  events: RecordedEvent[]
  interactionEvents?: InteractionEvent[]
  rewriteEvents?: RewriteEvent[]
}

export interface RecordingModuleConfig {
  storage?: import('../storage/types').RecordingStorage
}

export type PlaybackState = 'idle' | 'playing' | 'paused' | 'completed' | 'error'

export interface PlaybackProgress {
  current: number
  total: number
  percentage: number
}

export interface RecordingConfig {
  query: string
  metadata?: Record<string, unknown>
  continueCurrentSession?: boolean
}

export interface PlaybackOptions {
  restoreTiming?: boolean
  onProgress?: (progress: PlaybackProgress) => void
  onError?: (error: Error) => void
  onInteraction?: (interaction: InteractionEvent) => void | Promise<void>
}
