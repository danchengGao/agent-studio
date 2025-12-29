/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { usePlaygroundTools } from '@flowgram.ai/free-layout-editor'
import { IconButton, Tooltip } from '@douyinfe/semi-ui'
import { Maximize2 } from 'lucide-react'
import { useTranslation } from '../../i18n'

export const FitView = () => {
  const tools = usePlaygroundTools()
  const { t } = useTranslation()
  return (
    <Tooltip content={t('workflowCanvas.tools.fitView')}>
      <IconButton type="tertiary" theme="borderless" icon={<Maximize2 size="small" />} onClick={() => tools.fitView()} />
    </Tooltip>
  )
}
