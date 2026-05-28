import { useMemo, useState } from 'react'
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Paper,
  Alert,
} from '@mui/material'
import { ArrowDown, ArrowUp, Minus, GitCompare, X } from 'lucide-react'
import { EvaluationRun } from '@/stores/useEvaluationStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RunComparisonModalProps {
  open: boolean
  onClose: () => void
  /** All runs for the current suite (already fetched) */
  runs: EvaluationRun[]
  /** Optional: pre-select Run A */
  defaultRunIdA?: string
  /** Optional: pre-select Run B */
  defaultRunIdB?: string
}

// ── Metric row definitions ─────────────────────────────────────────────────

interface MetricDef {
  key: string
  label: string
  format: (v: number) => string
  /** true → higher is better, false → lower is better */
  higherBetter: boolean
  /** Minimum delta to show an arrow (avoids noise for tiny changes) */
  threshold?: number
}

const METRIC_DEFS: MetricDef[] = [
  {
    key: 'success_rate',
    label: 'Pass Rate',
    format: (v) => `${(v * 100).toFixed(1)}%`,
    higherBetter: true,
    threshold: 0.005,
  },
  {
    key: 'avg_score',
    label: 'Avg Score',
    format: (v) => `${(v * 100).toFixed(1)}%`,
    higherBetter: true,
    threshold: 0.005,
  },
  {
    key: 'median_score',
    label: 'Median Score',
    format: (v) => `${(v * 100).toFixed(1)}%`,
    higherBetter: true,
    threshold: 0.005,
  },
  {
    key: 'score_std',
    label: 'Score Std Dev',
    format: (v) => (v * 100).toFixed(2) + '%',
    higherBetter: false,
    threshold: 0.002,
  },
  {
    key: 'avg_latency_ms',
    label: 'Avg Latency',
    format: (v) => v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${v.toFixed(0)}ms`,
    higherBetter: false,
    threshold: 50,
  },
  {
    key: 'median_latency_ms',
    label: 'Median Latency',
    format: (v) => v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${v.toFixed(0)}ms`,
    higherBetter: false,
    threshold: 50,
  },
  {
    key: 'p95_latency_ms',
    label: 'P95 Latency',
    format: (v) => v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${v.toFixed(0)}ms`,
    higherBetter: false,
    threshold: 100,
  },
  {
    key: 'flakiness',
    label: 'Flakiness',
    format: (v) => `${(v * 100).toFixed(1)}%`,
    higherBetter: false,
    threshold: 0.02,
  },
  {
    key: 'passed',
    label: 'Tasks Passed',
    format: (v) => String(Math.round(v)),
    higherBetter: true,
    threshold: 0.5,
  },
  {
    key: 'total_results',
    label: 'Total Trials',
    format: (v) => String(Math.round(v)),
    higherBetter: true,
    threshold: 0,
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function runLabel(run: EvaluationRun): string {
  const target = run.workflow_name ?? run.agent_name ?? null
  const date = fmt(run.create_time)
  return target ? `${target} — ${date}` : `Run ${run.run_id.slice(0, 8)}… — ${date}`
}

const STATUS_COLOR: Record<string, 'default' | 'warning' | 'success' | 'error'> = {
  '0': 'default', '1': 'warning', '2': 'success', '3': 'error',
}
const STATUS_LABEL: Record<string, string> = {
  '0': 'Pending', '1': 'Running', '2': 'Completed', '3': 'Failed',
}

function completedRuns(runs: EvaluationRun[]): EvaluationRun[] {
  return runs.filter((r) => r.status === '2' && r.metrics != null)
}

// ── Delta cell ────────────────────────────────────────────────────────────────

function DeltaCell({ valA, valB, def }: { valA: number; valB: number; def: MetricDef }) {
  const delta = valB - valA
  const abs = Math.abs(delta)
  if (abs < (def.threshold ?? 0)) {
    return (
      <TableCell align="center">
        <Minus size={14} style={{ color: '#9e9e9e' }} />
      </TableCell>
    )
  }

  const improved = def.higherBetter ? delta > 0 : delta < 0
  const pct = valA !== 0 ? (abs / Math.abs(valA)) * 100 : 0

  return (
    <TableCell align="center">
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
        {improved
          ? <ArrowUp size={14} style={{ color: '#2e7d32' }} />
          : <ArrowDown size={14} style={{ color: '#c62828' }} />}
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{ color: improved ? 'success.main' : 'error.main' }}
        >
          {delta > 0 ? '+' : ''}{def.format(delta)}
          {pct > 0.1 && (
            <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 0.25 }}>
              ({pct.toFixed(1)}%)
            </Typography>
          )}
        </Typography>
      </Box>
    </TableCell>
  )
}

// ── Grader comparison section ─────────────────────────────────────────────────

function GraderComparisonSection({
  metricsA,
  metricsB,
}: {
  metricsA: Record<string, unknown>
  metricsB: Record<string, unknown>
}) {
  const breakdownA = (metricsA.per_grader_breakdown ?? {}) as Record<string, { pass_rate: number; avg_score: number; count: number }>
  const breakdownB = (metricsB.per_grader_breakdown ?? {}) as Record<string, { pass_rate: number; avg_score: number; count: number }>

  const allGraders = Array.from(new Set([...Object.keys(breakdownA), ...Object.keys(breakdownB)]))
  if (allGraders.length === 0) return null

  return (
    <Box>
      <Typography variant="overline" sx={{ fontSize: '0.65rem', letterSpacing: 1.2, color: 'text.disabled' }}>
        Per-Grader Pass Rate
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Grader</TableCell>
              <TableCell align="right">Run A</TableCell>
              <TableCell align="right">Run B</TableCell>
              <TableCell align="center">Delta</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {allGraders.map((name) => {
              const a = breakdownA[name]?.pass_rate
              const b = breakdownB[name]?.pass_rate
              return (
                <TableRow key={name}>
                  <TableCell>
                    <Typography variant="caption" fontFamily="monospace">{name}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" color={a == null ? 'text.disabled' : a >= 0.8 ? 'success.main' : a >= 0.5 ? 'warning.main' : 'error.main'}>
                      {a != null ? `${(a * 100).toFixed(1)}%` : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" color={b == null ? 'text.disabled' : b >= 0.8 ? 'success.main' : b >= 0.5 ? 'warning.main' : 'error.main'}>
                      {b != null ? `${(b * 100).toFixed(1)}%` : '—'}
                    </Typography>
                  </TableCell>
                  {a != null && b != null ? (
                    <DeltaCell
                      valA={a}
                      valB={b}
                      def={{ key: name, label: name, format: (v) => `${(v * 100).toFixed(1)}pp`, higherBetter: true, threshold: 0.005 }}
                    />
                  ) : (
                    <TableCell align="center">
                      <Typography variant="caption" color="text.disabled">—</Typography>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function RunComparisonModal({
  open,
  onClose,
  runs,
  defaultRunIdA,
  defaultRunIdB,
}: RunComparisonModalProps) {
  const eligible = useMemo(() => completedRuns(runs), [runs])

  const [runIdA, setRunIdA] = useState<string>(defaultRunIdA ?? eligible[0]?.run_id ?? '')
  const [runIdB, setRunIdB] = useState<string>(defaultRunIdB ?? eligible[1]?.run_id ?? '')

  const runA = eligible.find((r) => r.run_id === runIdA) ?? null
  const runB = eligible.find((r) => r.run_id === runIdB) ?? null

  const metricsA = runA?.metrics as Record<string, unknown> | undefined
  const metricsB = runB?.metrics as Record<string, unknown> | undefined

  // Rows where both runs have data
  const rows = useMemo(() => {
    if (!metricsA || !metricsB) return []
    return METRIC_DEFS.filter((def) => {
      const a = metricsA[def.key]
      const b = metricsB[def.key]
      return typeof a === 'number' || typeof b === 'number'
    })
  }, [metricsA, metricsB])

  const isSameRun = runIdA === runIdB && runIdA !== ''

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
        <GitCompare size={20} style={{ color: '#1565c0' }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" fontWeight={700}>Compare Runs</Typography>
          <Typography variant="caption" color="text.secondary">
            Side-by-side metric comparison for two completed runs
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><X size={18} /></IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 2 }}>
        {eligible.length < 2 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            You need at least two completed runs with metrics to compare. Run the suite a second time to unlock this feature.
          </Alert>
        )}

        {/* Run selectors */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Run A (baseline)</InputLabel>
            <Select
              value={runIdA}
              label="Run A (baseline)"
              onChange={(e) => setRunIdA(e.target.value)}
            >
              {eligible.map((r) => (
                <MenuItem key={r.run_id} value={r.run_id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={STATUS_LABEL[r.status] ?? r.status}
                      color={STATUS_COLOR[r.status]}
                      size="small"
                    />
                    <Typography variant="body2">{runLabel(r)}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel>Run B (compare)</InputLabel>
            <Select
              value={runIdB}
              label="Run B (compare)"
              onChange={(e) => setRunIdB(e.target.value)}
            >
              {eligible.map((r) => (
                <MenuItem key={r.run_id} value={r.run_id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={STATUS_LABEL[r.status] ?? r.status}
                      color={STATUS_COLOR[r.status]}
                      size="small"
                    />
                    <Typography variant="body2">{runLabel(r)}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {isSameRun && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Both selectors point to the same run. Select different runs to see a meaningful comparison.
          </Alert>
        )}

        {/* Comparison table */}
        {metricsA && metricsB && !isSameRun && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell><Typography variant="caption" fontWeight={700}>Metric</Typography></TableCell>
                    <TableCell align="right">
                      <Typography variant="caption" fontWeight={700} color="primary.main">Run A</Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ fontFamily: 'monospace', fontSize: '0.6rem' }}>
                        {runA?.run_id.slice(0, 8)}…
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="caption" fontWeight={700} color="secondary.main">Run B</Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ fontFamily: 'monospace', fontSize: '0.6rem' }}>
                        {runB?.run_id.slice(0, 8)}…
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="caption" fontWeight={700}>Delta (B − A)</Typography>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((def) => {
                    const a = metricsA[def.key]
                    const b = metricsB[def.key]
                    const numA = typeof a === 'number' ? a : null
                    const numB = typeof b === 'number' ? b : null
                    return (
                      <TableRow key={def.key} hover>
                        <TableCell>
                          <Typography variant="body2">{def.label}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {numA != null ? def.format(numA) : <span style={{ color: '#9e9e9e' }}>—</span>}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {numB != null ? def.format(numB) : <span style={{ color: '#9e9e9e' }}>—</span>}
                          </Typography>
                        </TableCell>
                        {numA != null && numB != null ? (
                          <DeltaCell valA={numA} valB={numB} def={def} />
                        ) : (
                          <TableCell align="center">
                            <Typography variant="caption" color="text.disabled">—</Typography>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            <Divider />

            {/* Grader breakdown comparison */}
            <GraderComparisonSection metricsA={metricsA} metricsB={metricsB} />

            {/* Legend */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', pt: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ArrowUp size={14} style={{ color: '#2e7d32' }} />
                <Typography variant="caption" color="text.secondary">Improvement</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ArrowDown size={14} style={{ color: '#c62828' }} />
                <Typography variant="caption" color="text.secondary">Regression</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Minus size={14} style={{ color: '#9e9e9e' }} />
                <Typography variant="caption" color="text.secondary">No significant change</Typography>
              </Box>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  )
}
