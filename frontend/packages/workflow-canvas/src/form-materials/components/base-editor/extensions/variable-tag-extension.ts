/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Extension } from '@codemirror/state'

// Simple placeholder implementation for variable tag extension
export interface VariableTag {
  name: string
  type: string
  value: any
  position?: { from: number; to: number }
}

export interface VariableTagConfig {
  tags: VariableTag[]
  onTagClick?: (tag: VariableTag) => void
  highlightStyle?: object
}

export class VariableTagExtension {
  private config: VariableTagConfig

  constructor(config: VariableTagConfig) {
    this.config = config
  }

  createExtension(): Extension {
    // Placeholder implementation
    return []
  }

  getConfig(): VariableTagConfig {
    return this.config
  }

  updateConfig(config: Partial<VariableTagConfig>): void {
    this.config = { ...this.config, ...config }
  }

  addTag(tag: VariableTag): void {
    this.config.tags.push(tag)
  }

  removeTag(tagName: string): boolean {
    const index = this.config.tags.findIndex(tag => tag.name === tagName)
    if (index >= 0) {
      this.config.tags.splice(index, 1)
      return true
    }
    return false
  }
}

export default VariableTagExtension