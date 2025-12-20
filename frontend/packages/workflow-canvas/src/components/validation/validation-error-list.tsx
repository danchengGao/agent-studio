/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FC } from 'react'
import { AlertCircle, AlertTriangle } from 'lucide-react'

import { ValidationErrorInfo } from './types'
import styles from './styles/index.module.less'

interface ValidationErrorListProps {
  errors: ValidationErrorInfo[]
  onNodeSelect: (nodeId: string) => void
}

export const ValidationErrorList: FC<ValidationErrorListProps> = ({ errors, onNodeSelect }) => {
  if (errors.length === 0) {
    return (
      <div className={styles['validation-error-empty']}>
        <AlertCircle size={48} className={styles['empty-icon']} />
        <p>没有发现校验问题</p>
      </div>
    )
  }

  return (
    <div className={styles['validation-error-list']}>
      {errors.map((error, index) => (
        <div key={`${error.nodeId}-${index}`} className={styles['validation-error-item']} onClick={() => onNodeSelect(error.nodeId)}>
          <div className={styles['error-item-content']}>
            <div className={styles['error-item-icon']}>
              {error.severity === 'error' ? (
                <AlertCircle size={14} className={styles['error-icon']} />
              ) : (
                <AlertTriangle size={14} className={styles['warning-icon']} />
              )}
            </div>
            <span className={styles['error-item-node']}>{error.nodeTitle}</span>
            <span className={styles['error-item-separator']}>：</span>
            <span className={styles['error-item-message']}>{error.error}</span>
            {error.field && <span className={styles['error-item-field']}>({error.field})</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
