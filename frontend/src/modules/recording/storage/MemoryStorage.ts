/**
 * 录制模块 - 内存存储实现（用于测试）
 */

import type { RecordingStorage, ListOptions, StorageStats } from './types'
import type { RecordingMeta, RecordingSession, RecordedEvent } from '../types'

/**
 * 内存存储实现
 * 用于测试或临时存储场景
 */
export class MemoryStorage implements RecordingStorage {
  private recordings: Map<string, RecordingSession> = new Map()

  async init(): Promise<void> {
    // 无需初始化
  }

  async save(session: RecordingSession): Promise<void> {
    this.recordings.set(session.id, { ...session })
  }

  async get(id: string): Promise<RecordingSession | null> {
    const session = this.recordings.get(id)
    return session
      ? {
          ...session,
          events: [...session.events],
          interactionEvents: [...(session.interactionEvents || [])],
          rewriteEvents: [...(session.rewriteEvents || [])],
        }
      : null
  }

  async list(options: ListOptions = {}): Promise<RecordingMeta[]> {
    const { limit, sortBy = 'startTime', sortOrder = 'desc' } = options

    let results = Array.from(this.recordings.values())

    // 排序
    results.sort((a, b) => {
      const aVal = a[sortBy] ?? 0
      const bVal = b[sortBy] ?? 0
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal
    })

    // 限制数量
    if (limit !== undefined) {
      results = results.slice(0, limit)
    }

    // 只返回元数据
    return results.map(({ events, interactionEvents, rewriteEvents, ...meta }) => meta as RecordingMeta)
  }

  async delete(id: string): Promise<void> {
    this.recordings.delete(id)
  }

  async clear(): Promise<void> {
    this.recordings.clear()
  }

  async appendEvents(id: string, events: RecordedEvent[]): Promise<void> {
    const session = this.recordings.get(id)
    if (!session) {
      throw new Error(`Recording ${id} not found`)
    }

    session.events.push(...events)
    session.eventCount = session.events.length
  }

  async getStats(): Promise<StorageStats> {
    const recordings = Array.from(this.recordings.values())
    const times = recordings.map(r => r.startTime)

    return {
      count: recordings.length,
      totalSize: recordings.reduce((sum, r) => sum + JSON.stringify(r).length, 0),
      oldestTime: times.length > 0 ? Math.min(...times) : undefined,
      newestTime: times.length > 0 ? Math.max(...times) : undefined,
    }
  }

  /** 仅用于测试：获取所有录制（完整数据） */
  getAll(): RecordingSession[] {
    return Array.from(this.recordings.values()).map(s => ({
      ...s,
      events: [...s.events],
      interactionEvents: [...(s.interactionEvents || [])],
      rewriteEvents: [...(s.rewriteEvents || [])],
    }))
  }
}
