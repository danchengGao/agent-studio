/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

export interface ValidationErrorInfo {
  nodeId: string
  nodeTitle: string
  error: string
  severity: 'error' | 'warning'
  field?: string
}

export interface NodeValidationErrorPanelProps {
  errors: ValidationErrorInfo[]
  onNodeSelect?: (nodeId: string) => void
  onFixAll?: () => void
  onDismiss?: () => void
}
