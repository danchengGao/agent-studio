/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

/**
 * Base interface for all editor extensions
 */
export interface EditorExtension {
  /** Unique identifier for the extension */
  readonly id: string

  /** Human-readable name of the extension */
  readonly name: string

  /** Extension version */
  readonly version: string

  /** Extension description */
  readonly description?: string

  /** Extension dependencies */
  readonly dependencies?: string[]

  /** Configuration options for the extension */
  config?: Record<string, any>

  /** Current lifecycle state */
  state: ExtensionState

  /** CodeMirror extension instance */
  extension?: Extension | Extension[]
}

/**
 * Extension lifecycle states
 */
export enum ExtensionState {
  UNLOADED = 'unloaded',
  LOADING = 'loading',
  LOADED = 'loaded',
  ACTIVE = 'active',
  ERROR = 'error',
  DESTROYED = 'destroyed'
}

/**
 * Extension configuration interface
 */
export interface ExtensionConfig {
  /** Whether the extension should be automatically mounted */
  autoMount?: boolean

  /** Extension-specific configuration */
  options?: Record<string, any>

  /** Priority for extension loading (higher numbers load first) */
  priority?: number

  /** Dependencies that must be loaded first */
  dependencies?: string[]
}

/**
 * Extension lifecycle hooks
 */
export interface ExtensionLifecycle {
  /** Called when extension is mounted to editor */
  mount?(view: EditorView, config?: Record<string, any>): Promise<void> | void

  /** Called when extension is unmounted from editor */
  unmount?(view: EditorView): Promise<void> | void

  /** Called when extension configuration is updated */
  update?(config: Record<string, any>): Promise<void> | void

  /** Called when extension is destroyed */
  destroy?(): Promise<void> | void
}

/**
 * Extension registry interface for managing extensions
 */
export interface ExtensionRegistry {
  /** Register a new extension */
  register(extension: EditorExtension & ExtensionLifecycle): Promise<void>

  /** Unregister an extension */
  unregister(extensionId: string): Promise<void>

  /** Get an extension by ID */
  get(extensionId: string): (EditorExtension & ExtensionLifecycle) | undefined

  /** Get all registered extensions */
  getAll(): (EditorExtension & ExtensionLifecycle)[]

  /** Get extensions in a specific state */
  getByState(state: ExtensionState): (EditorExtension & ExtensionLifecycle)[]

  /** Check if an extension is registered */
  has(extensionId: string): boolean

  /** Get extensions that depend on a given extension */
  getDependents(extensionId: string): (EditorExtension & ExtensionLifecycle)[]

  /** Validate extension dependencies */
  validateDependencies(extensionId: string): boolean
}

/**
 * Extension loader interface for dynamic extension loading
 */
export interface ExtensionLoader {
  /** Load an extension by ID or path */
  load(extensionId: string, config?: ExtensionConfig): Promise<EditorExtension & ExtensionLifecycle>

  /** Unload an extension */
  unload(extensionId: string): Promise<void>

  /** Reload an extension */
  reload(extensionId: string, config?: ExtensionConfig): Promise<EditorExtension & ExtensionLifecycle>

  /** Check if an extension is loaded */
  isLoaded(extensionId: string): boolean

  /** Get loading status of an extension */
  getLoadStatus(extensionId: string): ExtensionState

  /** Preload a list of extensions */
  preload(extensionIds: string[]): Promise<void>

  /** Clear all loaded extensions */
  clear(): Promise<void>
}

/**
 * Extension metadata for discovery and registration
 */
export interface ExtensionMetadata {
  /** Extension identifier */
  id: string

  /** Extension name */
  name: string

  /** Extension version */
  version: string

  /** Extension description */
  description?: string

  /** Extension author */
  author?: string

  /** Extension homepage */
  homepage?: string

  /** Extension keywords */
  keywords?: string[]

  /** Extension dependencies */
  dependencies?: string[]

  /** Extension peer dependencies */
  peerDependencies?: string[]

  /** Supported languages */
  supportedLanguages?: string[]

  /** Extension category */
  category?: 'language' | 'theme' | 'feature' | 'integration' | 'other'

  /** Minimum CodeMirror version */
  minCodeMirrorVersion?: string
}

/**
 * Extension factory interface for creating extension instances
 */
export interface ExtensionFactory<T = any> {
  /** Create a new extension instance */
  create(config?: T): Promise<EditorExtension & ExtensionLifecycle>

  /** Get extension metadata */
  getMetadata(): ExtensionMetadata

  /** Validate configuration */
  validateConfig?(config: T): boolean

  /** Get default configuration */
  getDefaultConfig?(): T
}

/**
 * Extension event types
 */
export type ExtensionEventType =
  | 'extension:registered'
  | 'extension:unregistered'
  | 'extension:loaded'
  | 'extension:unloaded'
  | 'extension:mounted'
  | 'extension:unmounted'
  | 'extension:updated'
  | 'extension:error'
  | 'registry:cleared'

/**
 * Extension event data
 */
export interface ExtensionEvent {
  /** Event type */
  type: ExtensionEventType

  /** Extension ID */
  extensionId: string

  /** Event timestamp */
  timestamp: number

  /** Additional event data */
  data?: any

  /** Error information if applicable */
  error?: Error
}

/**
 * Extension event listener
 */
export type ExtensionEventListener = (event: ExtensionEvent) => void