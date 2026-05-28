import type { InteractionEvent, RewriteMockDiagnostic, RewriteRequest, SSEData } from './types'

// Typed browser events used by the recording module to communicate with
// surrounding UI without scattering raw event strings across the app.
export const RECORDING_EVENTS = {
  SAVED: 'sse-recording-saved',
  DELETED: 'sse-recording-deleted',
  PLAYBACK_EVENT: 'sse-playback-event',
  PLAYBACK_INTERACTION: 'sse-playback-interaction',
  MOCK_RESULT: 'recording-mock-result',
} as const

export interface PlaybackEventDetail {
  data: SSEData
  conversationId: string
}

export interface PlaybackInteractionDetail {
  interaction: InteractionEvent
  conversationId: string
}

export interface MockResultEventDetail {
  request: RewriteRequest
  matched: boolean
  diagnostic?: RewriteMockDiagnostic | null
}

export interface RecordingEventDetailMap {
  [RECORDING_EVENTS.SAVED]: undefined
  [RECORDING_EVENTS.DELETED]: undefined
  [RECORDING_EVENTS.PLAYBACK_EVENT]: PlaybackEventDetail
  [RECORDING_EVENTS.PLAYBACK_INTERACTION]: PlaybackInteractionDetail
  [RECORDING_EVENTS.MOCK_RESULT]: MockResultEventDetail
}

type RecordingEventName = keyof RecordingEventDetailMap

type RecordingEventListener<K extends RecordingEventName> =
  RecordingEventDetailMap[K] extends undefined
    ? () => void
    : (detail: RecordingEventDetailMap[K]) => void

export function dispatchRecordingEvent<K extends RecordingEventName>(
  type: K,
  detail: RecordingEventDetailMap[K]
): void {
  if (typeof window === 'undefined') {
    return
  }

  if (detail === undefined) {
    window.dispatchEvent(new Event(type))
    return
  }

  window.dispatchEvent(new CustomEvent(type, { detail }))
}

export function addRecordingEventListener<K extends RecordingEventName>(
  type: K,
  listener: RecordingEventListener<K>
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const handler: EventListener = (event) => {
    if (event instanceof CustomEvent) {
      ;(listener as (detail: RecordingEventDetailMap[K]) => void)(event.detail)
      return
    }

    ;(listener as () => void)()
  }

  window.addEventListener(type, handler)

  return () => {
    window.removeEventListener(type, handler)
  }
}
