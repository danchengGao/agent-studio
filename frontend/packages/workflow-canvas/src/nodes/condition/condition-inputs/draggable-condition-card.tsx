/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS as cssDndKit } from '@dnd-kit/utilities'

import { ConditionCard, ConditionCardProps } from './condition-card'

interface DraggableConditionCardProps extends Omit<ConditionCardProps, 'enableDrag' | 'dragHandleProps' | 'isDragging'> {
  id: string
  isDragDisabled?: boolean
}

const DraggableConditionCard: React.FC<DraggableConditionCardProps> = ({ id, isDragDisabled = false, ...conditionCardProps }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id,
    disabled: isDragDisabled,
    transition: {
      duration: 150,
      easing: 'cubic-bezier(0.2, 0, 0, 1)',
    },
  })

  const style = {
    transform: cssDndKit.Transform.toString(transform),
    transition: isDragging ? 'none' : 'transform 150ms cubic-bezier(0.2, 0, 0, 1)',
    zIndex: isDragging ? 1000 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <ConditionCard {...conditionCardProps} enableDrag={true} dragHandleProps={listeners} isDragging={isDragging} />
    </div>
  )
}

DraggableConditionCard.displayName = 'DraggableConditionCard'

export { DraggableConditionCard }
export default DraggableConditionCard
