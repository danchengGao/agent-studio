/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable react/prop-types */
import React from 'react'

import { I18n } from '@flowgram.ai/editor'

import { ConditionPresetOp, JsonCodeEditor } from '../../..'

import { type JsonSchemaTypeRegistry } from '../types'

export const mapRegistry: Partial<JsonSchemaTypeRegistry> = {
  type: 'map',
  ConstantRenderer: props => (
    <JsonCodeEditor mini value={props.value} onChange={v => props.onChange?.(v)} placeholder={I18n.t('Please Input Map')} readonly={props.readonly} />
  ),
  conditionRule: {
    [ConditionPresetOp.IS_EMPTY]: null,
    [ConditionPresetOp.IS_NOT_EMPTY]: null,
  },
}
