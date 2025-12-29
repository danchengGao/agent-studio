import React, { useEffect, useMemo, useRef } from 'react'
import { Select, CircularProgress } from '@mui/material'
import { AlertCircle } from 'lucide-react'
import { useWorkflowVersions } from '@/hooks/useWorkflowVersions'
import { renderVersionMenuItems } from '@/utils/versionMenu'

export const VersionField: React.FC<{
  workflowId?: string
  value?: string
  onChange?: (v: string) => void
  spaceId: string
  readonly?: boolean
  refreshToken?: number
}> = ({ workflowId, value, onChange, spaceId, readonly = false, refreshToken }) => {
  const workflows = useMemo(() => (workflowId ? ([{ workflow_id: workflowId }] as any[]) : []), [workflowId])
  const { versionsMap, loading, refresh } = useWorkflowVersions(workflows as any, spaceId, !!workflowId)
  const latest = workflowId ? versionsMap[workflowId]?.latestPublished || 'draft' : 'draft'
  const normalized = !value || value === '' ? 'draft' : value
  const lastRefreshRef = useRef<number | undefined>(refreshToken)
  useEffect(() => {
    if ((value === undefined || value === null) && workflowId) {
      onChange?.(latest)
    } else if (value === '' && workflowId) {
      onChange?.('draft')
    }
  }, [latest, workflowId])
  useEffect(() => {
    if (!workflowId) return
    if (refreshToken === undefined) return
    if (lastRefreshRef.current === refreshToken) return
    lastRefreshRef.current = refreshToken
    refresh().catch(() => {})
  }, [refreshToken, refresh, workflowId])
  const ready = !!workflowId && !loading && !!versionsMap[workflowId]
  if (!workflowId) return null
  if (!ready) {
    return (
      <div className="inline-flex items-center gap-2 text-xs text-gray-500">
        <CircularProgress size={16} />
        <span>加载版本...</span>
      </div>
    )
  }
  const hint =
    normalized === 'draft' ? (
      <span className="inline-flex items-center text-xs text-gray-500 leading-[18px]">
        <AlertCircle className="w-4 h-4 mr-1" />
        跟随最新内容
      </span>
    ) : latest && normalized !== latest ? (
      <span className="inline-flex items-center text-xs text-amber-600 leading-[18px]">
        <AlertCircle className="w-4 h-4 mr-1" />
        存在新版本
      </span>
    ) : (
      <span className="inline-flex items-center text-xs text-gray-500 leading-[18px]">最新发布版本</span>
    )
  if (readonly || !onChange) {
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        <span className="leading-[18px]">{normalized === 'draft' ? '草稿' : normalized}</span>
        {hint}
      </span>
    )
  }
  return (
    <div className="flex flex-row items-center gap-2">
      <Select
        size="small"
        value={normalized}
        onChange={e => onChange(e.target.value as string)}
        displayEmpty
        disabled={!workflowId || loading}
        sx={{ minWidth: 120, width: 'fit-content', fontSize: '0.8rem', '& .MuiSelect-select': { py: 0.25, px: 1.25, lineHeight: '18px', fontSize: '0.8rem' } }}
        MenuProps={{ PaperProps: { sx: { maxHeight: 180 } } }}
      >
        {workflowId ? renderVersionMenuItems(workflowId, versionsMap, { includeDraft: true, itemSx: { fontSize: '0.8rem', py: 0.25 } }) : null}
      </Select>
      {hint}
    </div>
  )
}
