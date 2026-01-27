/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import React from 'react'

import { IJsonSchema } from '@flowgram.ai/json-schema'
import { t } from '../../../i18n'

import { ConstantInput } from '../../'

/**
 * Renders the corresponding default value input component based on different data types.
 * @param props - Component properties, including value, type, placeholder, onChange.
 * @returns Returns the input component of the corresponding type or null.
 */
export function DefaultValue(props: {
  value: any
  schema?: IJsonSchema
  placeholder?: string
  onChange: (value: any) => void
  /** 是否锁定默认值，锁定后为只读模式 */
  locked?: boolean
}) {
  const { value, schema, onChange, placeholder, locked } = props

  if (locked) {
    return (
      <div className="gedit-m-json-schema-editor-locked-default-value">
        <div className="gedit-m-json-schema-editor-locked-value-display">
          {value !== undefined && value !== null && value !== '' ? JSON.stringify(value) : t('workflowCanvas.formMaterials.editor.noDefaultValue')}
        </div>
        <div className="gedit-m-json-schema-editor-locked-hint">{t('workflowCanvas.formMaterials.editor.defaultValueLocked')}</div>
      </div>
    )
  }

  return (
    <div className="gedit-m-json-schema-editor-constant-input-wrapper">
      <ConstantInput
        value={value}
        onChange={_v => onChange(_v)}
        schema={schema || { type: 'string' }}
        placeholder={placeholder ?? t('workflowCanvas.formMaterials.editor.defaultValueIfNotProvided')}
        enableMultiLineStr
      />
    </div>
  )
}
