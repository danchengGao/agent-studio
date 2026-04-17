/**
 * UI-facing hook for replaying recorded main-flow SSE sessions.
 */

import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useRecordingStore } from '../../store'
import type { InteractionEvent, SSEData, PlaybackState } from '../../types'

export interface UsePlaybackReturn {
  status: PlaybackState
  progress: number
  isInitialized: boolean
  play: (
    sessionId: string,
    onEvent: (event: SSEData) => void | Promise<void>,
    onInteraction?: (interaction: InteractionEvent) => void | Promise<void>
  ) => Promise<void>
  pause: () => void
  resume: () => void
  stop: () => void
}

export function usePlayback(): UsePlaybackReturn {
  const {
    isInitialized,
    playbackStatus,
    playbackProgress,
    playRecording,
    pausePlayback,
    resumePlayback,
    stopPlayback,
    init,
  } = useRecordingStore(
    useShallow((state) => ({
      isInitialized: state.isInitialized,
      playbackStatus: state.playbackStatus,
      playbackProgress: state.playbackProgress,
      playRecording: state.playRecording,
      pausePlayback: state.pausePlayback,
      resumePlayback: state.resumePlayback,
      stopPlayback: state.stopPlayback,
      init: state.init,
    }))
  )

  useEffect(() => {
    if (!isInitialized) {
      init().catch(console.error)
    }
  }, [isInitialized, init])

  return {
    status: playbackStatus,
    progress: playbackProgress,
    isInitialized,
    play: playRecording,
    pause: pausePlayback,
    resume: resumePlayback,
    stop: stopPlayback,
  }
}
