/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useState } from 'react'
import { Button } from '@douyinfe/semi-ui'
import { Bug } from 'lucide-react'

import { DebugSidePanel } from '../debug-panel'
import { useTranslation } from '../../../i18n'
import styles from './index.module.less'

export function DebugButton(props: { disabled: boolean; workflowId?: string; spaceId?: string }) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  const onDebug = () => {
    setVisible(true)
  }

  return (
    <>
      <Button disabled={props.disabled} onClick={onDebug} className={styles.debugButton}>
        <Bug size={16} className={styles['mr-2']} />
        {t('workflowCanvas.debug.debug')}
      </Button>
      <DebugSidePanel visible={visible} onCancel={() => setVisible(false)} workflowId={props.workflowId} spaceId={props.spaceId} />
    </>
  )
}
