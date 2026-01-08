/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */
import { Button, IconButton, Typography } from '@douyinfe/semi-ui'
import { IconDelete, IconPlus } from '@douyinfe/semi-icons'

import React from 'react'
import { useTranslation } from '../../../i18n'
import { BlurInput, InjectDynamicValueInput, useObjectList, IFlowConstantRefValue, IFlowValue, IFlowConstantValue } from '../../'

import { PropsType } from './types'
import './styles.css'

export function InputsValues({
  value,
  onChange,
  style,
  readonly,
  constantProps,
  schema,
  hasError,
  showAddButton = true,
  defaultFields,
  deleteable = true,
  nameEditable = true,
  useFieldSchema = false,
  onValidateKey,
  customAddButton,
  hideDefaultAddButton = false,
  defaultItem,
}: PropsType) {
  const { t } = useTranslation()
  const { list, updateKey, updateValue, remove, add } = useObjectList<IFlowValue | undefined>({
    value,
    onChange,
    sortIndexKey: 'extra.index',
  })

  const [keyValidationError, setKeyValidationError] = React.useState<{ itemId: string; error: string } | null>(null)

  const isFieldLocked = (key?: string) => {
    return readonly || defaultFields?.includes(key || '') || false
  }

  return (
    <div>
      <div className="gedit-m-inputs-values-rows" style={style}>
        {list.map(item => (
          <React.Fragment key={item.id}>
            <div className="gedit-m-inputs-values-row">
              <BlurInput
                style={{ width: 100, minWidth: 100, maxWidth: 100 }}
                disabled={!nameEditable || isFieldLocked(item.key)}
                size="small"
                value={item.key}
                onChange={v => {
                  if (onValidateKey) {
                    const error = onValidateKey(v || '', item.id, list)
                    if (error) {
                      setKeyValidationError({ itemId: item.id, error })
                      return
                    }
                  }
                  if (keyValidationError?.itemId === item.id) {
                    setKeyValidationError(null)
                  }
                  updateKey(item.id, v)
                }}
                placeholder={t('workflowCanvas.formMaterials.common.inputKey')}
              />
              <InjectDynamicValueInput
                style={{ flexGrow: 1 }}
                readonly={readonly}
                value={item.value as IFlowConstantRefValue}
                onChange={v => updateValue(item.id, v)}
                schema={useFieldSchema && (item.value as IFlowConstantValue)?.schema ? (item.value as IFlowConstantValue).schema : schema}
                hasError={hasError}
                constantProps={{
                  ...constantProps,
                  strategies: [...(constantProps?.strategies || [])],
                }}
              />
              {deleteable && (
                <IconButton
                  disabled={isFieldLocked(item.key)}
                  theme="borderless"
                  icon={<IconDelete size="small" />}
                  size="small"
                  onClick={() => {
                    if (isFieldLocked(item.key)) {
                      return
                    }
                    remove(item.id)
                  }}
                />
              )}
            </div>
            {keyValidationError?.itemId === item.id && (
              <Typography.Text type="danger" size="small" style={{ marginTop: 4, display: 'block', textAlign: 'left' }}>
                {keyValidationError.error}
              </Typography.Text>
            )}
          </React.Fragment>
        ))}
      </div>
      {customAddButton}
      {!customAddButton && !hideDefaultAddButton && showAddButton && (
        <Button
          disabled={readonly}
          icon={<IconPlus />}
          size="small"
          onClick={() =>
            add({
              type: 'constant',
              content: '',
              schema: { type: 'string' },
              ...defaultItem,
            })
          }
        />
      )}
    </div>
  )
}
