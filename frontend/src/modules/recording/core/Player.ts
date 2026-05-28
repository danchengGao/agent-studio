/**
 * Recording module - player implementation.
 */

import type { Player } from './types'
import type {
  InteractionEvent,
  PlaybackOptions,
  PlaybackProgress,
  PlaybackState,
  RecordingSession,
  SSEData,
} from '../types'

export class PlayerImpl implements Player {
  private state: PlaybackState = 'idle'
  private isPaused = false
  private abortController: AbortController | null = null
  private currentProgress: PlaybackProgress = { current: 0, total: 0, percentage: 0 }
  private playbackRunId = 0

  async play(
    session: RecordingSession,
    onEvent: (event: SSEData) => void | Promise<void>,
    options: PlaybackOptions = {}
  ): Promise<void> {
    const { restoreTiming = false, onProgress, onError, onInteraction } = options
    const runId = ++this.playbackRunId

    this.abortController?.abort()

    this.state = 'playing'
    this.isPaused = false
    this.abortController = new AbortController()
    const { signal } = this.abortController

    const interactions = session.interactionEvents || []
    const totalItems = session.events.length + interactions.length
    let processedItems = 0

    this.currentProgress = {
      current: 0,
      total: totalItems,
      percentage: 0,
    }

    const interactionsByEventCount = interactions.reduce<Map<number, InteractionEvent[]>>((map, event) => {
      const items = map.get(event.afterEventCount) || []
      items.push(event)
      map.set(event.afterEventCount, items)
      return map
    }, new Map())

    const emitInteractions = async (afterEventCount: number) => {
      const queued = interactionsByEventCount.get(afterEventCount)
      if (!queued || queued.length === 0) {
        return
      }

      const sortedInteractions = [...queued].sort((a, b) => a.timestamp - b.timestamp)

      // Let the SSE handler flush the boundary event into the UI before the
      // corresponding user reply is replayed, otherwise HITL/outline cards can
      // appear after the replayed input.
      await this.sleep(30)

      for (const interaction of sortedInteractions) {
        if (signal.aborted) {
          break
        }
        while (this.isPaused && !signal.aborted) {
          await this.sleep(100)
        }
        if (signal.aborted) {
          break
        }
        await onInteraction?.(interaction)
        if (signal.aborted || !this.isCurrentRun(runId)) {
          break
        }
        processedItems += 1
        this.updateProgress(processedItems, totalItems, onProgress)
      }
    }

    try {
      let lastTimestamp = session.startTime

      if (interactionsByEventCount.has(0)) {
        await emitInteractions(0)
      }

      for (let i = 0; i < session.events.length; i++) {
        if (signal.aborted) break

        while (this.isPaused && !signal.aborted) {
          await this.sleep(100)
        }
        if (signal.aborted) break

        const recordedEvent = session.events[i]
        const { data, timestamp } = recordedEvent

        await onEvent(data)
        if (signal.aborted || !this.isCurrentRun(runId)) {
          break
        }
        processedItems += 1
        this.updateProgress(processedItems, totalItems, onProgress)

        if (interactionsByEventCount.has(i + 1)) {
          await emitInteractions(i + 1)
        }

        if (restoreTiming) {
          const delay = this.calculateDelay(timestamp, lastTimestamp)
          if (delay > 0) {
            await this.sleep(delay)
          }
        } else {
          await this.sleep(10)
        }

        lastTimestamp = timestamp
      }

      if (this.isCurrentRun(runId)) {
        this.state = signal.aborted ? 'idle' : 'completed'
      }
    } catch (error) {
      if (this.isCurrentRun(runId)) {
        this.state = 'error'
        onError?.(error instanceof Error ? error : new Error(String(error)))
      }
    } finally {
      if (this.isCurrentRun(runId)) {
        this.abortController = null
      }
    }
  }

  pause(): void {
    if (this.state === 'playing') {
      this.isPaused = true
      this.state = 'paused'
    }
  }

  resume(): void {
    if (this.state === 'paused') {
      this.isPaused = false
      this.state = 'playing'
    }
  }

  stop(): void {
    this.playbackRunId++
    this.abortController?.abort()
    this.abortController = null
    this.state = 'idle'
    this.isPaused = false
    this.currentProgress = { current: 0, total: 0, percentage: 0 }
  }

  getState(): PlaybackState {
    return this.state
  }

  getProgress(): PlaybackProgress {
    return this.currentProgress
  }

  private isCurrentRun(runId: number): boolean {
    return this.playbackRunId === runId
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private calculateDelay(currentTimestamp: number, lastTimestamp: number): number {
    return currentTimestamp - lastTimestamp
  }

  private updateProgress(
    current: number,
    total: number,
    onProgress?: (progress: PlaybackProgress) => void
  ): void {
    this.currentProgress = {
      current,
      total,
      percentage: total > 0 ? Math.round((current / total) * 100) : 0,
    }
    onProgress?.(this.currentProgress)
  }
}
