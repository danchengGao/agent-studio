/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */
import React from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS as cssDndKit } from '@dnd-kit/utilities'
import { Button, IconButton } from '@douyinfe/semi-ui'
import { Plus, GripVertical, MinusCircle } from 'lucide-react'

import { cn } from '../../utils/cn'
import './styles.css'

interface DraggableItemProps {
  item: any
  index: number
  renderItem: (item: any, index: number, provided: any) => React.ReactNode
  showDragHandle?: boolean
  canDelete?: boolean
  onDelete?: (index: number) => void
  readOnly?: boolean
  itemIdKey?: string
  isDragDisabled?: boolean
  isDeleteDisabled?: boolean
}

const SortableItem: React.FC<DraggableItemProps> = ({
  item,
  index,
  renderItem,
  showDragHandle = true,
  canDelete = true,
  onDelete,
  readOnly = false,
  itemIdKey = 'id',
  isDragDisabled = false,
  isDeleteDisabled = false,
}) => {
  const itemId = item[itemIdKey] || (typeof item === 'string' ? `string_index_${index}` : `object_index_${index}`)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: itemId,
    transition: null,
    disabled: isDragDisabled,
  })

  const style = {
    transform: cssDndKit.Transform.toString(transform),
    transition: 'none',
  }

  return (
    <div ref={setNodeRef} style={style} className={cn('group-item', isDragging && 'dragging', readOnly && 'read-only')} {...attributes}>
      {showDragHandle && !readOnly && (
        <div {...(!isDragDisabled ? listeners : {})} className={cn('drag-handle', isDragging && 'dragging', isDragDisabled && 'disabled')}>
          <GripVertical size={14} />
        </div>
      )}

      <div className="item-content">{renderItem(item, index, { isDragging, listeners })}</div>

      {canDelete && !readOnly && (
        <IconButton
          size="small"
          onClick={() => !isDeleteDisabled && onDelete?.(index)}
          className={cn('delete-button', isDeleteDisabled && 'disabled')}
          icon={<MinusCircle size={12} />}
          disabled={isDeleteDisabled}
        />
      )}
    </div>
  )
}

interface DraggableListProps {
  items: any[]
  onChange: (items: any[]) => void
  renderItem: (item: any, index: number, provided: any) => React.ReactNode
  onAdd?: () => void
  onDelete?: (index: number) => void
  readOnly?: boolean
  canAdd?: boolean
  canDelete?: boolean
  showDragHandle?: boolean
  itemIdKey?: string
  addButtonLabel?: string
  className?: string
  style?: React.CSSProperties
  emptyState?: React.ReactNode
  isDragDisabled?: (index: number) => boolean
  isDeleteDisabled?: (index: number) => boolean
}

export const DraggableList: React.FC<DraggableListProps> = ({
  items,
  onChange,
  renderItem,
  onAdd,
  onDelete,
  readOnly = false,
  canAdd = true,
  canDelete = true,
  showDragHandle = true,
  itemIdKey = 'id',
  addButtonLabel = '添加',
  className,
  style,
  emptyState,
  isDragDisabled,
  isDeleteDisabled,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    if (readOnly) return

    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item, index) => {
        const itemId = item[itemIdKey] || (typeof item === 'string' ? `string_index_${index}` : `object_index_${index}`)
        return itemId === active.id
      })
      const newIndex = items.findIndex((item, index) => {
        const itemId = item[itemIdKey] || (typeof item === 'string' ? `string_index_${index}` : `object_index_${index}`)
        return itemId === over.id
      })

      if (oldIndex !== -1 && newIndex !== -1) {
        const newItems = arrayMove(items, oldIndex, newIndex)
        onChange(newItems)
      }
    }
  }

  const handleDelete = (index: number) => {
    const newItems = items.filter((_, i) => i !== index)
    onChange(newItems)
    onDelete?.(index)
  }

  const renderEmptyState = () => {
    if (emptyState) {
      return emptyState
    }

    return (
      <div className="empty-state">
        <div className="empty-content">
          <div className="empty-icon">
            <Plus size={24} />
          </div>
          <div className="empty-text">暂无数据，点击下方按钮添加</div>
        </div>
      </div>
    )
  }

  const content = (
    <div className={cn('draggable-list', className)} style={style}>
      {/* 列表项 */}
      {items.map((item, index) => (
        <SortableItem
          key={item[itemIdKey] || index}
          item={item}
          index={index}
          renderItem={renderItem}
          showDragHandle={showDragHandle}
          canDelete={canDelete}
          onDelete={handleDelete}
          readOnly={readOnly}
          itemIdKey={itemIdKey}
          isDragDisabled={isDragDisabled?.(index) || false}
          isDeleteDisabled={isDeleteDisabled?.(index) || false}
        />
      ))}

      {/* 空状态 */}
      {items.length === 0 && renderEmptyState()}

      {/* 添加按钮 */}
      {canAdd && !readOnly && (
        <div className="add-item-section">
          <Button type="tertiary" icon={<Plus size={14} />} onClick={onAdd} block size="small">
            {addButtonLabel}
          </Button>
        </div>
      )}
    </div>
  )

  if (readOnly || !showDragHandle) {
    return content
  }

  const sortableItems = items.map((item, index) => {
    const itemId = item[itemIdKey]
    if (itemId) {
      return { id: itemId, value: item }
    }
    return {
      id: typeof item === 'string' ? `string_index_${index}` : `object_index_${index}`,
      value: item,
    }
  })

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortableItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
        {content}
      </SortableContext>
    </DndContext>
  )
}
