/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { IJsonSchema } from '@flowgram.ai/json-schema'

import { IFlowValue, IFlowConstantValue, ConstantInputStrategy } from '../../'

export interface PropsType {
  value?: Record<string, IFlowValue | undefined>
  onChange: (value?: Record<string, IFlowValue | undefined>) => void
  readonly?: boolean
  hasError?: boolean
  schema?: IJsonSchema
  style?: React.CSSProperties
  showAddButton?: boolean
  /** 不可变的字段，这些字段不可编辑和删除 */
  defaultFields?: string[]
  constantProps?: {
    strategies?: ConstantInputStrategy[]
    [key: string]: any
  }
  deleteable?: boolean
  nameEditable?: boolean
  /** 是否使用字段自身的 schema 限制（优先于全局 schema） */
  useFieldSchema?: boolean
  /** 字段名验证回调函数，返回错误信息或 undefined */
  onValidateKey?: (key: string, itemId: string, allItems: Array<{ id: string; key?: string }>) => string | undefined
  /** 自定义添加按钮，如果提供则使用此按钮而非默认按钮 */
  customAddButton?: React.ReactNode
  /** 是否隐藏默认添加按钮 */
  hideDefaultAddButton?: boolean
  /** 自定义默认添加项的值 */
  defaultItem?: IFlowConstantValue
}
