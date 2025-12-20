import React from 'react'
import { InvokeExecuteInfo } from '@test-agentstudio/api-client'
import { getStatusMeta } from './helper/statusUtils'

interface NodeDetailProps {
  node?: InvokeExecuteInfo | null
  rootName?: string
  rootId?: string
}

const NodeDetail: React.FC<NodeDetailProps> = ({ node, rootName, rootId }) => {
  if (!node) return <div className="text-xs text-gray-500">请选择节点查看详情</div>

  const formatMs = (ms?: number) => {
    if (ms == null) return '0 ms'
    const n = Number(ms) || 0
    if (n < 1000) {
      return `${n} ms`
    } else {
      return `${(n / 1000).toFixed(1)} s`
    }
  }

  const getNodeLabel = (n: InvokeExecuteInfo): string => {
    if (rootName && rootId && String(n.invoke_id) === String(rootId)) return rootName
    return n.invoke_name || n.invoke_type || '节点'
  }

  const JsonSmall = ({ data }: { data: unknown }) => {
    if (data == null) return <span className="text-xs text-gray-500">无</span>
    try {
      const text = JSON.stringify(data, null, 2)
      return (
        <pre className="text-[11px] leading-snug whitespace-pre-wrap break-words overflow-x-auto bg-white rounded border border-gray-100 p-2 text-gray-700">
          {text}
        </pre>
      )
    } catch {
      return <span className="text-xs text-gray-700">{String(data)}</span>
    }
  }

  return (
    <div className="space-y-1">
      <div className="text-xs text-gray-800 flex items-center min-w-0">
        <span className="mr-1 flex-shrink-0">节点：</span>
        <span className="truncate flex-1 min-w-0" title={getNodeLabel(node)}>
          {getNodeLabel(node)}
        </span>
      </div>
      <div className="text-xs text-gray-800">
        状态：
        <span className={`px-1.5 py-0.5 rounded-full ${getStatusMeta(node.status as string).className}`}>{getStatusMeta(node.status as string).label}</span>
      </div>
      <div className="text-xs text-gray-800">耗时：{node.duration != null ? formatMs(node.duration) : '无'}</div>
      <div className="text-xs text-gray-600 mt-1">输入</div>
      <JsonSmall data={(node.inputs && (node.inputs as any).inputs) || node.inputs} />
      <div className="text-xs text-gray-600 mt-1">输出</div>
      <JsonSmall data={(node.outputs && (node.outputs as any).outputs) || node.outputs} />
    </div>
  )
}

export default NodeDetail
