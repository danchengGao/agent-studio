/**
 * 录制模块 - IndexedDB 存储实现
 */

import type { RecordingStorage, ListOptions, StorageStats } from './types'
import type { RecordingMeta, RecordingSession, RecordedEvent } from '../types'
import { RecordingError } from '../types'

const DB_NAME = 'recording_db'
const DB_VERSION = 1
const STORE_NAME = 'recordings'

/**
 * IndexedDB 存储实现
 */
export class IndexedDBStorage implements RecordingStorage {
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  async init(): Promise<void> {
    // 防止重复初始化
    if (this.db) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this.doInit()
    return this.initPromise
  }

  private async doInit(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        reject(RecordingError.storageInitFailed(request.error ?? undefined))
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('startTime', 'startTime', { unique: false })
          store.createIndex('query', 'query', { unique: false })
        }
      }
    })
  }

  private async ensureDb(): Promise<IDBDatabase> {
    if (!this.db) await this.init()
    if (!this.db) throw RecordingError.storageInitFailed()
    return this.db
  }

  async save(session: RecordingSession): Promise<void> {
    const db = await this.ensureDb()

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.put(session)

        request.onsuccess = () => resolve()
        request.onerror = () => reject(RecordingError.storageWriteFailed(request.error ?? undefined))
      } catch (error) {
        reject(RecordingError.storageWriteFailed(error instanceof Error ? error : undefined))
      }
    })
  }

  async get(id: string): Promise<RecordingSession | null> {
    const db = await this.ensureDb()

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.get(id)

        request.onsuccess = () => resolve(request.result || null)
        request.onerror = () => reject(RecordingError.storageReadFailed(request.error ?? undefined))
      } catch (error) {
        reject(RecordingError.storageReadFailed(error instanceof Error ? error : undefined))
      }
    })
  }

  async list(options: ListOptions = {}): Promise<RecordingMeta[]> {
    const { limit, sortBy = 'startTime', sortOrder = 'desc' } = options
    const db = await this.ensureDb()

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const index = store.index(sortBy)
        const direction = sortOrder === 'desc' ? 'prev' : 'next'
        const cursorRequest = index.openCursor(null, direction)

        const results: RecordingMeta[] = []
        let count = 0

        cursorRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
          if (cursor && (!limit || count < limit)) {
            // 只提取元数据，不包含完整事件
            const { events, interactionEvents, rewriteEvents, ...meta } = cursor.value as RecordingSession
            results.push(meta as RecordingMeta)
            count++
            cursor.continue()
          } else {
            resolve(results)
          }
        }

        cursorRequest.onerror = () => reject(RecordingError.storageReadFailed(cursorRequest.error ?? undefined))
      } catch (error) {
        reject(RecordingError.storageReadFailed(error instanceof Error ? error : undefined))
      }
    })
  }

  async delete(id: string): Promise<void> {
    const db = await this.ensureDb()

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.delete(id)

        request.onsuccess = () => resolve()
        request.onerror = () => reject(RecordingError.storageDeleteFailed(request.error ?? undefined))
      } catch (error) {
        reject(RecordingError.storageDeleteFailed(error instanceof Error ? error : undefined))
      }
    })
  }

  async clear(): Promise<void> {
    const db = await this.ensureDb()

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.clear()

        request.onsuccess = () => resolve()
        request.onerror = () => reject(RecordingError.storageDeleteFailed(request.error ?? undefined))
      } catch (error) {
        reject(RecordingError.storageDeleteFailed(error instanceof Error ? error : undefined))
      }
    })
  }

  async appendEvents(id: string, events: RecordedEvent[]): Promise<void> {
    const session = await this.get(id)
    if (!session) {
      throw RecordingError.notFound(id)
    }

    session.events.push(...events)
    session.eventCount = session.events.length

    await this.save(session)
  }

  async getStats(): Promise<StorageStats> {
    const db = await this.ensureDb()

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const countRequest = store.count()

        countRequest.onsuccess = () => {
          const count = countRequest.result

          // 获取时间范围
          const index = store.index('startTime')
          const firstRequest = index.openCursor(null, 'next')
          const lastRequest = index.openCursor(null, 'prev')

          let oldestTime: number | undefined
          let newestTime: number | undefined
          let completed = 0

          const checkComplete = () => {
            completed++
            if (completed === 2) {
              resolve({
                count,
                totalSize: 0, // IndexedDB 不提供准确大小，设为 0
                oldestTime,
                newestTime,
              })
            }
          }

          firstRequest.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
            if (cursor) {
              oldestTime = cursor.value.startTime
            }
            checkComplete()
          }

          firstRequest.onerror = () => checkComplete()

          lastRequest.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
            if (cursor) {
              newestTime = cursor.value.startTime
            }
            checkComplete()
          }

          lastRequest.onerror = () => checkComplete()
        }

        countRequest.onerror = () => reject(RecordingError.storageReadFailed(countRequest.error ?? undefined))
      } catch (error) {
        reject(RecordingError.storageReadFailed(error instanceof Error ? error : undefined))
      }
    })
  }
}
