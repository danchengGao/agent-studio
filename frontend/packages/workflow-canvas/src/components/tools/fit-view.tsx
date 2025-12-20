/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { usePlaygroundTools } from '@flowgram.ai/free-layout-editor'
import { IconButton, Tooltip } from '@douyinfe/semi-ui'
import { Maximize2 } from 'lucide-react'

export const FitView = () => {
  const tools = usePlaygroundTools()
  return (
    <Tooltip content="适应视图">
      <IconButton type="tertiary" theme="borderless" icon={<Maximize2 size="small" />} onClick={() => tools.fitView()} />
    </Tooltip>
  )
}
