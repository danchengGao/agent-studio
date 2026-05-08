import React from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { ChevronDown, CheckCircle, XCircle, AlertCircle, Cpu, Zap, List, AlertTriangle } from 'lucide-react'
import { TaskResult } from '@/stores/useEvaluationStore'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object') return JSON.stringify(v, null, 2)
  return String(v)
}

// ─── GraderDetailRow ──────────────────────────────────────────────────────────

interface GraderDetailRowProps {
  g: Record<string, unknown>
  idx: number
}

function GraderDetailRow({ g, idx }: GraderDetailRowProps) {
  const passed = Boolean(g.passed)
  const score = g.score != null ? Number(g.score) : null
  const name = (g.grader_name as string) ?? `grader_${idx}`
  const gType = (g.grader_type as string) ?? ''
  const checkType = (g.check_type as string) ?? ''
  const details = (g.details as Record<string, unknown>) ?? {}
  const errorMsg = (g.error as string) ?? null

  return (
    <TableRow
      sx={{
        bgcolor: passed ? 'rgba(46,125,50,0.04)' : 'rgba(198,40,40,0.04)',
        '& td': { verticalAlign: 'top', py: 0.75 },
      }}
    >
      {/* Pass/fail icon */}
      <TableCell sx={{ width: 28, px: 1 }}>
        {passed
          ? <CheckCircle size={14} color="green" />
          : <XCircle size={14} color="red" />
        }
      </TableCell>

      {/* Grader name + type */}
      <TableCell sx={{ minWidth: 160 }}>
        <Typography variant="caption" fontWeight={600} display="block">{name}</Typography>
        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.25, flexWrap: 'wrap' }}>
          {gType && <Chip label={gType} size="small" sx={{ height: 14, fontSize: '0.6rem' }} />}
          {checkType && <Chip label={checkType} size="small" variant="outlined" sx={{ height: 14, fontSize: '0.6rem' }} />}
        </Box>
      </TableCell>

      {/* Score */}
      <TableCell sx={{ width: 60 }}>
        {score != null && (
          <Typography variant="caption" color={passed ? 'success.main' : 'error.main'} fontWeight={600}>
            {(score * 100).toFixed(0)}%
          </Typography>
        )}
      </TableCell>

      {/* Details: expected vs actual */}
      <TableCell>
        {errorMsg ? (
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
            <AlertTriangle size={12} color="orange" style={{ marginTop: 2, flexShrink: 0 }} />
            <Typography
              variant="caption"
              color="warning.main"
              component="pre"
              sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', m: 0, fontFamily: 'monospace', fontSize: '0.65rem' }}
            >
              {errorMsg}
            </Typography>
          </Box>
        ) : Object.keys(details).length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {'expected' in details && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 54, flexShrink: 0, pt: 0.1 }}>
                  Expected:
                </Typography>
                <Typography
                  variant="caption"
                  component="pre"
                  sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', m: 0, fontFamily: 'monospace', fontSize: '0.65rem', color: 'text.primary' }}
                >
                  {formatValue(details.expected)}
                </Typography>
              </Box>
            )}
            {'actual' in details && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 54, flexShrink: 0, pt: 0.1 }}>
                  Actual:
                </Typography>
                <Typography
                  variant="caption"
                  component="pre"
                  sx={{
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word', m: 0,
                    fontFamily: 'monospace', fontSize: '0.65rem',
                    color: passed ? 'success.dark' : 'error.dark',
                  }}
                >
                  {formatValue(details.actual)}
                </Typography>
              </Box>
            )}
            {'condition' in details && (
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem' }}>
                Condition: {formatValue(details.condition)}
              </Typography>
            )}
            {/* Show other detail keys (tool checks, pattern checks, missing tools, etc.) */}
            {Object.entries(details)
              .filter(([k]) => !['expected', 'actual', 'condition'].includes(k))
              .map(([k, v]) => (
                <Box key={k} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 54, flexShrink: 0, pt: 0.1 }}>
                    {k}:
                  </Typography>
                  <Typography
                    variant="caption"
                    component="pre"
                    sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', m: 0, fontFamily: 'monospace', fontSize: '0.65rem' }}
                  >
                    {formatValue(v)}
                  </Typography>
                </Box>
              ))
            }
          </Box>
        ) : (
          <Typography variant="caption" color="text.disabled">—</Typography>
        )}
      </TableCell>
    </TableRow>
  )
}

// ─── TrialPanel ───────────────────────────────────────────────────────────────

interface TrialPanelProps {
  result: TaskResult
  defaultExpanded?: boolean
}

function TrialPanel({ result, defaultExpanded = false }: TrialPanelProps) {
  const passed = result.passed === true || result.passed === 1 as unknown
  const failed = result.passed === false || result.passed === 0 as unknown
  const graderResults = result.grader_results ?? []

  // Show actual output from the best available grader:
  // prefer output_check (full output) over state_check (single field)
  const firstOutputGrader = (
    graderResults.find((g) => (g as any).check_type === 'output_check') ??
    graderResults.find((g) => (g as any).details?.actual !== undefined)
  ) as Record<string, unknown> | undefined
  const actualOutput = (firstOutputGrader?.details as Record<string, unknown>)?.actual

  return (
    <Accordion defaultExpanded={defaultExpanded} variant="outlined" sx={{ mb: 0.5 }}>
      <AccordionSummary expandIcon={<ChevronDown size={16} />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', flexWrap: 'wrap' }}>
          {result.passed == null
            ? <AlertCircle size={16} color="gray" />
            : passed
              ? <CheckCircle size={16} color="green" />
              : <XCircle size={16} color="red" />
          }
          <Typography variant="body2" fontWeight={500}>
            Trial #{result.trial_number}
          </Typography>
          <Chip
            label={passed ? 'PASS' : failed ? 'FAIL' : 'PENDING'}
            size="small"
            color={passed ? 'success' : failed ? 'error' : 'default'}
          />
          {graderResults.length > 0 && (
            <Chip
              label={`${graderResults.filter((g) => Boolean(g.passed)).length}/${graderResults.length} graders passed`}
              size="small"
              variant="outlined"
              color={passed ? 'success' : 'error'}
            />
          )}
          {result.latency_ms != null && (
            <Chip
              icon={<Zap size={10} />}
              label={result.latency_ms >= 1000
                ? `${(result.latency_ms / 1000).toFixed(2)}s`
                : `${result.latency_ms}ms`}
              size="small" variant="outlined"
            />
          )}
          {result.token_usage?.total_tokens != null && (
            <Chip
              icon={<Cpu size={10} />}
              label={`${result.token_usage.total_tokens} tok`}
              size="small" variant="outlined"
            />
          )}
          {result.trace_id && (
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', ml: 'auto' }}>
              {result.trace_id.slice(0, 12)}…
            </Typography>
          )}
        </Box>
      </AccordionSummary>

      <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
        {/* Execution error banner */}
        {result.error_message && (
          <Box
            sx={{
              p: 1, bgcolor: 'error.50', borderRadius: 1, border: '1px solid',
              borderColor: 'error.light', mb: 1.5,
            }}
          >
            <Typography variant="caption" color="error.main" fontWeight={600} display="block" sx={{ mb: 0.25 }}>
              Execution Error
            </Typography>
            <Typography
              variant="caption"
              component="pre"
              sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '0.7rem', m: 0 }}
            >
              {result.error_message}
            </Typography>
          </Box>
        )}

        {/* Actual output quick-view (from first output_check grader) */}
        {actualOutput !== undefined && actualOutput !== null && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
              Workflow Output
            </Typography>
            <Box
              component="pre"
              sx={{
                m: 0, p: 1, bgcolor: passed ? 'rgba(46,125,50,0.06)' : 'rgba(198,40,40,0.06)',
                borderRadius: 1, border: '1px solid',
                borderColor: passed ? 'success.light' : 'error.light',
                fontSize: '0.75rem', fontFamily: 'monospace',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                maxHeight: 180, overflowY: 'auto',
              }}
            >
              {formatValue(actualOutput)}
            </Box>
          </Box>
        )}

        {/* Grader results table */}
        {graderResults.length > 0 && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
              Grader Details
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow
                    sx={{ '& th': { py: 0.5, fontSize: '0.65rem', color: 'text.secondary', fontWeight: 600, bgcolor: 'grey.50' } }}
                  >
                    <TableCell sx={{ width: 28, px: 1 }} />
                    <TableCell>Grader</TableCell>
                    <TableCell sx={{ width: 60 }}>Score</TableCell>
                    <TableCell>Expected / Actual / Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {graderResults.map((g, i) => (
                    <GraderDetailRow key={i} g={g as Record<string, unknown>} idx={i} />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {graderResults.length === 0 && !result.error_message && (
          <Typography variant="caption" color="text.disabled">
            No grader results — the trial may still be running or had no graders configured.
          </Typography>
        )}

        {/* Token usage breakdown */}
        {result.token_usage && Object.keys(result.token_usage).length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            {Object.entries(result.token_usage).map(([k, v]) => (
              <Chip
                key={k}
                label={`${k.replace(/_/g, ' ')}: ${v}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.65rem', height: 20 }}
              />
            ))}
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  )
}

// ─── TaskResultGroup ──────────────────────────────────────────────────────────

interface TaskResultGroupProps {
  taskId: string
  results: TaskResult[]
}

function TaskResultGroup({ taskId, results }: TaskResultGroupProps) {
  const passedCount = results.filter((r) => r.passed === true || (r.passed as unknown) === 1).length
  const total = results.length
  const displayName = results[0]?.task_name || taskId

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <List size={16} />
        <Typography variant="subtitle2">{displayName}</Typography>
        {displayName !== taskId && (
          <Typography variant="caption" color="text.secondary" fontFamily="monospace">
            ({taskId})
          </Typography>
        )}
        <Chip
          label={`${passedCount}/${total} passed`}
          size="small"
          color={passedCount === total ? 'success' : passedCount === 0 ? 'error' : 'warning'}
          variant="outlined"
        />
      </Box>
      {results.map((r) => (
        <TrialPanel key={r.result_id} result={r} defaultExpanded={results.length === 1} />
      ))}
    </Box>
  )
}

// ─── TraceViewer (main export) ────────────────────────────────────────────────

interface TraceViewerProps {
  /** All task results for a run, grouped by task */
  taskResults: TaskResult[]
  /** Optional single task filter */
  filterTaskId?: string
}

export default function TraceViewer({ taskResults, filterTaskId }: TraceViewerProps) {
  const grouped = React.useMemo(() => {
    const map = new Map<string, TaskResult[]>()
    const filtered = filterTaskId
      ? taskResults.filter((r) => r.task_id === filterTaskId)
      : taskResults
    for (const r of filtered) {
      const key = r.task_id
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    map.forEach((v) => v.sort((a, b) => a.trial_number - b.trial_number))
    return map
  }, [taskResults, filterTaskId])

  if (grouped.size === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No execution results to display.
        </Typography>
      </Box>
    )
  }

  return (
    <Box>
      {Array.from(grouped.entries()).map(([taskId, results]) => (
        <React.Fragment key={taskId}>
          <TaskResultGroup taskId={taskId} results={results} />
          <Divider sx={{ mb: 2 }} />
        </React.Fragment>
      ))}
    </Box>
  )
}
