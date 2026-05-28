import React, { useMemo } from 'react'
import { CircularProgress } from '@mui/material'
import type { InvokeExecuteInfo } from '@test-agentstudio/api-client'
import ExecutionNodeTooltip from './ExecutionNodeTooltip'

// Flexible detail type that works with both ExecutionLogSummary (numeric status)
// and AgentExecutionLogSummary (string status)
export interface WaterfallDetail {
  status?: number | string
  duration?: number
  input_tokens?: number
  inputTokens?: number
  output_tokens?: number
  outputTokens?: number
  execute_info_list?: InvokeExecuteInfo[]
  executeInfoList?: InvokeExecuteInfo[]
}

const summaryStatusLabel = (status: number | string | undefined): string => {
  if (status === 0 || status === 'finish' || status === 'success') return 'Finished'
  if (status === 1 || status === 'fail' || status === 'error' || status === 'failed') return 'Failed'
  if (status === 2 || status === 'running' || status === 'start') return 'Running'
  if (status === 3 || status === 'interrupted') return 'Interrupted'
  return String(status ?? 'Unknown')
}

interface ExecutionWaterfallProps {
  detail: WaterfallDetail | null
  isLoading: boolean
}

interface FlatRow {
  node: InvokeExecuteInfo
  depth: number
}

const getChildren = (node: InvokeExecuteInfo): InvokeExecuteInfo[] => {
  const c = (node as any).childInvokesExecuteInfo || (node as any).child_invokes_execute_info || []
  return Array.isArray(c) ? c : []
}

const flattenExecTree = (nodes: InvokeExecuteInfo[], depth = 0): FlatRow[] => {
  const result: FlatRow[] = []
  for (const node of nodes) {
    result.push({ node, depth })
    const children = getChildren(node)
    if (children.length > 0) {
      result.push(...flattenExecTree(children, depth + 1))
    }
  }
  return result
}

const formatMs = (ms?: number): string => {
  if (ms == null) return '0ms'
  const n = Number(ms) || 0
  if (n < 1000) return `${n}ms`
  if (n < 60000) return `${(n / 1000).toFixed(1)}s`
  return `${(n / 60000).toFixed(1)}m`
}

const colorForType = (type: string, status?: string): string => {
  const s = (status || '').toLowerCase()
  if (s === 'error' || s === 'fail' || s === 'failed') return '#ef4444'
  if (s === 'running' || s === 'start') return '#3b82f6'

  const key = (type || '').toLowerCase()
  if (key.includes('llm')) return '#7c3aed'
  if (key.includes('workflow')) return '#0ea5e9'
  if (key.includes('start')) return '#16a34a'
  if (key.includes('end')) return '#6b7280'
  if (key.includes('plugin')) return '#f59e0b'
  if (key.includes('agent')) return '#14b8a6'
  if (key.includes('code')) return '#ec4899'
  if (key.includes('condition')) return '#8b5cf6'
  if (key.includes('loop')) return '#06b6d4'
  return '#6b7280'
}

const pickTickStep = (total: number, targetTicks = 6): number => {
  const rough = Math.max(1, total) / Math.max(1, targetTicks)
  if (!isFinite(rough) || rough <= 0) return 1
  const power = Math.floor(Math.log10(rough))
  const base = Math.pow(10, power)
  const norm = rough / base
  const grid = 0.25
  const niceNorm = Math.min(10, Math.ceil(norm / grid) * grid)
  return niceNorm * base
}

const computeAxis = (total: number): { marks: { value: number; label: string }[]; max: number } => {
  const step = pickTickStep(total)
  const max = Math.ceil(Math.max(1, total) / step) * step
  const marks: { value: number; label: string }[] = []
  for (let v = 0; v <= max; v += step) {
    marks.push({ value: v, label: v < 1000 ? `${v}ms` : `${(v / 1000).toFixed(1)}s` })
  }
  return { marks, max }
}

const NAME_COL_WIDTH = 200
const BAR_HEIGHT = 28
const ROW_GAP = 2

const ExecutionWaterfall: React.FC<ExecutionWaterfallProps> = ({ detail, isLoading }) => {
  const rows = useMemo(() => {
    if (!detail) return []
    const execList = detail.execute_info_list || detail.executeInfoList || []
    return flattenExecTree(execList)
  }, [detail])

  const { totalDuration, axis } = useMemo(() => {
    if (!detail || rows.length === 0) {
      return { totalDuration: 0, axis: { marks: [], max: 0 } }
    }
    // Find maximum end time across all nodes
    let maxEnd = detail.duration || 0
    for (const { node } of rows) {
      const start = Number(node.start_timestamp ?? node.startTimestamp ?? 0)
      const dur = Number(node.duration ?? 0)
      maxEnd = Math.max(maxEnd, start + dur)
    }
    const td = Math.max(maxEnd, 1)
    return { totalDuration: td, axis: computeAxis(td) }
  }, [detail, rows])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <CircularProgress size={28} />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Select an execution to view details
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No execution data available
      </div>
    )
  }

  const axisMax = axis.max || totalDuration

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary header */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-200 bg-gray-50 text-xs text-gray-600 shrink-0">
        <span>Status: <span className="font-medium">{summaryStatusLabel(detail.status)}</span></span>
        <span>Duration: <span className="font-medium">{formatMs(detail.duration)}</span></span>
        {(detail.input_tokens || detail.inputTokens) != null && (
          <span>Tokens: {detail.input_tokens || detail.inputTokens} in / {detail.output_tokens || detail.outputTokens || 0} out</span>
        )}
        <span className="text-gray-400">Nodes: {rows.length}</span>
      </div>

      {/* Scrollable waterfall area */}
      <div className="flex-1 overflow-auto">
        <div style={{ minWidth: NAME_COL_WIDTH + 400 }}>
          {/* Time axis */}
          <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
            <div style={{ width: NAME_COL_WIDTH, minWidth: NAME_COL_WIDTH }} className="shrink-0 px-3 py-1.5 text-xs text-gray-500 font-medium border-r border-gray-100">
              Node
            </div>
            <div className="flex-1 relative h-7">
              {axis.marks.map(mark => {
                const left = axisMax > 0 ? (mark.value / axisMax) * 100 : 0
                return (
                  <div
                    key={mark.value}
                    className="absolute top-0 bottom-0 text-[10px] text-gray-400"
                    style={{ left: `${left}%` }}
                  >
                    <div className="h-full border-l border-gray-100" />
                    <span className="absolute -top-0.5 -translate-x-1/2 whitespace-nowrap">{mark.label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Waterfall rows */}
          {rows.map(({ node, depth }, idx) => {
            const start = Number(node.start_timestamp ?? node.startTimestamp ?? 0)
            const dur = Number(node.duration ?? 0)
            const leftPct = axisMax > 0 ? (start / axisMax) * 100 : 0
            const widthPct = axisMax > 0 ? Math.max((dur / axisMax) * 100, 0.5) : 0.5
            const name = node.invoke_name || node.invokeName || node.invoke_type || node.invokeType || 'Node'
            const type = node.invoke_type || node.invokeType || ''
            const status = (node.status || '').toLowerCase()
            const isRunning = status === 'running' || status === 'start'
            const barColor = colorForType(type, node.status)

            return (
              <ExecutionNodeTooltip key={`${node.invoke_id || node.invokeId}-${idx}`} node={node}>
                <div
                  className="flex items-center border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                  style={{ height: BAR_HEIGHT + ROW_GAP }}
                >
                  {/* Node name column */}
                  <div
                    style={{ width: NAME_COL_WIDTH, minWidth: NAME_COL_WIDTH, paddingLeft: 12 + depth * 16 }}
                    className="shrink-0 text-xs text-gray-700 truncate border-r border-gray-100 h-full flex items-center"
                    title={name}
                  >
                    {name}
                  </div>

                  {/* Bar area */}
                  <div className="flex-1 relative h-full flex items-center px-1">
                    {/* Grid lines */}
                    {axis.marks.map(mark => {
                      const ml = axisMax > 0 ? (mark.value / axisMax) * 100 : 0
                      return (
                        <div
                          key={mark.value}
                          className="absolute top-0 bottom-0 border-l border-gray-50"
                          style={{ left: `${ml}%` }}
                        />
                      )
                    })}

                    {/* The bar */}
                    <div
                      className={`absolute rounded-sm transition-all ${isRunning ? 'animate-pulse' : ''}`}
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        minWidth: 4,
                        height: BAR_HEIGHT - 6,
                        backgroundColor: barColor,
                        opacity: isRunning ? undefined : 0.85,
                      }}
                    >
                      {/* Duration label on bar if wide enough */}
                      {widthPct > 5 && (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-medium truncate px-1">
                          {formatMs(dur)}
                        </span>
                      )}
                    </div>

                    {/* Duration label outside bar if too narrow */}
                    {widthPct <= 5 && dur > 0 && (
                      <span
                        className="absolute text-[10px] text-gray-500 whitespace-nowrap"
                        style={{ left: `calc(${leftPct + widthPct}% + 4px)`, top: '50%', transform: 'translateY(-50%)' }}
                      >
                        {formatMs(dur)}
                      </span>
                    )}
                  </div>
                </div>
              </ExecutionNodeTooltip>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ExecutionWaterfall
