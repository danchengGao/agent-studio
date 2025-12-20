import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons'
import { cn } from '../../lib/utils'

export interface TreeSelectItem {
  value: string
  label: string
  keyPath: string[]
  icon?: React.ReactNode
  disabled?: boolean
  children?: TreeSelectItem[]
  rootMeta?: any
  isRoot?: boolean
}

export interface TreeSelectProps {
  value?: string
  placeholder?: string
  disabled?: boolean
  treeData: TreeSelectItem[]
  onChange?: (value: string, item: TreeSelectItem | undefined) => void
  showSearch?: boolean
  className?: string
  renderSelectedItem?: (item: TreeSelectItem | undefined) => React.ReactNode
  error?: boolean
}

const TreeSelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & { error?: boolean }
>(({ className, error, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-8 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
      error && 'border-destructive focus:ring-destructive',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDownIcon className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
TreeSelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const TreeSelectContent = React.forwardRef<React.ElementRef<typeof SelectPrimitive.Content>, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>>(
  ({ className, children, position = 'popper', ...props }, ref) => (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          'relative z-50 max-h-[--radix-select-content-available-height] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover text-popover-foreground shadow-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-select-content-transform-origin]',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
          className,
        )}
        position={position}
        {...props}
      >
        <SelectPrimitive.Viewport
          className={cn('p-1', position === 'popper' && 'h-[--radix-select-trigger-height] w-full min-w-[--radix-select-trigger-width]')}
        >
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  ),
)
TreeSelectContent.displayName = SelectPrimitive.Content.displayName

const TreeSelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & {
    item: TreeSelectItem
    level?: number
  }
>(({ className, item, level = 0, ...props }, ref) => {
  const [expanded, setExpanded] = React.useState(false)
  const hasChildren = item.children && item.children.length > 0

  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (hasChildren && !item.disabled) {
        e.preventDefault()
        setExpanded(!expanded)
      }
    },
    [hasChildren, item.disabled, expanded],
  )

  return (
    <div>
      <SelectPrimitive.Item
        ref={ref}
        className={cn(
          'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
          `pl-${Math.min(level * 4 + 2, 12)}`,
          className,
        )}
        disabled={item.disabled}
        {...props}
      >
        <div className="flex items-center flex-1">
          {hasChildren && (
            <button type="button" onClick={handleClick} className="mr-1 p-1 hover:bg-accent rounded" disabled={item.disabled}>
              <ChevronRightIcon className={cn('h-3 w-3 transition-transform', expanded && 'transform rotate-90')} />
            </button>
          )}
          {item.icon && <span className="mr-2">{item.icon}</span>}
          <SelectPrimitive.ItemText>{item.label}</SelectPrimitive.ItemText>
        </div>
      </SelectPrimitive.Item>
      {hasChildren && expanded && (
        <div className="ml-4">
          {item.children!.map(child => (
            <TreeSelectItem key={child.value} item={child} level={level + 1} value={child.value} disabled={child.disabled}>
              {child.label}
            </TreeSelectItem>
          ))}
        </div>
      )}
    </div>
  )
})
TreeSelectItem.displayName = 'TreeSelectItem'

export const TreeSelect = React.forwardRef<any, TreeSelectProps>(
  ({ value, placeholder = '选择选项', disabled = false, treeData, onChange, showSearch = false, className, renderSelectedItem, error, ...props }, ref) => {
    const [searchTerm, setSearchTerm] = React.useState('')

    const filteredTreeData = React.useMemo(() => {
      if (!showSearch || !searchTerm) return treeData

      const filterItems = (items: TreeSelectItem[]): TreeSelectItem[] => {
        return items
          .map(item => ({ ...item }))
          .filter(item => {
            const matchesSearch = item.label.toLowerCase().includes(searchTerm.toLowerCase())

            if (matchesSearch) return true

            if (item.children) {
              const filteredChildren = filterItems(item.children)
              if (filteredChildren.length > 0) {
                item.children = filteredChildren
                return true
              }
            }

            return false
          })
      }

      return filterItems(treeData)
    }, [treeData, searchTerm, showSearch])

    const flattenTree = React.useCallback((items: TreeSelectItem[]): TreeSelectItem[] => {
      const result: TreeSelectItem[] = []

      const flatten = (item: TreeSelectItem) => {
        result.push(item)
        if (item.children) {
          item.children.forEach(flatten)
        }
      }

      items.forEach(flatten)
      return result
    }, [])

    const allItems = React.useMemo(() => flattenTree(filteredTreeData), [filteredTreeData, flattenTree])

    const selectedItem = React.useMemo(() => {
      return allItems.find(item => item.value === value)
    }, [allItems, value])

    const handleValueChange = React.useCallback(
      (newValue: string) => {
        const selectedItem = allItems.find(item => item.value === newValue)
        onChange?.(newValue, selectedItem)
      },
      [allItems, onChange],
    )

    return (
      <SelectPrimitive.Root value={value} onValueChange={handleValueChange} disabled={disabled} {...props}>
        <TreeSelectTrigger error={error} className={className}>
          {renderSelectedItem ? (
            renderSelectedItem(selectedItem)
          ) : (
            <SelectPrimitive.Value placeholder={placeholder}>{selectedItem?.label}</SelectPrimitive.Value>
          )}
        </TreeSelectTrigger>

        <TreeSelectContent>
          {showSearch && (
            <div className="p-2 border-b">
              <input
                type="text"
                placeholder="搜索..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full px-2 py-1 text-sm border rounded"
              />
            </div>
          )}

          {filteredTreeData.length === 0 ? (
            <div className="p-2 text-sm text-muted-foreground text-center">没有找到匹配的选项</div>
          ) : (
            filteredTreeData.map(item => (
              <TreeSelectItem key={item.value} value={item.value} item={item} disabled={item.disabled}>
                {item.label}
              </TreeSelectItem>
            ))
          )}
        </TreeSelectContent>
      </SelectPrimitive.Root>
    )
  },
)
TreeSelect.displayName = 'TreeSelect'
