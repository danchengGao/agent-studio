/**
 * 录制模块 - 中间件类型定义
 */

/**
 * 中间件接口
 * @template T - 处理的数据类型
 */
export interface Middleware<T = unknown> {
  /** 中间件名称，用于调试和管理 */
  readonly name: string

  /** 是否启用 */
  enabled: boolean

  /**
   * 拦截处理
   * @param data - 输入数据
   * @param next - 调用下一个中间件或最终处理器
   */
  intercept(data: T, next: (data: T) => void): void
}

/**
 * 中间件管理器接口
 */
export interface MiddlewareManager<T = unknown> {
  /** 注册中间件 */
  use(middleware: Middleware<T>): void

  /** 移除中间件 */
  remove(name: string): void

  /** 启用/禁用中间件 */
  toggle(name: string, enabled: boolean): void

  /** 获取中间件 */
  get(name: string): Middleware<T> | undefined

  /** 处理数据（依次通过所有中间件） */
  process(data: T, finalHandler: (data: T) => void): void
}

/**
 * 中间件上下文（可选，用于传递额外信息）
 */
export interface MiddlewareContext {
  /** 录制 ID */
  recordingId?: string
  /** 时间戳 */
  timestamp: number
  /** 额外元数据 */
  metadata?: Record<string, unknown>
}
