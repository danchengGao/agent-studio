/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

// Export registry interfaces as types
export type {
  ExtensionRegistry as IExtensionRegistry,
  ExtensionLoader as IExtensionLoader,
  ExtensionConfig,
  ExtensionState,
  ExtensionLifecycle,
  ExtensionMetadata,
  ExtensionFactory,
  ExtensionEvent,
  ExtensionEventListener,
  ExtensionEventType,
  EditorExtension,
} from './extension-registry'

// Export concrete implementations
export { ExtensionManager } from './extension-manager'
export { ExtensionRegistry, ExtensionLoader } from './extension-registry-impl'

// Export specific extensions
export { createMentionsExtension, MentionsManager, type MentionItem, type MentionsConfig } from './mentions-extension'
export { VariableTagExtension } from './variable-tag-extension'
export { VariableTreeExtension, type VariableTreeConfig } from './variable-tree-extension'
