/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import {
  ExtensionRegistry as IExtensionRegistry,
  ExtensionLoader as IExtensionLoader,
  ExtensionConfig,
  ExtensionState,
  ExtensionEvent,
  ExtensionEventListener,
  ExtensionEventType,
  EditorExtension,
  ExtensionLifecycle,
} from './extension-registry'

/**
 * Extension Manager implementation
 * Manages registration, loading, and lifecycle of editor extensions
 */
export class ExtensionManager implements IExtensionRegistry, IExtensionLoader {
  private extensions = new Map<string, EditorExtension & ExtensionLifecycle>()
  private extensionConfigs = new Map<string, ExtensionConfig>()
  private eventListeners = new Map<ExtensionEventType, ExtensionEventListener[]>()
  private viewRef: EditorView | null = null
  private loadingPromises = new Map<string, Promise<EditorExtension & ExtensionLifecycle>>()

  constructor() {
    // Initialize event listener arrays
    const eventTypes: ExtensionEventType[] = [
      'extension:registered',
      'extension:unregistered',
      'extension:loaded',
      'extension:unloaded',
      'extension:mounted',
      'extension:unmounted',
      'extension:updated',
      'extension:error',
      'registry:cleared',
    ]

    eventTypes.forEach(type => {
      this.eventListeners.set(type, [])
    })
  }

  /**
   * Set the editor view for extension lifecycle management
   */
  setEditorView(view: EditorView): void {
    this.viewRef = view
  }

  /**
   * Register a new extension
   */
  async register(extension: EditorExtension & ExtensionLifecycle): Promise<void> {
    const { id } = extension

    if (this.extensions.has(id)) {
      // Unregister existing extension before registering new one
      await this.unregister(id)
    }

    // Validate dependencies
    if (extension.dependencies && !this.validateDependencies(id)) {
      throw new Error(`Extension '${id}' has unmet dependencies`)
    }

    // Set initial state
    extension.state = ExtensionState.LOADED

    this.extensions.set(id, extension)

    // Emit registration event
    this.emitEvent({
      type: 'extension:registered',
      extensionId: id,
      timestamp: Date.now(),
      data: { extension },
    })

    // Auto-mount if configured
    const config = this.extensionConfigs.get(id)
    if (config?.autoMount) {
      await this.mount(id)
    }
  }

  /**
   * Unregister an extension
   */
  async unregister(extensionId: string): Promise<void> {
    const extension = this.extensions.get(extensionId)
    if (!extension) {
      throw new Error(`Extension with id '${extensionId}' is not registered`)
    }

    // Unmount if currently mounted
    if (extension.state === ExtensionState.ACTIVE) {
      await this.unmount(extensionId)
    }

    // Destroy if loaded
    if (extension.state !== ExtensionState.UNLOADED) {
      await this.unload(extensionId)
    }

    this.extensions.delete(extensionId)
    this.extensionConfigs.delete(extensionId)

    // Emit unregistration event
    this.emitEvent({
      type: 'extension:unregistered',
      extensionId,
      timestamp: Date.now(),
    })
  }

  /**
   * Get an extension by ID
   */
  get(extensionId: string): (EditorExtension & ExtensionLifecycle) | undefined {
    return this.extensions.get(extensionId)
  }

  /**
   * Get all registered extensions
   */
  getAll(): (EditorExtension & ExtensionLifecycle)[] {
    return Array.from(this.extensions.values())
  }

  /**
   * Get extensions in a specific state
   */
  getByState(state: ExtensionState): (EditorExtension & ExtensionLifecycle)[] {
    return Array.from(this.extensions.values()).filter(ext => ext.state === state)
  }

  /**
   * Check if an extension is registered
   */
  has(extensionId: string): boolean {
    return this.extensions.has(extensionId)
  }

  /**
   * Get extensions that depend on a given extension
   */
  getDependents(extensionId: string): (EditorExtension & ExtensionLifecycle)[] {
    return Array.from(this.extensions.values()).filter(ext => ext.dependencies?.includes(extensionId))
  }

  /**
   * Validate extension dependencies
   */
  validateDependencies(extensionId: string): boolean {
    const extension = this.extensions.get(extensionId)
    if (!extension || !extension.dependencies) {
      return true
    }

    return extension.dependencies.every(depId => this.extensions.has(depId))
  }

  /**
   * Load an extension by ID or path
   */
  async load(extensionId: string, config?: ExtensionConfig): Promise<EditorExtension & ExtensionLifecycle> {
    // Check if already loading
    if (this.loadingPromises.has(extensionId)) {
      return this.loadingPromises.get(extensionId)!
    }

    // Check if already loaded
    const existing = this.extensions.get(extensionId)
    if (existing) {
      return existing
    }

    // Store config if provided
    if (config) {
      this.extensionConfigs.set(extensionId, config)
    }

    // Create loading promise
    const loadingPromise = this.performLoad(extensionId, config)
    this.loadingPromises.set(extensionId, loadingPromise)

    try {
      const extension = await loadingPromise
      return extension
    } finally {
      this.loadingPromises.delete(extensionId)
    }
  }

  /**
   * Internal load implementation
   */
  private async performLoad(extensionId: string, config?: ExtensionConfig): Promise<EditorExtension & ExtensionLifecycle> {
    // This would be implemented with dynamic import logic
    // For now, throw error to indicate not implemented
    throw new Error(`Dynamic loading not implemented for extension '${extensionId}'. Use register() instead.`)
  }

  /**
   * Unload an extension
   */
  async unload(extensionId: string): Promise<void> {
    const extension = this.extensions.get(extensionId)
    if (!extension) {
      throw new Error(`Extension with id '${extensionId}' is not registered`)
    }

    if (extension.state === ExtensionState.UNLOADED) {
      return
    }

    try {
      // Unmount if active
      if (extension.state === ExtensionState.ACTIVE) {
        await this.unmount(extensionId)
      }

      // Call destroy lifecycle hook
      if (extension.destroy) {
        await extension.destroy()
      }

      // Update state
      extension.state = ExtensionState.UNLOADED

      // Emit unload event
      this.emitEvent({
        type: 'extension:unloaded',
        extensionId,
        timestamp: Date.now(),
      })
    } catch (error) {
      // Update state to error
      extension.state = ExtensionState.ERROR

      // Emit error event
      this.emitEvent({
        type: 'extension:error',
        extensionId,
        timestamp: Date.now(),
        error: error as Error,
      })

      throw error
    }
  }

  /**
   * Reload an extension
   */
  async reload(extensionId: string, config?: ExtensionConfig): Promise<EditorExtension & ExtensionLifecycle> {
    await this.unregister(extensionId)

    if (config) {
      this.extensionConfigs.set(extensionId, config)
    }

    return this.load(extensionId, config)
  }

  /**
   * Check if an extension is loaded
   */
  isLoaded(extensionId: string): boolean {
    const extension = this.extensions.get(extensionId)
    return extension?.state === ExtensionState.LOADED || extension?.state === ExtensionState.ACTIVE
  }

  /**
   * Get loading status of an extension
   */
  getLoadStatus(extensionId: string): ExtensionState {
    const extension = this.extensions.get(extensionId)
    return extension?.state || ExtensionState.UNLOADED
  }

  /**
   * Preload a list of extensions
   */
  async preload(extensionIds: string[]): Promise<void> {
    const loadPromises = extensionIds.map(id => this.load(id))
    await Promise.allSettled(loadPromises)
  }

  /**
   * Clear all loaded extensions
   */
  async clear(): Promise<void> {
    const extensionIds = Array.from(this.extensions.keys())

    for (const id of extensionIds) {
      try {
        await this.unregister(id)
      } catch (error) {
        console.error(`Error unregistering extension '${id}':`, error)
      }
    }

    this.emitEvent({
      type: 'registry:cleared',
      extensionId: 'registry',
      timestamp: Date.now(),
    })
  }

  /**
   * Mount an extension to the current editor view
   */
  async mount(extensionId: string): Promise<void> {
    const extension = this.extensions.get(extensionId)
    if (!extension) {
      throw new Error(`Extension with id '${extensionId}' is not registered`)
    }

    if (extension.state === ExtensionState.ACTIVE) {
      return
    }

    if (!this.viewRef) {
      throw new Error('No editor view available. Call setEditorView() first.')
    }

    try {
      // Update state to loading
      extension.state = ExtensionState.LOADING

      const config = this.extensionConfigs.get(extensionId)

      // Call mount lifecycle hook
      if (extension.mount) {
        await extension.mount(this.viewRef, config?.options)
      }

      // Update state to active
      extension.state = ExtensionState.ACTIVE

      // Emit mount event
      this.emitEvent({
        type: 'extension:mounted',
        extensionId,
        timestamp: Date.now(),
        data: { config },
      })
    } catch (error) {
      // Update state to error
      extension.state = ExtensionState.ERROR

      // Emit error event
      this.emitEvent({
        type: 'extension:error',
        extensionId,
        timestamp: Date.now(),
        error: error as Error,
      })

      throw error
    }
  }

  /**
   * Unmount an extension from the current editor view
   */
  async unmount(extensionId: string): Promise<void> {
    const extension = this.extensions.get(extensionId)
    if (!extension) {
      throw new Error(`Extension with id '${extensionId}' is not registered`)
    }

    if (extension.state !== ExtensionState.ACTIVE) {
      return
    }

    if (!this.viewRef) {
      throw new Error('No editor view available')
    }

    try {
      // Call unmount lifecycle hook
      if (extension.unmount) {
        await extension.unmount(this.viewRef)
      }

      // Update state back to loaded
      extension.state = ExtensionState.LOADED

      // Emit unmount event
      this.emitEvent({
        type: 'extension:unmounted',
        extensionId,
        timestamp: Date.now(),
      })
    } catch (error) {
      // Update state to error
      extension.state = ExtensionState.ERROR

      // Emit error event
      this.emitEvent({
        type: 'extension:error',
        extensionId,
        timestamp: Date.now(),
        error: error as Error,
      })

      throw error
    }
  }

  /**
   * Update extension configuration
   */
  async update(extensionId: string, config: Record<string, any>): Promise<void> {
    const extension = this.extensions.get(extensionId)
    if (!extension) {
      throw new Error(`Extension with id '${extensionId}' is not registered`)
    }

    try {
      // Update stored config
      const existingConfig = this.extensionConfigs.get(extensionId) || {}
      this.extensionConfigs.set(extensionId, { ...existingConfig, options: config })

      // Call update lifecycle hook
      if (extension.update) {
        await extension.update(config)
      }

      // Emit update event
      this.emitEvent({
        type: 'extension:updated',
        extensionId,
        timestamp: Date.now(),
        data: { config },
      })
    } catch (error) {
      // Emit error event
      this.emitEvent({
        type: 'extension:error',
        extensionId,
        timestamp: Date.now(),
        error: error as Error,
      })

      throw error
    }
  }

  /**
   * Get all extensions as CodeMirror extensions
   */
  getExtensions(): Extension[] {
    const activeExtensions = this.getByState(ExtensionState.ACTIVE)
    const extensions: Extension[] = []

    for (const ext of activeExtensions) {
      if (ext.extension) {
        if (Array.isArray(ext.extension)) {
          extensions.push(...ext.extension)
        } else {
          extensions.push(ext.extension)
        }
      }
    }

    return extensions
  }

  /**
   * Add event listener
   */
  on(eventType: ExtensionEventType, listener: ExtensionEventListener): void {
    const listeners = this.eventListeners.get(eventType) || []
    listeners.push(listener)
    this.eventListeners.set(eventType, listeners)
  }

  /**
   * Remove event listener
   */
  off(eventType: ExtensionEventType, listener: ExtensionEventListener): void {
    const listeners = this.eventListeners.get(eventType) || []
    const index = listeners.indexOf(listener)
    if (index > -1) {
      listeners.splice(index, 1)
    }
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(event: ExtensionEvent): void {
    const listeners = this.eventListeners.get(event.type) || []
    listeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error(`Error in extension event listener:`, error)
      }
    })
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    total: number
    active: number
    loaded: number
    error: number
    unloaded: number
  } {
    const extensions = Array.from(this.extensions.values())

    return {
      total: extensions.length,
      active: extensions.filter(ext => ext.state === ExtensionState.ACTIVE).length,
      loaded: extensions.filter(ext => ext.state === ExtensionState.LOADED).length,
      error: extensions.filter(ext => ext.state === ExtensionState.ERROR).length,
      unloaded: extensions.filter(ext => ext.state === ExtensionState.UNLOADED).length,
    }
  }
}
