/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import React, { useMemo, useRef, useState, useEffect } from 'react'

import { isPlainObject } from 'lodash-es'
import { useScopeAvailable, FlowNode } from '@flowgram.ai/editor'

import { IInputsValues } from '../../'
import { FlowValueUtils } from '../../'
import { DisplayFlowValue } from '../../'
import { DisplayEllipsis } from '../display-ellipsis'

import './styles.css'
import { DisplaySchemaTag } from '../display-schema-tag'

interface PropsType {
  value?: IInputsValues
  showIconInTree?: boolean
  node?: FlowNode
  includePrivateScope?: boolean
}

export function DisplayInputsValues({ value, showIconInTree, node, includePrivateScope }: PropsType) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState<number | null>(null)

  const childEntries = Object.entries(value || {})

  // Calculate how many items can fit in the container
  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver(() => {
      const container = containerRef.current
      if (!container) return

      const containerWidth = container.clientWidth
      const ellipsisWidth = 32 // Approximate width of ellipsis button

      // Get all variable elements and calculate their widths
      const childElements = container.querySelectorAll('.gedit-m-variable-item')
      let totalWidth = 0
      let fitCount = 0

      for (let i = 0; i < childElements.length; i++) {
        const element = childElements[i] as HTMLElement
        const width = element.offsetWidth + 5 // Add 5px gap

        if (totalWidth + width + ellipsisWidth <= containerWidth) {
          totalWidth += width
          fitCount++
        } else {
          break
        }
      }

      setVisibleCount(fitCount)
    })

    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [childEntries.length])

  // Show all variables when there are 3 or fewer, otherwise use width calculation
  const shouldShowAll = childEntries.length <= 3
  const displayCount = shouldShowAll ? childEntries.length : visibleCount !== null ? visibleCount : childEntries.length
  const displayEntries = childEntries.slice(0, displayCount)
  const hiddenEntries = childEntries.slice(displayCount)
  const hiddenCount = hiddenEntries.length

  // Create content for tooltip showing hidden variables
  const hiddenVariablesContent =
    hiddenEntries.length > 0 ? (
      <div
        style={{
          maxWidth: '300px',
          padding: '8px 10px',
          display: 'flex',
          gap: '5px',
          flexWrap: 'wrap',
          backgroundColor: '#ffffff',
          borderRadius: '4px',
        }}
      >
        {hiddenEntries.map(([key, value]) => {
          if (FlowValueUtils.isFlowValue(value)) {
            return (
              <DisplayFlowValue key={key} title={key} value={value} showIconInTree={showIconInTree} node={node} includePrivateScope={includePrivateScope} />
            )
          }

          if (isPlainObject(value)) {
            return <DisplayInputsValueAllInTag key={key} title={key} value={value} showIconInTree={showIconInTree} />
          }

          return null
        })}
      </div>
    ) : null

  return (
    <div ref={containerRef} className="gedit-m-display-inputs-wrapper">
      {childEntries.map(([key, value], index) => {
        const shouldDisplay = index < displayCount

        if (!shouldDisplay) return null

        if (FlowValueUtils.isFlowValue(value)) {
          return (
            <div key={key} className="gedit-m-variable-item">
              <DisplayFlowValue title={key} value={value} showIconInTree={showIconInTree} node={node} includePrivateScope={includePrivateScope} />
            </div>
          )
        }

        if (isPlainObject(value)) {
          return (
            <div key={key} className="gedit-m-variable-item">
              <DisplayInputsValueAllInTag title={key} value={value} showIconInTree={showIconInTree} />
            </div>
          )
        }

        return null
      })}
      {hiddenCount > 0 && <DisplayEllipsis hiddenContent={hiddenVariablesContent} />}
    </div>
  )
}

export function DisplayInputsValueAllInTag({
  value,
  title,
  showIconInTree,
}: PropsType & {
  title: string
}) {
  const available = useScopeAvailable()

  const schema = useMemo(() => FlowValueUtils.inferJsonSchema(value, available.scope), [available.version, value])

  return <DisplaySchemaTag title={title} value={schema} showIconInTree={showIconInTree} />
}
