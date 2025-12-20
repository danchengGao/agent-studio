/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

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
 * Simple ExtensionRegistry implementation for basic functionality
 */
export class ExtensionRegistry implements IExtensionRegistry {
  private extensions = new Map<string, EditorExtension & ExtensionLifecycle>()

  async register(extension: EditorExtension & ExtensionLifecycle): Promise<void> {
    this.extensions.set(extension.id, extension)
  }

  async unregister(extensionId: string): Promise<void> {
    this.extensions.delete(extensionId)
  }

  get(extensionId: string): (EditorExtension & ExtensionLifecycle) | undefined {
    return this.extensions.get(extensionId)
  }

  getAll(): (EditorExtension & ExtensionLifecycle)[] {
    return Array.from(this.extensions.values())
  }

  getByState(state: ExtensionState): (EditorExtension & ExtensionLifecycle)[] {
    return Array.from(this.extensions.values()).filter(ext => ext.state === state)
  }

  has(extensionId: string): boolean {
    return this.extensions.has(extensionId)
  }

  getDependents(extensionId: string): (EditorExtension & ExtensionLifecycle)[] {
    return Array.from(this.extensions.values()).filter(ext => ext.dependencies?.includes(extensionId) || false)
  }

  validateDependencies(extensionId: string): boolean {
    const extension = this.extensions.get(extensionId)
    if (!extension || !extension.dependencies) return true

    return extension.dependencies.every(dep => this.extensions.has(dep))
  }
}

/**
 * Simple ExtensionLoader implementation for basic functionality
 */
export class ExtensionLoader implements IExtensionLoader {
  private loadedExtensions = new Map<string, EditorExtension & ExtensionLifecycle>()

  async load(extensionId: string, config?: ExtensionConfig): Promise<EditorExtension & ExtensionLifecycle> {
    // Placeholder implementation
    throw new Error(`Extension loading not implemented for ${extensionId}`)
  }

  async unload(extensionId: string): Promise<void> {
    this.loadedExtensions.delete(extensionId)
  }

  async reload(extensionId: string, config?: ExtensionConfig): Promise<EditorExtension & ExtensionLifecycle> {
    await this.unload(extensionId)
    return this.load(extensionId, config)
  }

  isLoaded(extensionId: string): boolean {
    return this.loadedExtensions.has(extensionId)
  }

  getLoadStatus(extensionId: string): ExtensionState {
    return this.loadedExtensions.has(extensionId) ? ExtensionState.LOADED : ExtensionState.UNLOADED
  }

  async preload(extensionIds: string[]): Promise<void> {
    // Placeholder implementation
  }

  async clear(): Promise<void> {
    this.loadedExtensions.clear()
  }
}
