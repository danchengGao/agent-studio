/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FC } from 'react'

import { JsonCodeEditor } from '../../../form-materials'
import { useFormMeta, useSyncDefault } from '../hooks'
import { TestRunFormMetaItem } from '../testrun-form/type'

import styles from './index.module.less'

interface TestRunJsonInputProps {
  values: Record<string, unknown>
  setValues: (_newValues: Record<string, unknown>) => void
  inputFormMeta?: TestRunFormMetaItem[]
}

export const TestRunJsonInput: FC<TestRunJsonInputProps> = ({ values, setValues, inputFormMeta }) => {
  const formMeta = inputFormMeta || useFormMeta()

  useSyncDefault({
    formMeta,
    values,
    setValues,
  })

  return (
    <div className={styles['testrun-json-input']}>
      <JsonCodeEditor
        value={values}
        onChange={setValues}
        placeholder='{"key": "value"}'
        parseDelay={600}
        showErrors={true}
        minHeight={300}
        lineNumbers={true}
        foldGutter={true}
      />
    </div>
  )
}
