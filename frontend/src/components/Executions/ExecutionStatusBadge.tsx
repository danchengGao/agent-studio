import React from 'react'

interface ExecutionStatusBadgeProps {
  status?: string
}

const statusConfig: Record<string, { label: string; dotColor: string; bgClass: string; textClass: string; animate?: boolean }> = {
  finish: { label: 'Finished', dotColor: 'bg-green-500', bgClass: 'bg-green-50', textClass: 'text-green-700' },
  success: { label: 'Finished', dotColor: 'bg-green-500', bgClass: 'bg-green-50', textClass: 'text-green-700' },
  running: { label: 'Running', dotColor: 'bg-blue-500', bgClass: 'bg-blue-50', textClass: 'text-blue-700', animate: true },
  start: { label: 'Running', dotColor: 'bg-blue-500', bgClass: 'bg-blue-50', textClass: 'text-blue-700', animate: true },
  error: { label: 'Error', dotColor: 'bg-red-500', bgClass: 'bg-red-50', textClass: 'text-red-700' },
  fail: { label: 'Failed', dotColor: 'bg-red-500', bgClass: 'bg-red-50', textClass: 'text-red-700' },
  failed: { label: 'Failed', dotColor: 'bg-red-500', bgClass: 'bg-red-50', textClass: 'text-red-700' },
  interrupted: { label: 'Interrupted', dotColor: 'bg-orange-400', bgClass: 'bg-orange-50', textClass: 'text-orange-600' },
  cancelled: { label: 'Cancelled', dotColor: 'bg-gray-400', bgClass: 'bg-gray-50', textClass: 'text-gray-600' },
  pending: { label: 'Pending', dotColor: 'bg-yellow-400', bgClass: 'bg-yellow-50', textClass: 'text-yellow-700' },
}

const ExecutionStatusBadge: React.FC<ExecutionStatusBadgeProps> = ({ status }) => {
  const s = (status || '').toLowerCase()
  const config = statusConfig[s] || {
    label: status || 'Unknown',
    dotColor: 'bg-gray-400',
    bgClass: 'bg-gray-50',
    textClass: 'text-gray-500',
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgClass} ${config.textClass}`}>
      <span className="relative flex h-2 w-2">
        {config.animate && (
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dotColor} animate-ping`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotColor}`} />
      </span>
      {config.label}
    </span>
  )
}

export default ExecutionStatusBadge
