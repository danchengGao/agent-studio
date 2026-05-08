import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, IconButton, Tooltip, CircularProgress, Typography,
  Pagination, Box,
} from '@mui/material'
import { RefreshCw, ExternalLink } from 'lucide-react'
import { useTriggerExecutionLogs } from '@test-agentstudio/api-client'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import type { TriggerExecutionLog, ExecutionStatus } from '@/types/triggerTypes'

interface TriggerExecutionHistoryProps {
  spaceId: string
  triggerId: string
}

const STATUS_COLORS: Record<ExecutionStatus, 'success' | 'error' | 'default' | 'warning'> = {
  success: 'success',
  error: 'error',
  skipped: 'default',
  running: 'warning',
}

const TriggerExecutionHistory: React.FC<TriggerExecutionHistoryProps> = ({ spaceId, triggerId }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const { data, isLoading, refetch } = useTriggerExecutionLogs(spaceId, triggerId, page, PAGE_SIZE)

  const logs: TriggerExecutionLog[] = (data?.data as any)?.items || []
  const total: number = (data?.data as any)?.total || 0

  const formatDuration = (ms?: number | null) => {
    if (ms == null) return '—'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatTime = (ts?: number | null) => {
    if (!ts) return '—'
    return dayjs(ts).format('MM-DD HH:mm:ss')
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Typography variant="subtitle1" fontWeight="medium">
          {t('triggers.executionHistory.title', 'Execution History')}
        </Typography>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </IconButton>
        </Tooltip>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <CircularProgress size={24} />
        </div>
      ) : logs.length === 0 ? (
        <Typography variant="body2" color="text.secondary" className="py-8 text-center">
          {t('triggers.executionHistory.noLogs', 'No executions yet')}
        </Typography>
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('triggers.executionHistory.startedAt', 'Started')}</TableCell>
                  <TableCell>{t('triggers.executionHistory.duration', 'Duration')}</TableCell>
                  <TableCell>{t('triggers.executionHistory.status', 'Status')}</TableCell>
                  <TableCell>{t('triggers.executionHistory.firedBy', 'Fired By')}</TableCell>
                  <TableCell align="center">{t('triggers.executionHistory.viewTrace', 'Trace')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log.id} hover>
                    <TableCell>
                      <Typography variant="caption">{formatTime(log.started_at)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{formatDuration(log.duration_ms)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={t(`triggers.executionStatus.${log.status}`, log.status)}
                        color={STATUS_COLORS[log.status] || 'default'}
                        size="small"
                        sx={log.status === 'running' ? { animation: 'pulse 2s infinite' } : {}}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {log.fired_by ? t(`triggers.firedBy.${log.fired_by}`, log.fired_by) : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {log.trace_id ? (
                        <Tooltip title={t('triggers.executionHistory.viewTrace', 'View Trace')}>
                          <IconButton
                            size="small"
                            onClick={() => {
                              if (log.trace_id) {
                                const path = log.trigger_type === 'agent'
                                  ? `/dashboard/agents?trace_id=${log.trace_id}`
                                  : `/dashboard/workflows?trace_id=${log.trace_id}`
                                window.open(path, '_blank')
                              }
                            }}
                          >
                            <ExternalLink size={14} />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Typography variant="caption" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {total > PAGE_SIZE && (
            <Box className="flex justify-center">
              <Pagination
                count={Math.ceil(total / PAGE_SIZE)}
                page={page}
                onChange={(_, v) => setPage(v)}
                size="small"
              />
            </Box>
          )}
        </>
      )}
    </div>
  )
}

export default TriggerExecutionHistory
