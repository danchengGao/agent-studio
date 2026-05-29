import React from 'react'
import { Tooltip } from '@mui/material'
import type { InvokeExecuteInfo } from '@test-agentstudio/api-client'

interface ExecutionNodeTooltipProps {
  node: InvokeExecuteInfo
  children: React.ReactElement
}

const truncate = (val: unknown, maxLen = 300): string => {
  if (val == null) return '-'
  const str = typeof val === 'string' ? val : JSON.stringify(val)
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str
}

const formatMs = (ms?: number): string => {
  if (ms == null) return '-'
  const n = Number(ms) || 0
  return n < 1000 ? `${n} ms` : `${(n / 1000).toFixed(1)} s`
}

const getStatus = (node: InvokeExecuteInfo): string => {
  return (node.status || '').toLowerCase()
}

const TooltipContent: React.FC<{ node: InvokeExecuteInfo }> = ({ node }) => {
  const s = getStatus(node)
  const isRunning = s === 'running' || s === 'start'
  const isError = s === 'error' || s === 'fail' || s === 'failed'
  const name = node.invoke_name || node.invokeName || node.invoke_type || node.invokeType || 'Node'
  const type = node.invoke_type || node.invokeType || ''

  return (
    <div className="max-w-sm text-xs space-y-1.5 p-1">
      <div className="font-semibold text-sm">{name}</div>
      {type && <div className="text-gray-400">Type: {type}</div>}

      {!isRunning && (
        <div>Duration: {formatMs(node.duration)}</div>
      )}

      {isRunning && (
        <div className="text-blue-400 font-medium flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Running...
        </div>
      )}

      {node.inputs && (
        <div>
          <span className="text-gray-400">Inputs: </span>
          <span className="break-all">{truncate(node.inputs)}</span>
        </div>
      )}

      {!isRunning && node.outputs && (
        <div>
          <span className="text-gray-400">Outputs: </span>
          <span className="break-all">{truncate(node.outputs)}</span>
        </div>
      )}

      {isError && node.outputs && (
        <div className="text-red-400">
          Error: {truncate(node.outputs, 200)}
        </div>
      )}

      {(node.input_tokens || node.inputTokens) && (
        <div className="text-gray-400">
          Tokens: {node.input_tokens || node.inputTokens} in / {node.output_tokens || node.outputTokens || 0} out
        </div>
      )}
    </div>
  )
}

const ExecutionNodeTooltip: React.FC<ExecutionNodeTooltipProps> = ({ node, children }) => {
  return (
    <Tooltip
      title={<TooltipContent node={node} />}
      placement="top"
      arrow
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: 'rgba(30, 30, 30, 0.95)',
            maxWidth: 400,
            '& .MuiTooltip-arrow': { color: 'rgba(30, 30, 30, 0.95)' },
          },
        },
      }}
    >
      {children}
    </Tooltip>
  )
}

export default ExecutionNodeTooltip
