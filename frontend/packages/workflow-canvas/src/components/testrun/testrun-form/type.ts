/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import type { JsonSchemaBasicType } from '../form-materials'

export interface TestRunFormMetaItem {
  type: JsonSchemaBasicType
  name: string
  defaultValue: unknown
  required: boolean
  itemsType?: JsonSchemaBasicType
  description?: string
}

export type TestRunFormMeta = TestRunFormMetaItem[]

export interface TestRunFormField extends TestRunFormMetaItem {
  value: unknown
  onChange: (value: unknown) => void
  error?: string
  isValid?: boolean
}
