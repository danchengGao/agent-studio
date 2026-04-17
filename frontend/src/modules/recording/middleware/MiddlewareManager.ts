/**
 * 录制模块 - 中间件管理器实现
 */

import type { Middleware, MiddlewareManager } from './types'

/**
 * 中间件管理器实现
 */
export class MiddlewareManagerImpl<T = unknown> implements MiddlewareManager<T> {
  private middlewares: Map<string, Middleware<T>> = new Map()
  private order: string[] = []

  use(middleware: Middleware<T>): void {
    if (this.middlewares.has(middleware.name)) {
      throw new Error(`Middleware "${middleware.name}" already registered`)
    }
    this.middlewares.set(middleware.name, middleware)
    this.order.push(middleware.name)
    console.log(`[MiddlewareManager] Registered: ${middleware.name}`)
  }

  remove(name: string): void {
    if (this.middlewares.has(name)) {
      this.middlewares.delete(name)
      this.order = this.order.filter(n => n !== name)
      console.log(`[MiddlewareManager] Removed: ${name}`)
    }
  }

  toggle(name: string, enabled: boolean): void {
    const middleware = this.middlewares.get(name)
    if (middleware) {
      middleware.enabled = enabled
      console.log(`[MiddlewareManager] Toggled ${name}: ${enabled}`)
    }
  }

  get(name: string): Middleware<T> | undefined {
    return this.middlewares.get(name)
  }

  process(data: T, finalHandler: (data: T) => void): void {
    let index = 0

    const runNext = (currentData: T): void => {
      // 找到下一个启用的中间件
      while (index < this.order.length) {
        const name = this.order[index++]
        const middleware = this.middlewares.get(name)!

        if (!middleware.enabled) continue

        try {
          middleware.intercept(currentData, runNext)
          return
        } catch (error) {
          console.error(`[MiddlewareManager] Middleware "${name}" error:`, error)
          // 继续执行下一个中间件
          continue
        }
      }

      // 所有中间件处理完毕，执行最终处理器
      finalHandler(currentData)
    }

    runNext(data)
  }

  /**
   * 获取所有已注册的中间件名称
   */
  getNames(): string[] {
    return [...this.order]
  }

  /**
   * 检查是否有中间件正在启用
   */
  hasEnabled(): boolean {
    for (const name of this.order) {
      const middleware = this.middlewares.get(name)
      if (middleware?.enabled) return true
    }
    return false
  }
}
