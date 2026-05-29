/**
 * 录制模块 - 存储层类型定义
 */

import type { RecordingMeta, RecordingSession, RecordedEvent } from '../types'

/** 列表查询选项 */
export interface ListOptions {
  /** 限制数量 */
  limit?: number
  /** 偏移量 */
  offset?: number
  /** 排序字段 */
  sortBy?: 'startTime' | 'endTime'
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc'
}

/** 存储接口 */
export interface RecordingStorage {
  /** 初始化存储 */
  init(): Promise<void>

  /** 保存录制会话 */
  save(session: RecordingSession): Promise<void>

  /** 获取单个录制 */
  get(id: string): Promise<RecordingSession | null>

  /** 获取录制列表（不含完整事件） */
  list(options?: ListOptions): Promise<RecordingMeta[]>

  /** 删除录制 */
  delete(id: string): Promise<void>

  /** 清空所有 */
  clear(): Promise<void>

  /** 追加事件到现有录制 */
  appendEvents(id: string, events: RecordedEvent[]): Promise<void>

  /** 获取存储统计信息 */
  getStats(): Promise<StorageStats>
}

/** 存储统计信息 */
export interface StorageStats {
  /** 录制数量 */
  count: number
  /** 总大小（字节） */
  totalSize: number
  /** 最早录制时间 */
  oldestTime?: number
  /** 最新录制时间 */
  newestTime?: number
}
