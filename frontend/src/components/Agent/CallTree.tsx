import React, { useEffect, useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { InvokeExecuteInfo } from '@test-agentstudio/api-client'

interface CallTreeProps {
  execList: InvokeExecuteInfo[]
  onSelect: (node: InvokeExecuteInfo) => void
  selectedId?: string
  rootLabel?: string
}

const CallTree: React.FC<CallTreeProps> = ({ execList, onSelect, selectedId, rootLabel }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  useEffect(() => {
    const rootId = execList?.[0]?.invoke_id as string
    if (rootId) setExpanded(prev => ({ ...prev, [rootId]: true }))
  }, [execList])

  const formatMs = (ms?: number) => {
    if (ms == null) return '0 ms'
    const n = Number(ms) || 0
    if (n < 1000) {
      return `${n} ms`
    } else {
      return `${(n / 1000).toFixed(1)} s`
    }
  }

  const getChildren = (node: InvokeExecuteInfo): InvokeExecuteInfo[] => {
    const a: any = node as any
    const c = a.childInvokesExecuteInfo || a.child_invokes_execute_info || []
    return Array.isArray(c) ? (c as InvokeExecuteInfo[]) : []
  }

  const getNodeLabel = (node: InvokeExecuteInfo, depth: number): string => {
    if (depth === 0 && rootLabel) return rootLabel
    return node.invoke_name || node.invoke_type || '节点'
  }

  const toggleExpand = (id?: string) => {
    if (!id) return
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const NodeRow = ({ node, depth }: { node: InvokeExecuteInfo; depth: number }) => {
    const children = getChildren(node)
    const hasChildren = children.length > 0
    const isOpen = expanded[node.invoke_id as string]
    const label = getNodeLabel(node, depth)
    const isSelected = (node.invoke_id as string) === (selectedId || '')
    const isHovered = hoveredId === (node.invoke_id as string)

    return (
      <div className="pl-2">
        <div
          className={`flex items-center text-xs py-1 rounded cursor-pointer min-w-0 ${isSelected ? 'bg-blue-50' : isHovered ? 'bg-gray-50' : ''}`}
          onMouseEnter={() => setHoveredId(node.invoke_id as string)}
          onMouseLeave={() => setHoveredId(null)}
          onClick={() => onSelect(node)}
        >
          {hasChildren ? (
            <button
              className="mr-1 text-gray-500 hover:text-gray-700"
              aria-label={isOpen ? '折叠' : '展开'}
              onClick={e => {
                e.stopPropagation()
                toggleExpand(node.invoke_id as string)
              }}
            >
              {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          ) : (
            <span className="mr-1 w-3 h-3 inline-block" />
          )}
          <span className="text-gray-800 hover:text-gray-900 inline-block max-w-[240px] truncate" title={label}>
            {label}
          </span>
          <span className={`ml-2 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-800 whitespace-nowrap`}>{formatMs(node.duration)}</span>
        </div>
        {hasChildren && isOpen && (
          <div className="ml-4 border-l border-gray-200 pl-2">
            {children.map((child, idx) => (
              <NodeRow key={(child.invoke_id || idx) as string} node={child as InvokeExecuteInfo} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {execList.map((root, idx) => (
        <NodeRow key={(root.invoke_id || idx) as string} node={root} depth={0} />
      ))}
    </div>
  )
}

export default CallTree
