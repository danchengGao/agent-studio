/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable react/prop-types */
import React from 'react'

import { Input, TextArea } from '@douyinfe/semi-ui'
import { t } from '../../../../i18n'

import { ConditionPresetOp } from '../../..'

import { type JsonSchemaTypeRegistry } from '../types'

export const stringRegistry: Partial<JsonSchemaTypeRegistry> = {
  type: 'string',
  ConstantRenderer: props =>
    props?.enableMultiLineStr ? (
      <TextArea autosize rows={1} placeholder={t('workflowCanvas.formMaterials.input.pleaseInputString')} disabled={props.readonly} {...props} />
    ) : (
      <Input size="small" placeholder={t('workflowCanvas.formMaterials.input.pleaseInputString')} disabled={props.readonly} {...props} />
    ),
  conditionRule: {
    [ConditionPresetOp.EQ]: { type: 'string' },
    [ConditionPresetOp.NEQ]: { type: 'string' },
    [ConditionPresetOp.CONTAINS]: { type: 'string' },
    [ConditionPresetOp.NOT_CONTAINS]: { type: 'string' },
    [ConditionPresetOp.IN]: {
      type: 'array',
      items: { type: 'string' },
    },
    [ConditionPresetOp.NIN]: {
      type: 'array',
      items: { type: 'string' },
    },
    [ConditionPresetOp.IS_EMPTY]: null,
    [ConditionPresetOp.IS_NOT_EMPTY]: null,
  },
}
