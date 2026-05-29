import { useState } from 'react'
import {
  Box, Dialog, DialogContent, DialogTitle, Divider, IconButton, LinearProgress,
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tooltip, Typography,
} from '@mui/material'
import { Activity, CheckCircle, ShieldCheck, ShieldX, Shuffle, Star, TrendingUp, X, XCircle } from 'lucide-react'
import { EvaluationResults, TaskResult } from '@/stores/useEvaluationStore'
import { HELP_TEXT } from './helpTextConstants'
import { type ReactNode } from 'react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(n: number | undefined | null): string {
  if (n == null) return '—'
  return `${(n * 100).toFixed(1)}%`
}

function isPassed(r: TaskResult): boolean {
  return r.passed === true || (r.passed as unknown) === 1
}

// ─── Task breakdown computation ───────────────────────────────────────────────

interface TaskSummary {
  taskId: string
  taskName: string
  passCount: number
  totalTrials: number
  passRate: number
  avgScore: number | null
}

function computeTaskBreakdown(taskResults: TaskResult[]): TaskSummary[] {
  const map = new Map<string, { name: string; pass: number; total: number; scores: number[] }>()
  for (const r of taskResults) {
    const entry = map.get(r.task_id) ?? { name: r.task_name ?? r.task_id, pass: 0, total: 0, scores: [] }
    entry.total += 1
    if (isPassed(r)) entry.pass += 1
    if (r.score != null) entry.scores.push(r.score)
    map.set(r.task_id, entry)
  }
  return [...map.entries()]
    .map(([taskId, e]) => ({
      taskId,
      taskName: e.name,
      passCount: e.pass,
      totalTrials: e.total,
      passRate: e.total > 0 ? e.pass / e.total : 0,
      avgScore: e.scores.length > 0 ? e.scores.reduce((a, b) => a + b, 0) / e.scores.length : null,
    }))
    .sort((a, b) => a.passRate - b.passRate)   // worst first
}

// ─── Task Breakdown Dialog ────────────────────────────────────────────────────

type BreakdownMode = 'success' | 'score'

interface TaskBreakdownDialogProps {
  open: boolean
  onClose: () => void
  mode: BreakdownMode
  tasks: TaskSummary[]
}

function TaskBreakdownDialog({ open, onClose, mode, tasks }: TaskBreakdownDialogProps) {
  const title = mode === 'success' ? 'Success Rate by Task' : 'Avg Score by Task'
  const sorted = mode === 'score'
    ? [...tasks].sort((a, b) => (a.avgScore ?? 0) - (b.avgScore ?? 0))
    : tasks   // already sorted by passRate ascending

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography fontWeight={700}>{title}</Typography>
        <IconButton size="small" onClick={onClose}><X size={16} /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Task</TableCell>
                {mode === 'success' && <TableCell align="right">Pass / Total</TableCell>}
                <TableCell align="right">{mode === 'success' ? 'Pass Rate' : 'Avg Score'}</TableCell>
                <TableCell sx={{ minWidth: 100 }}>Bar</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map(t => {
                const value = mode === 'success' ? t.passRate : (t.avgScore ?? 0)
                const display = mode === 'success' ? pct(t.passRate) : pct(t.avgScore)
                const color: 'success' | 'warning' | 'error' =
                  value >= 0.8 ? 'success' : value >= 0.5 ? 'warning' : 'error'
                return (
                  <TableRow key={t.taskId}>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.taskName}
                      </Typography>
                    </TableCell>
                    {mode === 'success' && (
                      <TableCell align="right">
                        <Typography variant="caption" color="text.secondary">
                          {t.passCount}/{t.totalTrials}
                        </Typography>
                      </TableCell>
                    )}
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={700}
                        color={value >= 0.8 ? 'success.main' : value >= 0.5 ? 'warning.main' : 'error.main'}>
                        {display}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 100 }}>
                      <LinearProgress
                        variant="determinate"
                        value={value * 100}
                        color={color}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
    </Dialog>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: ReactNode
  label: string
  value: string
  color?: 'success' | 'error' | 'warning' | 'primary' | 'default'
  tooltip?: string
  onClick?: () => void
  /** Show a small "click to see breakdown" hint */
  clickable?: boolean
}

function StatCard({ icon, label, value, color = 'default', tooltip, onClick, clickable }: StatCardProps) {
  const colorMap = {
    success: '#2e7d32',
    error: '#c62828',
    warning: '#e65100',
    primary: '#1565c0',
    default: 'text.primary',
  }
  const content = (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
        minWidth: 120, textAlign: 'center',
        ...(clickable && {
          cursor: 'pointer',
          '&:hover': { boxShadow: 2, borderColor: 'primary.main' },
          transition: 'box-shadow 0.15s, border-color 0.15s',
        }),
      }}
    >
      <Box sx={{ color: colorMap[color], opacity: 0.8 }}>{icon}</Box>
      <Typography variant="h6" fontWeight={700} sx={{ color: colorMap[color] }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      {clickable && (
        <Typography variant="caption" color="primary.main" sx={{ fontSize: '0.6rem', opacity: 0.8 }}>
          click for breakdown
        </Typography>
      )}
    </Paper>
  )
  return tooltip ? <Tooltip title={tooltip}>{content}</Tooltip> : content
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      variant="overline"
      sx={{ fontSize: '0.68rem', letterSpacing: 1.4, color: 'text.disabled', lineHeight: 1 }}
    >
      {children}
    </Typography>
  )
}

// ─── MetricsPanel — at-a-glance KPI overview ──────────────────────────────────

interface MetricsPanelProps {
  results: EvaluationResults
}

export default function MetricsPanel({ results }: MetricsPanelProps) {
  const m = results.metrics
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [breakdownMode, setBreakdownMode] = useState<BreakdownMode>('success')

  const taskBreakdown = computeTaskBreakdown(results.task_results ?? [])
  const hasBreakdown = taskBreakdown.length > 0

  function openBreakdown(mode: BreakdownMode) {
    setBreakdownMode(mode)
    setBreakdownOpen(true)
  }

  if (!m) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography color="text.secondary" variant="body2">
          Metrics not yet available — evaluation may still be running.
        </Typography>
        {(results.status === '0' || results.status === '1') && (
          <LinearProgress sx={{ mt: 2 }} />
        )}
      </Box>
    )
  }

  const passed = m.passed ?? 0
  const total = m.total_results ?? 0
  const failed = total - passed
  const successColor: 'success' | 'warning' | 'error' =
    m.success_rate >= 0.8 ? 'success' : m.success_rate >= 0.5 ? 'warning' : 'error'

  const consistencyLabel = m.score_std == null ? '—'
    : m.score_std <= 0.05 ? `${pct(m.score_std)} (high)`
    : m.score_std <= 0.15 ? `${pct(m.score_std)} (med)`
    : `${pct(m.score_std)} (low)`
  const consistencyColor: 'success' | 'warning' | 'error' =
    (m.score_std ?? 1) <= 0.05 ? 'success' : (m.score_std ?? 1) <= 0.15 ? 'warning' : 'error'

  const hasTaskReliability = m.total_tasks != null && m.total_tasks > 0 && m.total_tasks < m.total_results
  const hasReliability = m.flakiness != null || m.score_std != null || hasTaskReliability

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

        {/* ── Accuracy ──────────────────────────────────────────────────── */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <SectionLabel>Accuracy</SectionLabel>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'stretch' }}>
            <StatCard
              icon={<TrendingUp size={22} />}
              label="Success Rate"
              value={pct(m.success_rate)}
              color={successColor}
              tooltip={HELP_TEXT.METRIC_SUCCESS_RATE + (hasBreakdown ? '\n\nClick to see breakdown by task.' : '')}
              clickable={hasBreakdown}
              onClick={hasBreakdown ? () => openBreakdown('success') : undefined}
            />
            <StatCard
              icon={<CheckCircle size={22} />}
              label="Passed / Total"
              value={`${passed} / ${total}`}
              color="success"
              tooltip="Trials that passed all grader checks vs. total trials run"
            />
            <StatCard
              icon={<XCircle size={22} />}
              label="Failed"
              value={String(failed)}
              color={failed > 0 ? 'error' : 'default'}
              tooltip="Number of trials that did not meet the passing threshold for all graders"
            />
            {m.avg_score != null && (
              <>
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                <StatCard
                  icon={<Star size={22} />}
                  label="Avg Score"
                  value={pct(m.avg_score)}
                  color={(m.avg_score ?? 0) >= 0.8 ? 'success' : (m.avg_score ?? 0) >= 0.5 ? 'warning' : 'error'}
                  tooltip={HELP_TEXT.METRIC_AVG_SCORE + (hasBreakdown ? '\n\nClick to see breakdown by task.' : '')}
                  clickable={hasBreakdown}
                  onClick={hasBreakdown ? () => openBreakdown('score') : undefined}
                />
              </>
            )}
          </Box>
        </Box>

        {/* ── Reliability ───────────────────────────────────────────────── */}
        {hasReliability && (
          <>
            <Divider />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <SectionLabel>Reliability</SectionLabel>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'stretch' }}>
                {m.flakiness != null && (
                  <StatCard
                    icon={<Shuffle size={22} />}
                    label="Flakiness"
                    value={m.flakiness.toFixed(3)}
                    color={m.flakiness <= 0.05 ? 'success' : m.flakiness <= 0.2 ? 'warning' : 'error'}
                    tooltip={HELP_TEXT.METRIC_FLAKINESS}
                  />
                )}
                {m.score_std != null && (
                  <StatCard
                    icon={<Activity size={22} />}
                    label="Consistency"
                    value={consistencyLabel}
                    color={consistencyColor}
                    tooltip="Score standard deviation across trials. Lower = more consistent quality. High std means output varies a lot run-to-run."
                  />
                )}
                {hasTaskReliability && (m.tasks_fully_passed_rate != null || (m.tasks_never_passed_rate ?? 0) > 0) && (
                  <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                )}
                {hasTaskReliability && m.tasks_fully_passed_rate != null && (
                  <StatCard
                    icon={<ShieldCheck size={22} />}
                    label="Always Pass"
                    value={pct(m.tasks_fully_passed_rate)}
                    color={m.tasks_fully_passed_rate >= 0.8 ? 'success' : m.tasks_fully_passed_rate >= 0.4 ? 'warning' : 'error'}
                    tooltip={HELP_TEXT.METRIC_PASS_ALL_K + '\n\nHere: % of tasks where every single trial passed.'}
                  />
                )}
                {hasTaskReliability && (m.tasks_never_passed_rate ?? 0) > 0 && (
                  <StatCard
                    icon={<ShieldX size={22} />}
                    label="Never Pass"
                    value={pct(m.tasks_never_passed_rate)}
                    color="error"
                    tooltip="Fraction of tasks where no trial ever passed — these tasks consistently fail and need attention."
                  />
                )}
              </Box>
            </Box>
          </>
        )}

      </Box>

      {/* Task breakdown dialog */}
      {hasBreakdown && (
        <TaskBreakdownDialog
          open={breakdownOpen}
          onClose={() => setBreakdownOpen(false)}
          mode={breakdownMode}
          tasks={taskBreakdown}
        />
      )}
    </>
  )
}
