/**
 * Recording module - rewrite middleware
 */

import type { Middleware } from './types'
import type { RewriteRequest, RewriteEvent, RecordedEvent } from '../types'

export interface RewriteMiddlewareDeps {
  hasMatch: (request: RewriteRequest) => boolean
  play: (
    request: RewriteRequest,
    onEvent: (event: RecordedEvent) => void,
    onComplete: () => void
  ) => Promise<boolean>
}

export class RewriteMiddleware implements Middleware<RewriteRequest> {
  readonly name = 'rewrite'
  enabled = false

  constructor(private deps: RewriteMiddlewareDeps) {}

  intercept(request: RewriteRequest, next: (request: RewriteRequest) => void): void {
    if (this.enabled && this.deps.hasMatch(request)) {
      console.log('[RewriteMiddleware] Intercepted rewrite request:', request.action)
      return
    }
    next(request)
  }

  shouldIntercept(request: RewriteRequest): boolean {
    return this.enabled && this.deps.hasMatch(request)
  }

  async playMock(
    request: RewriteRequest,
    onEvent: (event: RecordedEvent) => void
  ): Promise<boolean> {
    if (!this.enabled || !this.deps.hasMatch(request)) {
      return false
    }

    return this.deps.play(request, onEvent, () => undefined)
  }
}

export interface MockManager {
  loadEvents(events: RewriteEvent[]): void
  clear(): void
  hasMatch(request: RewriteRequest): boolean
  findMatch(request: RewriteRequest): RewriteEvent | null
  play(
    request: RewriteRequest,
    onEvent: (event: RecordedEvent) => void,
    onComplete: () => void
  ): Promise<boolean>
  setConfig(config: MockConfig): void
  getStats(): MockStats
}

export interface MockConfig {
  enabled: boolean
  fuzzyMatch?: boolean
  playbackSpeed?: number
}

export interface MockStats {
  totalEvents: number
  byAction: Record<string, number>
}
