/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FC, useState } from 'react'

import { Tag } from '@douyinfe/semi-ui'
import { ChevronDown } from 'lucide-react'

import { DataStructureViewer } from '../viewer'
import { OutputFormat } from '../../../../nodes/llm/type'

import styles from './index.module.less'

interface NodeStatusGroupProps {
  title: string
  data: unknown
  optional?: boolean
  disableCollapse?: boolean
  size?: 'small' | 'large'
  /** Output format for rendering (text/markdown/json) */
  outputFormat?: OutputFormat
}

const isObjectHasContent = (obj: any = {}): boolean => obj && Object.keys(obj).length > 0

export const NodeStatusGroup: FC<NodeStatusGroupProps> = ({ title, data, optional = false, disableCollapse = false, size = 'small', outputFormat }) => {
  const hasContent = isObjectHasContent(data)
  const [isExpanded, setIsExpanded] = useState(true)

  if (optional && !hasContent) {
    return null
  }

  return (
    <>
      <div
        className={`${styles['node-status-group']} ${size === 'large' ? styles['node-status-group-large'] : ''}`}
        onClick={() => hasContent && !disableCollapse && setIsExpanded(!isExpanded)}
      >
        {!disableCollapse && (
          <ChevronDown
            className={`${styles['node-status-group-icon']} ${isExpanded && hasContent ? styles['node-status-group-icon-expanded'] : ''} ${size === 'large' ? styles['node-status-group-icon-large'] : ''}`}
          />
        )}
        <span>{title}:</span>
        {!hasContent && (
          <Tag size="small" className={styles['node-status-group-tag']}>
            null
          </Tag>
        )}
      </div>
      {hasContent && isExpanded ? <DataStructureViewer data={data} size={size} outputFormat={outputFormat} /> : null}
    </>
  )
}
