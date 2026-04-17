import { useCallback, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { RECORDING_EVENTS, addRecordingEventListener, dispatchRecordingEvent } from '../constants'
import { useRecordingModule, useRecordingStore } from '../store'
import { useRecording } from '../ui/hooks'
import type {
  PlaybackEventDetail,
  PlaybackInteractionDetail,
} from '../constants'
import type { InteractionEvent, RecordedEvent, RewriteRequest, SSEData } from '../types'

export interface DeepSearchRecordingHandle {
  isActive: () => boolean
  record: (event: SSEData) => void
  recordInteraction: (event: Omit<InteractionEvent, 'afterEventCount' | 'timestamp'>) => void
  stop: () => Promise<void>
}

interface CreateMainFlowRecordingOptions {
  enabled: boolean
  query: string
  metadata?: Record<string, unknown>
  continueSession?: boolean
}

interface CreateRewriteRecordingOptions {
  enabled: boolean
  request: RewriteRequest
}

export function usePlaybackEventBridge(
  onPlaybackEvent: (detail: PlaybackEventDetail) => void,
  onPlaybackInteraction?: (detail: PlaybackInteractionDetail) => void
): void {
  useEffect(() => {
    const removePlaybackListener = addRecordingEventListener(
      RECORDING_EVENTS.PLAYBACK_EVENT,
      onPlaybackEvent
    )
    const removeInteractionListener = onPlaybackInteraction
      ? addRecordingEventListener(RECORDING_EVENTS.PLAYBACK_INTERACTION, onPlaybackInteraction)
      : () => undefined

    return () => {
      removePlaybackListener()
      removeInteractionListener()
    }
  }, [onPlaybackEvent, onPlaybackInteraction])
}

export function useDeepSearchRecordingBridge() {
  const { playRewriteMock, diagnoseRewriteMock } = useRecordingModule()
  const {
    start: startRecording,
    continueSession,
    stop: stopRecording,
    recordEvent,
  } = useRecording()
  const {
    recordInteraction,
    startRewriteRecording,
    recordRewriteEvent,
    stopRewriteRecording,
    canRecordRewrite,
    isRewriteRecording,
  } = useRecordingStore(
    useShallow((state) => ({
      recordInteraction: state.recordInteraction,
      startRewriteRecording: state.startRewriteRecording,
      recordRewriteEvent: state.recordRewriteEvent,
      stopRewriteRecording: state.stopRewriteRecording,
      canRecordRewrite: state.canRecordRewrite,
      isRewriteRecording: state.isRewriteRecording,
    }))
  )

  const isMainFlowRecordingActive = useCallback(() => useRecordingStore.getState().isRecording, [])

  const createMainFlowRecording = useCallback(
    async (options: CreateMainFlowRecordingOptions): Promise<DeepSearchRecordingHandle | null> => {
      if (!options.enabled) {
        return null
      }

      try {
        if (options.continueSession) {
          try {
            await continueSession(options.query, options.metadata)
          } catch (error) {
            console.warn(
              '[DeepSearchRecordingBridge] Failed to continue session, falling back to a new recording:',
              error
            )
            await startRecording(options.query, options.metadata)
          }
        } else {
          await startRecording(options.query, options.metadata)
        }

        let active = true

        return {
          isActive: () => active && isMainFlowRecordingActive(),
          record: (event) => {
            if (!active || !isMainFlowRecordingActive()) {
              return
            }

            recordEvent(event)
          },
          recordInteraction: (event) => {
            if (!active || !isMainFlowRecordingActive()) {
              return
            }

            recordInteraction(event)
          },
          stop: async () => {
            if (!active) {
              return
            }

            active = false
            if (isMainFlowRecordingActive()) {
              await stopRecording()
            }
          },
        }
      } catch (error) {
        console.warn('[DeepSearchRecordingBridge] Failed to start main recording:', error)
        return null
      }
    },
    [
      continueSession,
      isMainFlowRecordingActive,
      recordEvent,
      recordInteraction,
      startRecording,
      stopRecording,
    ]
  )

  const createRewriteRecording = useCallback(
    (options: CreateRewriteRecordingOptions): DeepSearchRecordingHandle | null => {
      if (!options.enabled || !canRecordRewrite()) {
        return null
      }

      startRewriteRecording(options.request)
      if (!isRewriteRecording()) {
        return null
      }

      let active = true

      return {
        isActive: () => active && isRewriteRecording(),
        record: (event) => {
          if (!active || !isRewriteRecording()) {
            return
          }

          recordRewriteEvent(event)
        },
        recordInteraction: () => {
          return
        },
        stop: async () => {
          if (!active) {
            return
          }

          active = false
          if (isRewriteRecording()) {
            await stopRewriteRecording()
          }
        },
      }
    },
    [
      canRecordRewrite,
      isRewriteRecording,
      recordRewriteEvent,
      startRewriteRecording,
      stopRewriteRecording,
    ]
  )

  const tryMockRewrite = useCallback(
    async (
      request: RewriteRequest,
      onEvent: (event: RecordedEvent) => void
    ): Promise<boolean> => {
      const matched = await playRewriteMock(request, onEvent)
      const diagnostic = matched ? null : diagnoseRewriteMock(request)

      dispatchRecordingEvent(RECORDING_EVENTS.MOCK_RESULT, {
        request,
        matched,
        diagnostic,
      })

      return matched
    },
    [diagnoseRewriteMock, playRewriteMock]
  )

  return {
    createMainFlowRecording,
    createRewriteRecording,
    tryMockRewrite,
  }
}
