import React from 'react'
import { InvokeExecuteInfo } from '@test-agentstudio/api-client'
import { getStatusMeta } from './helper/statusUtils'
import { useScopedTranslation } from '@/i18n'

interface NodeDetailProps {
  node?: InvokeExecuteInfo | null
  rootName?: string
  rootId?: string
}

const NodeDetail: React.FC<NodeDetailProps> = ({ node, rootName, rootId }) => {
  const { t } = useScopedTranslation('agents.agentEditor.previewDebug.agentDebugPanel.nodeDetail')
  if (!node) return <div className="text-xs text-gray-500">{t('empty.noNode')}</div>

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
    // 处理知识库检索节点的显示名称
    if (n.invoke_type === 'retriever' || n.invoke_name === 'knowledge_base_retrieval') {
      return t('labels.knowledgeBaseRetrieval')
    }
    return n.invoke_name || n.invoke_type || t('labels.nodeFallback')
  }

  const JsonSmall = ({ data }: { data: unknown }) => {
    if (data == null) return <span className="text-xs text-gray-500">{t('labels.none')}</span>
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
        <span className="mr-1 flex-shrink-0">{t('labels.node')}：</span>
        <span className="truncate flex-1 min-w-0" title={getNodeLabel(node)}>
          {getNodeLabel(node)}
        </span>
      </div>
      <div className="text-xs text-gray-800">
        {t('labels.status')}：
        <span className={`px-1.5 py-0.5 rounded-full ${getStatusMeta(node.status as string).className}`}>{getStatusMeta(node.status as string).label}</span>
      </div>
      <div className="text-xs text-gray-800">
        {t('labels.duration')}：{node.duration != null ? formatMs(node.duration) : t('labels.none')}
      </div>
      <div className="text-xs text-gray-600 mt-1">{t('labels.input')}</div>
      <JsonSmall data={(node.inputs && (node.inputs as any).inputs) || node.inputs} />
      <div className="text-xs text-gray-600 mt-1">{t('labels.output')}</div>
      <JsonSmall data={(node.outputs && (node.outputs as any).outputs) || node.outputs} />
    </div>
  )
}

export default NodeDetail
