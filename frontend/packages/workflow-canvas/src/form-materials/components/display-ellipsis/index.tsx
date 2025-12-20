/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import React from 'react'
import { Tooltip, IconButton } from '@douyinfe/semi-ui'
import { IconMore } from '@douyinfe/semi-icons'

import './styles.css'

interface PropsType {
  hiddenContent: React.ReactNode
  tooltipStyle?: React.CSSProperties
}

export function DisplayEllipsis({ hiddenContent, tooltipStyle }: PropsType) {
  return (
    <Tooltip
      content={hiddenContent}
      position="bottom"
      showArrow={false}
      zIndex={1000}
      style={{
        backgroundColor: 'transparent',
        border: 'none',
        padding: '0',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        ...tooltipStyle,
      }}
    >
      <IconButton icon={<IconMore />} size="small" theme="borderless" className="gedit-m-display-ellipsis-button" />
    </Tooltip>
  )
}
