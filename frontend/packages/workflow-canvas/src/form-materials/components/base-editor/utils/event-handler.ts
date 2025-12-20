/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

export type EventCallback = (...args: any[]) => void
export type EventType = string

export interface EventSubscription {
  id: string
  event: EventType
  callback: EventCallback
  once: boolean
}

/**
 * Event Handler for managing editor events
 */
export class EventHandler {
  private listeners: Map<EventType, EventSubscription[]>
  private subscriptionIdCounter: number

  constructor() {
    this.listeners = new Map()
    this.subscriptionIdCounter = 0
  }

  /**
   * Subscribe to an event
   */
  on(event: EventType, callback: EventCallback): string {
    const subscriptionId = this.generateSubscriptionId()
    const subscription: EventSubscription = {
      id: subscriptionId,
      event,
      callback,
      once: false,
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }

    this.listeners.get(event)!.push(subscription)
    return subscriptionId
  }

  /**
   * Subscribe to an event (only once)
   */
  once(event: EventType, callback: EventCallback): string {
    const subscriptionId = this.generateSubscriptionId()
    const subscription: EventSubscription = {
      id: subscriptionId,
      event,
      callback,
      once: true,
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }

    this.listeners.get(event)!.push(subscription)
    return subscriptionId
  }

  /**
   * Unsubscribe from an event
   */
  off(event: EventType, callback: EventCallback): void {
    const eventListeners = this.listeners.get(event)
    if (!eventListeners) return

    const index = eventListeners.findIndex(sub => sub.callback === callback)
    if (index !== -1) {
      eventListeners.splice(index, 1)
    }

    if (eventListeners.length === 0) {
      this.listeners.delete(event)
    }
  }

  /**
   * Unsubscribe by subscription ID
   */
  offById(subscriptionId: string): void {
    for (const [event, subscriptions] of this.listeners.entries()) {
      const index = subscriptions.findIndex(sub => sub.id === subscriptionId)
      if (index !== -1) {
        subscriptions.splice(index, 1)
        if (subscriptions.length === 0) {
          this.listeners.delete(event)
        }
        break
      }
    }
  }

  /**
   * Emit an event
   */
  emit(event: EventType, ...args: any[]): void {
    const eventListeners = this.listeners.get(event)
    if (!eventListeners) return

    const onceSubscriptions: EventSubscription[] = []

    for (const subscription of eventListeners) {
      try {
        subscription.callback(...args)

        if (subscription.once) {
          onceSubscriptions.push(subscription)
        }
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error)
      }
    }

    // Remove once subscriptions
    for (const subscription of onceSubscriptions) {
      this.offById(subscription.id)
    }
  }

  /**
   * Check if there are listeners for an event
   */
  hasListeners(event: EventType): boolean {
    const eventListeners = this.listeners.get(event)
    return eventListeners ? eventListeners.length > 0 : false
  }

  /**
   * Get the number of listeners for an event
   */
  getListenerCount(event: EventType): number {
    const eventListeners = this.listeners.get(event)
    return eventListeners ? eventListeners.length : 0
  }

  /**
   * Get all event types that have listeners
   */
  getEventTypes(): EventType[] {
    return Array.from(this.listeners.keys())
  }

  /**
   * Get all subscriptions for an event
   */
  getSubscriptions(event: EventType): EventSubscription[] {
    return this.listeners.get(event) ? [...this.listeners.get(event)!] : []
  }

  /**
   * Remove all listeners for a specific event
   */
  removeAllListeners(event?: EventType): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }

  /**
   * Create an event emitter for a specific context
   */
  createEmitter(context: string = 'default') {
    return {
      on: (event: EventType, callback: EventCallback) =>
        this.on(`${context}:${event}`, callback),
      once: (event: EventType, callback: EventCallback) =>
        this.once(`${context}:${event}`, callback),
      off: (event: EventType, callback: EventCallback) =>
        this.off(`${context}:${event}`, callback),
      emit: (event: EventType, ...args: any[]) =>
        this.emit(`${context}:${event}`, ...args),
    }
  }

  /**
   * Wait for an event to be emitted
   */
  waitFor(event: EventType, timeout: number = 5000): Promise<any[]> {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
      }

      this.once(event, (...args: any[]) => {
        cleanup()
        resolve(args)
      })

      timeoutId = setTimeout(() => {
        cleanup()
        reject(new Error(`Timeout waiting for event: ${event}`))
      }, timeout)
    })
  }

  /**
   * Chain multiple events
   */
  chain(events: EventType[]): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[][] = []
      let completedEvents = 0

      const eventHandler = (event: EventType, ...args: any[]) => {
        results[events.indexOf(event)] = args
        completedEvents++

        if (completedEvents === events.length) {
          resolve(results)
        }
      }

      events.forEach(event => {
        this.once(event, (...args: any[]) => eventHandler(event, ...args))
      })

      // Set timeout for the entire chain
      setTimeout(() => {
        reject(new Error(`Timeout waiting for chained events: ${events.join(', ')}`))
      }, 10000)
    })
  }

  /**
   * Create a debounced event handler
   */
  debounce(event: EventType, delay: number = 300): (...args: any[]) => void {
    let timeoutId: NodeJS.Timeout

    return (...args: any[]) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        this.emit(event, ...args)
      }, delay)
    }
  }

  /**
   * Create a throttled event handler
   */
  throttle(event: EventType, limit: number = 300): (...args: any[]) => void {
    let inThrottle = false

    return (...args: any[]) => {
      if (!inThrottle) {
        this.emit(event, ...args)
        inThrottle = true
        setTimeout(() => {
          inThrottle = false
        }, limit)
      }
    }
  }

  /**
   * Create a buffered event emitter
   */
  buffer(event: EventType, bufferSize: number = 10, flushInterval: number = 1000): {
    emit: (...args: any[]) => void
    flush: () => void
  } {
    let buffer: any[][] = []
    let flushTimer: NodeJS.Timeout

    const flush = () => {
      if (buffer.length > 0) {
        this.emit(`${event}:buffered`, buffer)
        buffer = []
      }
    }

    const emit = (...args: any[]) => {
      buffer.push(args)

      if (buffer.length >= bufferSize) {
        flush()
      } else {
        clearTimeout(flushTimer)
        flushTimer = setTimeout(flush, flushInterval)
      }
    }

    return { emit, flush }
  }

  /**
   * Get statistics about the event handler
   */
  getStats(): {
    totalEvents: number
    totalSubscriptions: number
    eventDetails: Array<{ event: EventType; subscriptionCount: number }>
  } {
    let totalSubscriptions = 0
    const eventDetails: Array<{ event: EventType; subscriptionCount: number }> = []

    for (const [event, subscriptions] of this.listeners.entries()) {
      totalSubscriptions += subscriptions.length
      eventDetails.push({
        event,
        subscriptionCount: subscriptions.length,
      })
    }

    return {
      totalEvents: this.listeners.size,
      totalSubscriptions,
      eventDetails,
    }
  }

  private generateSubscriptionId(): string {
    return `sub_${++this.subscriptionIdCounter}_${Date.now()}`
  }
}