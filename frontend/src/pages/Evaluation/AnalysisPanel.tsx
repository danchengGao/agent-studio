import React, { useState } from 'react'
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  AlertTriangle, CheckCircle, Clock, Cpu,
  Gauge, Layers, Timer,
} from 'lucide-react'
import { EvaluationResults } from '@/stores/useEvaluationStore'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(n: number | undefined | null): string {
  if (n == null) return '—'
  return `${(n * 100).toFixed(1)}%`
}

function ms(n: number | undefined | null): string {
  if (n == null || n === 0) return '—'
  if (n >= 1000) return `${(n / 1000).toFixed(2)}s`
  return `${Math.round(n)}ms`
}

function formatTokens(n: number | undefined): string {
  if (n == null) return '—'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${n}`
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  color?: 'success' | 'error' | 'warning' | 'primary' | 'default'
  tooltip?: string
  onDetails?: () => void
}

function StatCard({ icon, label, value, color = 'default', tooltip, onDetails }: StatCardProps) {
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
      sx={{
        p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
        minWidth: 120, textAlign: 'center',
      }}
    >
      <Box sx={{ color: colorMap[color], opacity: 0.8 }}>{icon}</Box>
      <Typography variant="h6" fontWeight={700} sx={{ color: colorMap[color] }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
        {onDetails && (
          <Box
            component="span"
            onClick={onDetails}
            sx={{ ml: 0.5, color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
          >
            · details
          </Box>
        )}
      </Typography>
    </Paper>
  )
  return tooltip ? <Tooltip title={tooltip}>{content}</Tooltip> : content
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="overline"
      sx={{ fontSize: '0.68rem', letterSpacing: 1.4, color: 'text.disabled', lineHeight: 1 }}
    >
      {children}
    </Typography>
  )
}

// ─── LatencyTable ─────────────────────────────────────────────────────────────

interface LatencyTableProps {
  avg?: number; median?: number; p75?: number; p95?: number
  min?: number; max?: number; total?: number
}

function LatencyTable({ avg, median, p75, p95, min, max, total }: LatencyTableProps) {
  const rows = [
    { label: 'Avg',         value: avg,    tooltip: 'Mean latency across all trials' },
    { label: 'Median (p50)', value: median, tooltip: '50th percentile — typical latency' },
    { label: 'p75',         value: p75,    tooltip: '75th percentile — latency for most trials' },
    { label: 'p95',         value: p95,    tooltip: '95th percentile — worst-case for most trials' },
    { label: 'Min',         value: min,    tooltip: 'Fastest trial' },
    { label: 'Max',         value: max,    tooltip: 'Slowest trial' },
    { label: 'Total',       value: total,  tooltip: 'Sum of all trial latencies' },
  ].filter(r => r.value != null && r.value > 0)

  if (rows.length === 0) return null
  const maxVal = max ?? 1

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>Latency breakdown</Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableBody>
            {rows.map(({ label, value, tooltip }) => (
              <TableRow key={label}>
                <TableCell sx={{ width: 120 }}>
                  <Tooltip title={tooltip}>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                  </Tooltip>
                </TableCell>
                <TableCell align="right" sx={{ width: 80 }}>
                  <Typography variant="body2" fontWeight={500}>{ms(value)}</Typography>
                </TableCell>
                <TableCell sx={{ minWidth: 140 }}>
                  {label !== 'Total' && (
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(((value ?? 0) / maxVal) * 100, 100)}
                      sx={{ height: 5, borderRadius: 3 }}
                      color={label === 'p95' || label === 'Max' ? 'error' : label === 'p75' ? 'warning' : 'primary'}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

// ─── ScoreDistributionChart ───────────────────────────────────────────────────

function ScoreDistributionChart({ distribution }: { distribution: Record<string, number> }) {
  const buckets = [
    { key: '0_20',   label: '0–20%',   color: 'error'   as const },
    { key: '20_40',  label: '20–40%',  color: 'warning' as const },
    { key: '40_60',  label: '40–60%',  color: 'warning' as const },
    { key: '60_80',  label: '60–80%',  color: 'primary' as const },
    { key: '80_100', label: '80–100%', color: 'success' as const },
  ]
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {buckets.map(({ key, label, color }) => {
        const val = distribution[key] ?? 0
        return (
          <Box key={key} sx={{ display: 'grid', gridTemplateColumns: '70px 1fr 44px', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <LinearProgress variant="determinate" value={val * 100} color={color}
              sx={{ height: 10, borderRadius: 2 }} />
            <Typography variant="caption" align="right">{pct(val)}</Typography>
          </Box>
        )
      })}
    </Box>
  )
}

// ─── SamplingCard — one card per k showing both pass@k and pass^k ────────────

interface SamplingCardProps {
  k: number
  atK: number | undefined
  powK: number | undefined
  applicable: boolean
  trialsPerTask: number
}

function SamplingCard({ k, atK, powK, applicable, trialsPerTask }: SamplingCardProps) {
  const valColor = (v: number | undefined) =>
    !applicable ? '#bdbdbd'
    : (v ?? 0) >= 0.8 ? '#2e7d32' : (v ?? 0) >= 0.5 ? '#e65100' : '#c62828'

  const card = (
    <Paper
      variant="outlined"
      sx={{ p: 1.5, minWidth: 130, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, textAlign: 'center' }}
    >
      <Box sx={{ color: applicable ? 'text.secondary' : '#bdbdbd', opacity: 0.8 }}>
        <Layers size={18} />
      </Box>
      <Typography
        variant="overline"
        sx={{ fontSize: '0.65rem', letterSpacing: 1.2, color: 'text.disabled', lineHeight: 1 }}
      >
        k = {k}
      </Typography>
      {!applicable ? (
        <Typography variant="caption" color="text.disabled" fontStyle="italic" sx={{ mt: 0.25 }}>
          N/A
        </Typography>
      ) : (
        <Box sx={{ mt: 0.5, width: '100%', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>pass@</Typography>
            <Typography variant="body2" fontWeight={700} sx={{ color: valColor(atK), fontVariantNumeric: 'tabular-nums' }}>
              {pct(atK)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>pass^</Typography>
            <Typography variant="body2" fontWeight={700} sx={{ color: valColor(powK), fontVariantNumeric: 'tabular-nums' }}>
              {pct(powK)}
            </Typography>
          </Box>
        </Box>
      )}
    </Paper>
  )

  const tip = !applicable
    ? `Requires ≥${k} trials per task — only ${trialsPerTask} trial${trialsPerTask === 1 ? '' : 's'} were run`
    : `pass@${k}: probability that at least 1 of ${k} trials passes\npass^${k}: probability that every one of ${k} trials passes`

  return <Tooltip title={tip}>{card}</Tooltip>
}

// ─── AnalysisPanel (main export) ──────────────────────────────────────────────

interface AnalysisPanelProps {
  results: EvaluationResults
}

export default function AnalysisPanel({ results }: AnalysisPanelProps) {
  const [latencyOpen, setLatencyOpen] = useState(false)
  const [scoreDistOpen, setScoreDistOpen] = useState(false)
  const [samplingOpen, setSamplingOpen] = useState(false)

  const m = results.metrics

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

  const hasScores = m.avg_score != null && (m.score_max ?? 0) > 0
  const latencyCvLabel = (!m.latency_cv || m.latency_cv === 0) ? '—'
    : m.latency_cv <= 0.2 ? `${pct(m.latency_cv)} (low)`
    : m.latency_cv <= 0.5 ? `${pct(m.latency_cv)} (med)`
    : `${pct(m.latency_cv)} (high)`
  const latencyCvColor: 'success' | 'warning' | 'error' | 'default' =
    (!m.latency_cv || m.latency_cv === 0) ? 'default'
    : m.latency_cv <= 0.2 ? 'success' : m.latency_cv <= 0.5 ? 'warning' : 'error'
  const tokenEffTip = (() => {
    const ep = m.tokens_efficiency?.passed
    const ef = m.tokens_efficiency?.failed
    return [
      ep ? `Avg/passed: ${formatTokens(ep.total_tokens)}` : '',
      ef ? `Avg/failed: ${formatTokens(ef.total_tokens)}` : '',
    ].filter(Boolean).join(' · ')
  })()

  const passAtK = m.pass_at_k
  const passPowK = m.pass_pow_k
  const hasPassAtK = !!(passAtK && Object.keys(passAtK).length)

  const ks = hasPassAtK
    ? Array.from(
        new Set([...Object.keys(passAtK!), ...Object.keys(passPowK ?? {})].map(Number).sort((a, b) => a - b))
      )
    : []

  const showAccuracy = (m.error_rate ?? 0) > 0 || (hasScores && (m.median_score != null || m.perfect_score_rate != null))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* ── Accuracy (quality detail) ────────────────────────────────────── */}
      {/* Pass/fail KPIs are in Overview; task-level breakdown is in the Tasks tab */}
      {showAccuracy && (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <SectionLabel>Accuracy</SectionLabel>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {(m.error_rate ?? 0) > 0 && (
            <StatCard
              icon={<AlertTriangle size={22} />}
              label="Error Rate"
              value={pct(m.error_rate)}
              color="error"
              tooltip="Fraction of trials that raised an execution error"
            />
          )}
          {hasScores && m.median_score != null && (
            <StatCard
              icon={<Gauge size={22} />}
              label="Median Score"
              value={pct(m.median_score)}
              color={(m.median_score ?? 0) >= 0.8 ? 'success' : (m.median_score ?? 0) >= 0.5 ? 'warning' : 'error'}
              tooltip="Median (p50) grader score — less affected by outliers than the mean"
              onDetails={m.score_distribution && Object.keys(m.score_distribution).length > 0 ? () => setScoreDistOpen(true) : undefined}
            />
          )}
          {hasScores && m.perfect_score_rate != null && (
            <StatCard
              icon={<CheckCircle size={22} />}
              label="Perfect (1.0)"
              value={pct(m.perfect_score_rate)}
              color={m.perfect_score_rate >= 0.5 ? 'success' : m.perfect_score_rate >= 0.2 ? 'warning' : 'error'}
              tooltip="Fraction of trials that achieved a perfect score of 1.0"
            />
          )}
        </Box>
      </Box>
      )}

      {/* ── Performance ─────────────────────────────────────────────────── */}
      {showAccuracy && <Divider />}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <SectionLabel>Performance</SectionLabel>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <StatCard
            icon={<Clock size={22} />}
            label="Avg Latency"
            value={ms(m.avg_latency_ms)}
            tooltip={`Total: ${ms(m.total_latency_ms)}`}
            onDetails={(m.median_latency_ms != null || m.p95_latency_ms != null) ? () => setLatencyOpen(true) : undefined}
          />
          {m.latency_cv != null && m.latency_cv > 0 && (
            <StatCard
              icon={<Timer size={22} />}
              label="Latency CV"
              value={latencyCvLabel}
              color={latencyCvColor}
              tooltip={`Coefficient of variation for latency (std ÷ mean). Low = predictable execution time. Std: ${ms(m.latency_std_ms)}`}
            />
          )}
          {m.token_usage && (
            <StatCard
              icon={<Cpu size={22} />}
              label="Total Tokens"
              value={formatTokens(m.token_usage.total_tokens)}
              tooltip={`Prompt: ${formatTokens(m.token_usage.prompt_tokens)} · Completion: ${formatTokens(m.token_usage.completion_tokens)}${m.tokens_per_trial ? ` · Avg/trial: ${formatTokens(m.tokens_per_trial.total_tokens)}` : ''}${tokenEffTip ? ` · ${tokenEffTip}` : ''}`}
            />
          )}
        </Box>
      </Box>

      {/* ── Sampling (pass@k / pass^k) ───────────────────────────────────── */}
      {hasPassAtK && (() => {
        const trialsPerTask = (m.total_tasks && m.total_tasks > 0)
          ? Math.round((m.total_results ?? 1) / m.total_tasks)
          : (m.total_results ?? 1)
        return (
          <>
            <Divider />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SectionLabel>Sampling</SectionLabel>
                <Typography
                  variant="caption"
                  onClick={() => setSamplingOpen(true)}
                  sx={{ color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' }, lineHeight: 1 }}
                >
                  · details
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {ks.map(k => (
                  <SamplingCard
                    key={k}
                    k={k}
                    atK={passAtK![String(k)]}
                    powK={passPowK?.[String(k)]}
                    applicable={trialsPerTask >= k}
                    trialsPerTask={trialsPerTask}
                  />
                ))}
              </Box>
            </Box>
          </>
        )
      })()}

      {/* Latency breakdown dialog */}
      <Dialog open={latencyOpen} onClose={() => setLatencyOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Latency Breakdown</DialogTitle>
        <DialogContent>
          <LatencyTable
            avg={m.avg_latency_ms}
            median={m.median_latency_ms}
            p75={m.p75_latency_ms}
            p95={m.p95_latency_ms}
            min={m.min_latency_ms}
            max={m.max_latency_ms}
            total={m.total_latency_ms}
          />
        </DialogContent>
      </Dialog>

      {/* Score distribution dialog */}
      <Dialog open={scoreDistOpen} onClose={() => setScoreDistOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Score Distribution</DialogTitle>
        <DialogContent>
          {m.score_distribution && <ScoreDistributionChart distribution={m.score_distribution} />}
        </DialogContent>
      </Dialog>

      {/* Sampling detail dialog */}
      {hasPassAtK && (() => {
        const trialsPerTask = (m.total_tasks && m.total_tasks > 0)
          ? Math.round((m.total_results ?? 1) / m.total_tasks)
          : (m.total_results ?? 1)
        return (
          <Dialog open={samplingOpen} onClose={() => setSamplingOpen(false)} maxWidth="xs" fullWidth>
            <DialogTitle>Sampling Details — pass@k / pass^k</DialogTitle>
            <DialogContent>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>k</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Probability that at least 1 of k trials passes"><span>pass@k</span></Tooltip>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Probability that all k trials pass"><span>pass^k</span></Tooltip>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ks.map(k => {
                      const applicable = trialsPerTask >= k
                      return (
                        <TableRow key={k} sx={!applicable ? { opacity: 0.45 } : undefined}>
                          <TableCell>
                            <Typography variant="caption" fontFamily="monospace">k={k}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            {applicable
                              ? <Typography variant="body2" fontWeight={600}>{pct(passAtK![String(k)])}</Typography>
                              : <Tooltip title={`Requires ≥${k} trials per task (${trialsPerTask} run)`}>
                                  <Typography variant="body2" color="text.disabled" fontStyle="italic">N/A</Typography>
                                </Tooltip>
                            }
                          </TableCell>
                          <TableCell align="right">
                            {applicable
                              ? <Typography variant="body2">{pct(passPowK?.[String(k)])}</Typography>
                              : <Typography variant="body2" color="text.disabled" fontStyle="italic">N/A</Typography>
                            }
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                <strong>pass@k</strong> — at least 1 of k trials passes.<br />
                <strong>pass^k</strong> — every one of k trials passes.<br />
                Trials per task: <strong>{trialsPerTask}</strong>
              </Typography>
            </DialogContent>
          </Dialog>
        )
      })()}

    </Box>
  )
}
