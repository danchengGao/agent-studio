import React from 'react'
import { Box, Divider, Paper, Tooltip, Typography } from '@mui/material'
import { TaskResult } from '@/stores/useEvaluationStore'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPassed(r: TaskResult): boolean {
  return r.passed === true || (r.passed as unknown) === 1
}

function isFailed(r: TaskResult): boolean {
  return r.passed === false || (r.passed as unknown) === 0
}

function cellBg(r: TaskResult | undefined, theme: 'light'): string {
  if (!r) return '#f5f5f5'
  if (isPassed(r)) return '#2e7d32'
  if (isFailed(r)) return '#c62828'
  return '#bdbdbd'
}

function cellFg(r: TaskResult | undefined): string {
  if (!r) return '#9e9e9e'
  if (isPassed(r) || isFailed(r)) return '#fff'
  return '#616161'
}

// ─── CellTooltipContent ───────────────────────────────────────────────────────

function CellContent({ result }: { result: TaskResult }) {
  const passed = isPassed(result)
  const failed = isFailed(result)
  const label = passed ? 'PASS' : failed ? 'FAIL' : 'PENDING'
  const latency = result.latency_ms != null
    ? result.latency_ms >= 1000
      ? `${(result.latency_ms / 1000).toFixed(2)}s`
      : `${result.latency_ms}ms`
    : null

  return (
    <Box sx={{ p: 0.5, minWidth: 140 }}>
      <Typography variant="caption" fontWeight={700} display="block" sx={{ color: passed ? 'success.light' : failed ? 'error.light' : 'text.secondary' }}>
        Trial #{result.trial_number} — {label}
      </Typography>
      {result.score != null && (
        <Typography variant="caption" display="block">Score: {(result.score * 100).toFixed(1)}%</Typography>
      )}
      {latency && (
        <Typography variant="caption" display="block">Latency: {latency}</Typography>
      )}
      {result.error_message && (
        <Typography variant="caption" display="block" sx={{ color: 'error.light', mt: 0.5, maxWidth: 220, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {result.error_message.slice(0, 120)}{result.error_message.length > 120 ? '…' : ''}
        </Typography>
      )}
    </Box>
  )
}

// ─── HeatmapPanel ─────────────────────────────────────────────────────────────

interface Props {
  taskResults: TaskResult[]
}

export default function HeatmapPanel({ taskResults }: Props) {
  // Group by task_id, stable insertion order
  const { taskOrder, taskNames, grouped, maxTrials, summary } = React.useMemo(() => {
    const orderArr: string[] = []
    const names: Record<string, string> = {}
    const map: Record<string, Record<number, TaskResult>> = {}

    for (const r of taskResults) {
      if (!map[r.task_id]) {
        map[r.task_id] = {}
        orderArr.push(r.task_id)
        names[r.task_id] = r.task_name || r.task_id
      }
      map[r.task_id][r.trial_number] = r
    }

    const maxT = taskResults.reduce((acc, r) => Math.max(acc, r.trial_number), 0)

    const total = orderArr.length
    let passed = 0, alwaysPass = 0, neverPass = 0
    for (const id of orderArr) {
      const results = Object.values(map[id])
      const passCount = results.filter(isPassed).length
      if (passCount > 0) passed++
      if (passCount === results.length) alwaysPass++
      if (passCount === 0) neverPass++
    }

    return {
      taskOrder: orderArr,
      taskNames: names,
      grouped: map,
      maxTrials: maxT,
      summary: { total, passed, alwaysPass, neverPass, multiTrial: maxT > 1 },
    }
  }, [taskResults])

  const trials = Array.from({ length: maxTrials }, (_, i) => i + 1)

  if (taskOrder.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">No results to display.</Typography>
      </Box>
    )
  }

  const CELL = 36          // cell size px
  const LABEL_W = 200      // task name column width px
  const PASSED_W = 72      // passed count column width px
  const GAP = 4            // gap between cells px
  const HEADER_H = 32      // column header height px

  return (
    <Box sx={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '100%' }}>
      {/* ── Summary ──────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2.5 }}>
        <Typography variant="overline" sx={{ fontSize: '0.68rem', letterSpacing: 1.4, color: 'text.disabled', lineHeight: 1 }}>
          Summary
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Tasks', value: String(summary.total), color: 'text.primary' },
          {
            label: 'Passed',
            value: `${summary.passed} / ${summary.total}`,
            color: summary.passed === summary.total ? '#2e7d32' : summary.passed === 0 ? '#c62828' : 'text.primary',
          },
          ...(summary.multiTrial ? [
            {
              label: 'Always Pass',
              value: String(summary.alwaysPass),
              color: summary.alwaysPass > 0 ? '#2e7d32' : 'text.secondary' as string,
            },
            {
              label: 'Never Pass',
              value: String(summary.neverPass),
              color: summary.neverPass > 0 ? '#c62828' : 'text.secondary' as string,
            },
          ] : []),
        ].map(({ label, value, color }) => (
          <Paper
            key={label}
            variant="outlined"
            sx={{ px: 2, py: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25, minWidth: 90, textAlign: 'center' }}
          >
            <Typography variant="h6" fontWeight={700} sx={{ color }}>{value}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>{label}</Typography>
          </Paper>
        ))}
        </Box>
      </Box>

      <Divider sx={{ mb: 2.5 }} />

      {/* ── Trial Results ─────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="overline" sx={{ fontSize: '0.68rem', letterSpacing: 1.4, color: 'text.disabled', lineHeight: 1 }}>
          Trial Results
        </Typography>
      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>Legend:</Typography>
        {[
          { color: '#2e7d32', label: 'Pass' },
          { color: '#c62828', label: 'Fail' },
          { color: '#bdbdbd', label: 'Pending' },
          { color: '#f5f5f5', label: 'No trial' },
        ].map(({ color, label }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: color, border: '1px solid rgba(0,0,0,0.12)' }} />
            <Typography variant="caption" color="text.secondary">{label}</Typography>
          </Box>
        ))}
      </Box>

      {/* Grid */}
      <Box sx={{ display: 'inline-flex', flexDirection: 'column', gap: `${GAP}px` }}>

        {/* Column headers row */}
        <Box sx={{ display: 'flex', gap: `${GAP}px`, alignItems: 'center' }}>
          {/* Task name header */}
          <Box sx={{ width: LABEL_W, flexShrink: 0 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Task
            </Typography>
          </Box>
          {/* Passed header */}
          <Box sx={{ width: PASSED_W, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Passed
            </Typography>
          </Box>
          {/* Trial headers */}
          {trials.map((t) => (
            <Box
              key={t}
              sx={{
                width: CELL, height: HEADER_H, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.65rem' }}>
                T{t}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Task rows */}
        {taskOrder.map((taskId) => {
          const trialMap = grouped[taskId]
          const passedCount = Object.values(trialMap).filter(isPassed).length
          const totalTrials = Object.keys(trialMap).length
          const allPass = passedCount === totalTrials
          const nonePass = passedCount === 0

          return (
            <Box key={taskId} sx={{ display: 'flex', gap: `${GAP}px`, alignItems: 'center' }}>

              {/* Col 1: Task name */}
              <Tooltip title={taskNames[taskId]} placement="right" arrow>
                <Box sx={{ width: LABEL_W, flexShrink: 0, pr: 1 }}>
                  <Typography
                    variant="caption"
                    noWrap
                    sx={{ display: 'block', lineHeight: `${CELL}px`, color: 'text.primary', fontSize: '0.72rem' }}
                  >
                    {taskNames[taskId]}
                  </Typography>
                </Box>
              </Tooltip>

              {/* Col 2: Passed count */}
              <Box
                sx={{
                  width: PASSED_W, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: CELL,
                }}
              >
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={{
                    fontSize: '0.75rem',
                    color: allPass ? '#2e7d32' : nonePass ? '#c62828' : 'text.primary',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {passedCount}/{totalTrials}
                </Typography>
              </Box>

              {/* Col 3: Trial cells */}
              {trials.map((t) => {
                const result = trialMap[t]
                const bg = cellBg(result, 'light')
                const fg = cellFg(result)
                const scoreText = result?.score != null
                  ? `${Math.round(result.score * 100)}%`
                  : null

                const cell = (
                  <Paper
                    key={t}
                    elevation={0}
                    sx={{
                      width: CELL,
                      height: CELL,
                      flexShrink: 0,
                      bgcolor: bg,
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(0,0,0,0.08)',
                      transition: 'opacity 0.1s',
                      '&:hover': result ? { opacity: 0.85 } : {},
                    }}
                  >
                    {scoreText && (
                      <Typography sx={{ fontSize: '0.55rem', color: fg, fontWeight: 700, lineHeight: 1 }}>
                        {scoreText}
                      </Typography>
                    )}
                  </Paper>
                )

                return result ? (
                  <Tooltip key={t} title={<CellContent result={result} />} arrow placement="top">
                    {cell}
                  </Tooltip>
                ) : cell
              })}
            </Box>
          )
        })}
      </Box>
      </Box>
    </Box>
  )
}
