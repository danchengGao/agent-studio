/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Extension } from '@codemirror/state'

// Simple placeholder implementation for variable tree extension
export interface VariableTreeConfig {
  variables: Array<{
    name: string
    type: string
    description?: string
  }>
  onSelect?: (variable: any) => void
}

export class VariableTreeExtension {
  private config: VariableTreeConfig

  constructor(config: VariableTreeConfig) {
    this.config = config
  }

  createExtension(): Extension {
    // Placeholder implementation
    return []
  }

  getConfig(): VariableTreeConfig {
    return this.config
  }

  updateConfig(config: Partial<VariableTreeConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

export default VariableTreeExtension