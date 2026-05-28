/**
 * Recording module - SSE recording middleware.
 */

import type { Middleware } from './types'
import type { SSEData } from '../types'
import type { Recorder } from '../core/types'

export interface SSEMiddlewareDeps {
  recorder: Recorder
}

/**
 * Records SSE events while always forwarding them to the business pipeline.
 */
export class SSERecordingMiddleware implements Middleware<SSEData> {
  readonly name = 'sse-recording'
  enabled = false

  constructor(private deps: SSEMiddlewareDeps) {}

  intercept(event: SSEData, next: (event: SSEData) => void): void {
    if (this.enabled && this.deps.recorder.isRecording()) {
      this.deps.recorder.record(event)
    }

    // Recording must stay transparent to the main product flow.
    next(event)
  }
}
