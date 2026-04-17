/**
 * UI-facing hook for main-flow recording.
 */

import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useRecordingStore } from '../../store'
import type { RecordingSession, SSEData } from '../../types'

export interface UseRecordingReturn {
  isRecording: boolean
  currentRecordingId: string | null
  isInitialized: boolean
  start: (query: string, metadata?: Record<string, unknown>) => Promise<string>
  continueSession: (query: string, metadata?: Record<string, unknown>) => Promise<string>
  stop: () => Promise<RecordingSession | null>
  recordEvent: (event: SSEData) => void
  enableMiddleware: () => void
  disableMiddleware: () => void
}

export function useRecording(): UseRecordingReturn {
  const {
    isInitialized,
    isRecording,
    currentRecordingId,
    startRecording,
    continueRecording,
    recordEvent,
    stopRecording,
    enableRecordingMiddleware,
    disableRecordingMiddleware,
    init,
  } = useRecordingStore(
    useShallow((state) => ({
      isInitialized: state.isInitialized,
      isRecording: state.isRecording,
      currentRecordingId: state.currentRecordingId,
      startRecording: state.startRecording,
      continueRecording: state.continueRecording,
      recordEvent: state.recordEvent,
      stopRecording: state.stopRecording,
      enableRecordingMiddleware: state.enableRecordingMiddleware,
      disableRecordingMiddleware: state.disableRecordingMiddleware,
      init: state.init,
    }))
  )

  // Hooks initialize the module lazily so callers do not need a separate setup step.
  useEffect(() => {
    if (!isInitialized) {
      init().catch(console.error)
    }
  }, [isInitialized, init])

  return {
    isRecording,
    currentRecordingId,
    isInitialized,
    start: startRecording,
    continueSession: continueRecording,
    stop: stopRecording,
    recordEvent,
    enableMiddleware: enableRecordingMiddleware,
    disableMiddleware: disableRecordingMiddleware,
  }
}
