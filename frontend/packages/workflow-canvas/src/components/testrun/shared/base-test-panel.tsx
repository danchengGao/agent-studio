/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FC, ReactNode } from 'react'
import { Button } from '@douyinfe/semi-ui'
import { X } from 'lucide-react'
import { Loader2 } from 'lucide-react'

import styles from '../testrun-panel/index.module.less'

export interface BaseTestPanelProps {
  title: string
  isExecuting: boolean
  onClose: () => void
  children: ReactNode
  renderRunning?: () => ReactNode
  renderButton?: () => ReactNode
  footerContent?: ReactNode
}

export const BaseTestPanel: FC<BaseTestPanelProps> = ({
  title,
  isExecuting,
  onClose,
  children,
  renderRunning,
  renderButton,
  footerContent,
}) => {
  const defaultRenderRunning = (
    <div className={styles['testrun-panel-running']}>
      <div className={styles['running-header']}>
        <Loader2 className={styles['animate-spin']} size={20} />
        <span className={styles.text}>运行中...</span>
      </div>
    </div>
  )

  const renderButtonContent = (() => {
    if (renderButton) return renderButton()
    if (isExecuting) {
      return <Button className={`${styles.button} ${styles.running}`}>取消</Button>
    }
    return <Button className={`${styles.button} ${styles.save}`}>运行</Button>
  })()

  const renderRunningContent = (() => {
    if (renderRunning) return renderRunning()
    return defaultRenderRunning
  })()

  return (
    <div className={styles['testrun-panel-container']}>
      <div className={styles['testrun-panel-header']}>
        <div className={styles['testrun-panel-title']}>{title}</div>
        <Button
          type="tertiary"
          size="small"
          theme="borderless"
          onClick={onClose}
        >
          <X size={16} className={styles['text-gray-600']} />
        </Button>
      </div>

      <div className={styles['testrun-panel-content']}>
        {isExecuting ? renderRunningContent : children}
      </div>

      <div className={styles['testrun-panel-footer']}>
        {footerContent ?? renderButtonContent}
      </div>
    </div>
  )
}
