/**
 * Recording module - rewrite mock manager
 */

import type { RewriteRequest, RewriteEvent, RecordedEvent } from '../types'
import type { MockConfig, MockManager, MockStats } from './RewriteMiddleware'
import {
  getRewriteMockDiagnostic,
  isFuzzyRewriteRequestMatch,
  isRelaxedRewriteRequestMatch,
  isSameRewriteRequest,
} from '../utils'
import type { RewriteMockDiagnostic } from '../types'

export class RewriteMockManager implements MockManager {
  private events: RewriteEvent[] = []
  private consumedIndexes = new Set<number>()
  private config: MockConfig = {
    enabled: false,
    fuzzyMatch: false,
    playbackSpeed: 1,
  }

  loadEvents(events: RewriteEvent[]): void {
    this.events = [...events]
    this.consumedIndexes.clear()
  }

  clear(): void {
    this.events = []
    this.consumedIndexes.clear()
  }

  hasMatch(request: RewriteRequest): boolean {
    return this.findMatchEntry(request) !== null
  }

  findMatch(request: RewriteRequest): RewriteEvent | null {
    return this.findMatchEntry(request)?.event ?? null
  }

  diagnose(request: RewriteRequest): RewriteMockDiagnostic | null {
    const nextPending = this.findNextPendingEntry()
    if (!nextPending) {
      return null
    }

    const diagnostic = getRewriteMockDiagnostic([nextPending.event.request], request)
    if (!diagnostic) {
      return null
    }

    const laterMatch = this.findLaterPendingMatchEntry(request, nextPending.index)
    if (!laterMatch) {
      return diagnostic
    }

    return {
      ...diagnostic,
      sequenceHint: {
        expectedOrder: nextPending.index + 1,
        attemptedOrder: laterMatch.index + 1,
      },
    }
  }

  async play(
    request: RewriteRequest,
    onEvent: (event: RecordedEvent) => void,
    onComplete: () => void
  ): Promise<boolean> {
    if (!this.config.enabled) {
      onComplete()
      return false
    }

    const match = this.findMatchEntry(request)
    if (!match) {
      onComplete()
      return false
    }

    this.consumedIndexes.add(match.index)

    const speed = this.getPlaybackSpeed()

    try {
      for (let index = 0; index < match.event.responseEvents.length; index++) {
        const current = match.event.responseEvents[index]
        onEvent(current)

        const next = match.event.responseEvents[index + 1]
        if (!next) continue

        const delay = Math.max(0, next.timestamp - current.timestamp) / speed
        if (delay > 0) {
          await this.sleep(Math.min(delay, 1000))
        }
      }

      onComplete()
      return true
    } catch (error) {
      this.consumedIndexes.delete(match.index)
      throw error
    }
  }

  setConfig(config: MockConfig): void {
    this.config = {
      ...this.config,
      ...config,
    }
  }

  getStats(): MockStats {
    const byAction: Record<string, number> = {}
    for (const event of this.events) {
      byAction[event.request.action] = (byAction[event.request.action] ?? 0) + 1
    }

    return {
      totalEvents: this.events.length,
      byAction,
    }
  }

  private getPlaybackSpeed(): number {
    const speed = this.config.playbackSpeed ?? 1
    return speed > 0 ? speed : 1
  }

  private findMatchEntry(
    request: RewriteRequest
  ): { event: RewriteEvent; index: number } | null {
    const nextPending = this.findNextPendingEntry()
    if (!nextPending) return null

    if (this.isExactMatch(nextPending.event.request, request)) {
      return nextPending
    }

    if (this.isRelaxedMatch(nextPending.event.request, request)) {
      return nextPending
    }

    if (this.config.fuzzyMatch && this.isFuzzyMatch(nextPending.event.request, request)) {
      return nextPending
    }

    return null
  }

  private findNextPendingEntry(): { event: RewriteEvent; index: number } | null {
    for (let index = 0; index < this.events.length; index++) {
      if (this.consumedIndexes.has(index)) {
        continue
      }

      return {
        event: this.events[index],
        index,
      }
    }

    return null
  }

  private findLaterPendingMatchEntry(
    request: RewriteRequest,
    afterIndex: number
  ): { event: RewriteEvent; index: number } | null {
    for (let index = afterIndex + 1; index < this.events.length; index++) {
      if (this.consumedIndexes.has(index)) {
        continue
      }

      const candidate = this.events[index]
      if (
        this.isExactMatch(candidate.request, request) ||
        this.isRelaxedMatch(candidate.request, request) ||
        (this.config.fuzzyMatch && this.isFuzzyMatch(candidate.request, request))
      ) {
        return {
          event: candidate,
          index,
        }
      }
    }

    return null
  }

  private isExactMatch(source: RewriteRequest, target: RewriteRequest): boolean {
    return isSameRewriteRequest(source, target)
  }

  private isRelaxedMatch(source: RewriteRequest, target: RewriteRequest): boolean {
    return isRelaxedRewriteRequestMatch(source, target)
  }

  private isFuzzyMatch(source: RewriteRequest, target: RewriteRequest): boolean {
    return isFuzzyRewriteRequestMatch(source, target)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
