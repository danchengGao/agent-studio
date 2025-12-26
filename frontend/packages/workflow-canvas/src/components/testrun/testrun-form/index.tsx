/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FC } from 'react'

import classNames from 'classnames'
import { Input, Switch, InputNumber } from '@douyinfe/semi-ui'

import { DisplaySchemaTag, JsonCodeEditor } from '../../../form-materials'
import { useFormMeta } from '../hooks/use-form-meta'
import { useFields } from '../hooks/use-fields'
import { useSyncDefault } from '../hooks'

import styles from './index.module.less'

import { TestRunFormMetaItem } from './type'

interface TestRunFormProps {
  values: Record<string, unknown>
  setValues: (values: Record<string, unknown>) => void
  inputFormMeta?: TestRunFormMetaItem[] // 可选的输入节点表单定义
}

export const TestRunForm: FC<TestRunFormProps> = ({ values, setValues, inputFormMeta }) => {
  const formMeta = useFormMeta()

  // 如果有inputFormMeta（输入中断时），使用它；否则使用工作流的formMeta
  const effectiveFormMeta = inputFormMeta || formMeta

  const fields = useFields({
    formMeta: effectiveFormMeta,
    values,
    setValues,
  })

  useSyncDefault({
    formMeta: effectiveFormMeta,
    values,
    setValues,
  })

  const renderField = (field: any) => {
    const hasError = field.error && !field.isValid

    switch (field.type) {
      case 'boolean':
        return (
          <div className={styles.fieldInput}>
            <Switch checked={field.value} onChange={checked => field.onChange(checked)} />
            {hasError && <div className={styles.errorMessage}>{field.error}</div>}
          </div>
        )
      case 'integer':
        return (
          <div className={styles.fieldInput}>
            <InputNumber precision={0} value={field.value} onChange={value => field.onChange(value)} type={hasError ? 'error' : 'default'} />
            {hasError && <div className={styles.errorMessage}>{field.error}</div>}
          </div>
        )
      case 'number':
        return (
          <div className={styles.fieldInput}>
            <InputNumber value={field.value} onChange={value => field.onChange(value)} type={hasError ? 'error' : 'default'} />
            {hasError && <div className={styles.errorMessage}>{field.error}</div>}
          </div>
        )
      case 'object':
        return (
          <div className={classNames(styles.fieldInput, styles.codeEditorWrapper)}>
            <JsonCodeEditor
              value={field.value}
              onChange={value => field.onChange(value)}
              showErrors={hasError}
              renderError={error => <div className={styles.errorMessage}>{field.error || error}</div>}
              expectedFieldType="object"
            />
          </div>
        )
      case 'array':
        return (
          <div className={classNames(styles.fieldInput, styles.codeEditorWrapper)}>
            <JsonCodeEditor
              value={field.value}
              onChange={value => field.onChange(value)}
              defaultFormat="[]"
              showErrors={hasError}
              renderError={error => <div className={styles.errorMessage}>{field.error || error}</div>}
              validateArrayElements={!!field.itemsType}
              arrayElementType={field.itemsType}
              expectedFieldType="array"
            />
          </div>
        )
      default:
        return (
          <div className={styles.fieldInput}>
            <Input value={field.value} onChange={value => field.onChange(value)} type={hasError ? 'error' : 'default'} />
            {hasError && <div className={styles.errorMessage}>{field.error}</div>}
          </div>
        )
    }
  }

  // Show empty state if no fields
  if (fields.length === 0) {
    return (
      <div className={styles.formContainer}>
        <div className={styles.emptyState}>
          <div className={styles.emptyText}>本次试运行无需输入</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.formContainer}>
      {fields.map(field => (
        <div key={field.name} className={styles.fieldGroup}>
          <label htmlFor={field.name} className={styles.fieldLabel}>
            {field.description || field.name}
            {field.required && <span className={styles.requiredIndicator}>*</span>}
            <span className={styles.fieldTypeIndicator}>
              <DisplaySchemaTag
                value={{
                  type: field.type,
                  items: field.itemsType
                    ? {
                        type: field.itemsType,
                      }
                    : undefined,
                }}
              />
            </span>
          </label>
          {renderField(field)}
        </div>
      ))}
    </div>
  )
}
