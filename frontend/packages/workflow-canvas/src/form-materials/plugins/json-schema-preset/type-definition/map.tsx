/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable react/prop-types */
import React from 'react'

import { t } from '../../../../i18n'

import { ConditionPresetOp, JsonCodeEditor } from '../../..'

import { type JsonSchemaTypeRegistry } from '../types'

export const mapRegistry: Partial<JsonSchemaTypeRegistry> = {
  type: 'map',
  ConstantRenderer: props => (
    <JsonCodeEditor
      mini
      value={props.value}
      onChange={v => props.onChange?.(v)}
      placeholder={t('workflowCanvas.formMaterials.input.pleaseInputMap')}
      readonly={props.readonly}
    />
  ),
  conditionRule: {
    [ConditionPresetOp.IS_EMPTY]: null,
    [ConditionPresetOp.IS_NOT_EMPTY]: null,
  },
}
