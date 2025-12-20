/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import React from 'react'

import { I18n } from '@flowgram.ai/editor'
import { Button } from '@douyinfe/semi-ui'
import { IconPlus } from '@douyinfe/semi-icons'

import { FlowValueUtils, IFlowValue, IInputsValues } from '../../'
import { useObjectList } from '../../'

import { PropsType } from './types'
import './styles.css'
import { InputValueRow } from './row'

export function InputsValuesTree(props: PropsType) {
  const { value, onChange, readonly, hasError, constantProps, deleteable = true, nameEditable = true, schema, showAddButton = true, allowAddChildren = true } = props

  const { list, updateKey, updateValue, remove, add } = useObjectList<IInputsValues | IFlowValue | undefined>({
    value,
    onChange: v => onChange?.(v as IInputsValues),
    sortIndexKey: value => (FlowValueUtils.isFlowValue(value) ? 'extra.index' : ''),
  })

  return (
    <div>
      <div className="gedit-m-inputs-values-tree-tree-items">
        {list.map(item => (
          <InputValueRow
            key={item.id}
            keyName={item.key}
            value={item.value}
            onUpdateKey={key => updateKey(item.id, key)}
            onUpdateValue={value => updateValue(item.id, value)}
            onRemove={() => remove(item.id)}
            readonly={readonly}
            hasError={hasError}
            constantProps={constantProps}
            deleteable={deleteable}
            nameEditable={nameEditable}
            schema={(schema as any)?.properties?.[item.key]}
            allowAddChildren={allowAddChildren}
          />
        ))}
      </div>
      {showAddButton && (
        <Button
        style={{ marginTop: 10, marginLeft: 16 }}
        disabled={readonly}
        icon={<IconPlus />}
        size="small"
        onClick={() => {
          add({
            type: 'constant',
            content: '',
            schema: { type: 'string' },
          })
        }}
      >
        {I18n.t('Add')}
        </Button>
      )}
    </div>
  )
}
