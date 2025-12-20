/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import React, { useEffect, useRef, useState } from 'react'

import { IJsonSchema, JsonSchemaTypeManager, JsonSchemaUtils } from '@flowgram.ai/json-schema'
import { useCurrentScope, useRefresh } from '@flowgram.ai/editor'

import { DisplaySchemaTag } from '../../'
import { DisplayEllipsis } from '../display-ellipsis'

import './styles.css'

interface PropsType {
  value?: IJsonSchema
  showIconInTree?: boolean
  displayFromScope?: boolean
  typeManager?: JsonSchemaTypeManager
}

export function DisplayOutputs({ value, showIconInTree, displayFromScope }: PropsType) {
  const scope = useCurrentScope()
  const refresh = useRefresh()
  const containerRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState<number | null>(null)

  useEffect(() => {
    if (!displayFromScope || !scope) {
      return () => null
    }

    const disposable = scope.output.onListOrAnyVarChange(() => {
      refresh()
    })

    return () => {
      disposable.dispose()
    }
  }, [displayFromScope])

  const properties: IJsonSchema['properties'] = displayFromScope
    ? (scope?.output.variables || []).reduce((acm, curr) => {
        acm = {
          ...acm,
          ...(JsonSchemaUtils.astToSchema(curr.type)?.properties || {}),
        }
        return acm
      }, {})
    : value?.properties || {}

  const childEntries = Object.entries(properties || {})

  // Calculate how many items can fit in the container
  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver(() => {
      const container = containerRef.current
      if (!container) return

      const containerWidth = container.clientWidth
      const ellipsisWidth = 32 // Approximate width of ellipsis button

      // Get all variable elements and calculate their widths
      const childElements = container.querySelectorAll('.gedit-m-output-item')
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

  // Create content for tooltip showing hidden outputs
  const hiddenOutputsContent =
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
        {hiddenEntries.map(([key, schema]) => (
          <DisplaySchemaTag key={key} title={key} value={schema} showIconInTree={showIconInTree} warning={!schema} />
        ))}
      </div>
    ) : null

  return (
    <div ref={containerRef} className="gedit-m-display-outputs-wrapper">
      {childEntries.map(([key, schema], index) => {
        const shouldDisplay = index < displayCount

        if (!shouldDisplay) return null

        return (
          <div key={key} className="gedit-m-output-item">
            <DisplaySchemaTag title={key} value={schema} showIconInTree={showIconInTree} warning={!schema} />
          </div>
        )
      })}
      {hiddenCount > 0 && <DisplayEllipsis hiddenContent={hiddenOutputsContent} />}
    </div>
  )
}
