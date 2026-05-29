/**
 * UI-facing hook for browsing saved recording sessions.
 */

import { useEffect, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useRecordingStore } from '../../store'
import type { RecordingMeta, RecordingSession } from '../../types'
import { RECORDING_EVENTS, addRecordingEventListener } from '../../constants'

export interface UseRecordingListReturn {
  recordings: RecordingMeta[]
  isLoading: boolean
  error: Error | null
  isInitialized: boolean
  refresh: () => Promise<void>
  deleteRecording: (id: string) => Promise<void>
  clearAll: () => Promise<void>
  getFullRecording: (id: string) => Promise<RecordingSession | null>
}

export function useRecordingList(limit = 50): UseRecordingListReturn {
  const {
    isInitialized,
    recordings,
    isLoadingRecordings,
    init,
    loadRecordings,
    deleteRecording: deleteRec,
    clearAllRecordings,
    getRecording,
  } = useRecordingStore(
    useShallow((state) => ({
      isInitialized: state.isInitialized,
      recordings: state.recordings,
      isLoadingRecordings: state.isLoadingRecordings,
      init: state.init,
      loadRecordings: state.loadRecordings,
      deleteRecording: state.deleteRecording,
      clearAllRecordings: state.clearAllRecordings,
      getRecording: state.getRecording,
    }))
  )

  useEffect(() => {
    if (!isInitialized) {
      init().catch(console.error)
    }
  }, [isInitialized, init])

  useEffect(() => {
    if (isInitialized) {
      loadRecordings(limit)
    }
  }, [isInitialized, loadRecordings, limit])

  useEffect(() => {
    const handleRefresh = () => {
      loadRecordings(limit)
    }

    const removeSavedListener = addRecordingEventListener(RECORDING_EVENTS.SAVED, handleRefresh)
    const removeDeletedListener = addRecordingEventListener(RECORDING_EVENTS.DELETED, handleRefresh)

    return () => {
      removeSavedListener()
      removeDeletedListener()
    }
  }, [loadRecordings, limit])

  const refresh = useCallback(async () => {
    await loadRecordings(limit)
  }, [loadRecordings, limit])

  const clearAll = useCallback(async () => {
    await clearAllRecordings()
  }, [clearAllRecordings])

  const getFullRecording = useCallback(
    async (id: string): Promise<RecordingSession | null> => {
      return getRecording(id)
    },
    [getRecording]
  )

  return {
    recordings,
    isLoading: isLoadingRecordings,
    error: null,
    isInitialized,
    refresh,
    deleteRecording: deleteRec,
    clearAll,
    getFullRecording,
  }
}
