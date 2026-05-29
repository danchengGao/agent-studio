/**
 * CustomMetricBuilder
 *
 * A no-code metric builder dialog. The user picks a metric type and fills out
 * a form; the dialog generates the corresponding Python compute() function.
 *
 * Metric types:
 *  1. Filtered Pass Rate  — fraction of trials that pass AND meet extra conditions
 *  2. Percentile           — Nth percentile of score or latency
 *  3. Error Rate           — fraction of trials with errors (or grader failures)
 *  4. Custom Code          — raw Python editor (for power users)
 *
 * onSave receives { name, description?, code } — same shape as CustomMetricDef.
 */

import { useEffect, useState } from 'react'
import {
  Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControlLabel, IconButton, MenuItem, Paper, Select, Slider,
  TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material'
import { CheckCircle, Code, Eye, EyeOff, Filter, Percent, X } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CustomMetricOutput {
  name: string
  description?: string
  code: string
  metric_type?: string
}

type MetricType = 'filtered_pass' | 'percentile' | 'error_rate' | 'custom'

// ── Code generators ───────────────────────────────────────────────────────────

interface FilteredPassOptions {
  requirePassed: boolean
  minScore: number | null
  maxLatencyMs: number | null
  requireNoError: boolean
  graderName: string       // '' = any grader
}

function genFilteredPass(name: string, desc: string, opts: FilteredPassOptions): string {
  const conditions: string[] = []
  if (opts.requirePassed)        conditions.push("r.get('passed')")
  if (opts.minScore != null)     conditions.push(`r.get('score', 0) >= ${opts.minScore}`)
  if (opts.maxLatencyMs != null) conditions.push(`(r.get('latency_ms') or 0) <= ${opts.maxLatencyMs}`)
  if (opts.requireNoError)       conditions.push("not r.get('error_message')")
  if (opts.graderName) {
    conditions.push(
      `all(g.get('passed') for g in (r.get('grader_results') or []) if g.get('grader_name') == '${opts.graderName}')`
    )
  }

  const condStr = conditions.length > 0
    ? conditions.map(c => `        ${c}`).join(' and\n')
    : '        True'

  const docDesc = desc || `Fraction of trials where: ${conditions.join(', ') || 'all trials'}`

  return `def compute(results):
    """${docDesc}"""
    if not results:
        return 0.0
    matching = [
        r for r in results
        if (
${condStr}
        )
    ]
    return len(matching) / len(results)
`
}

interface PercentileOptions {
  field: 'score' | 'latency_ms'
  percentile: number
}

function genPercentile(name: string, desc: string, opts: PercentileOptions): string {
  const fieldLabel = opts.field === 'score' ? 'score' : 'latency_ms'
  const docDesc = desc || `P${opts.percentile} of ${fieldLabel} across all trials`

  return `def compute(results):
    """${docDesc}"""
    values = [r.get('${fieldLabel}') for r in results if r.get('${fieldLabel}') is not None]
    if not values:
        return 0.0
    values = sorted(values)
    idx = max(0, int(len(values) * ${(opts.percentile / 100).toFixed(2)}) - 1)
    return float(values[idx])
`
}

interface ErrorRateOptions {
  countType: 'any_error' | 'grader_fail' | 'low_score'
  graderName: string
  scoreThreshold: number
}

function genErrorRate(name: string, desc: string, opts: ErrorRateOptions): string {
  let condition = ''
  let docLine = ''
  if (opts.countType === 'any_error') {
    condition = `bool(r.get('error_message'))`
    docLine = 'fraction of trials that raised an error'
  } else if (opts.countType === 'grader_fail') {
    const gn = opts.graderName || 'any_grader'
    condition = opts.graderName
      ? `any(not g.get('passed') for g in (r.get('grader_results') or []) if g.get('grader_name') == '${gn}')`
      : `any(not g.get('passed') for g in (r.get('grader_results') or []))`
    docLine = opts.graderName
      ? `fraction of trials where grader '${gn}' failed`
      : `fraction of trials where at least one grader failed`
  } else {
    condition = `r.get('score', 1.0) < ${opts.scoreThreshold}`
    docLine = `fraction of trials with score below ${opts.scoreThreshold}`
  }

  const docDesc = desc || docLine

  return `def compute(results):
    """${docDesc}"""
    if not results:
        return 0.0
    count = sum(1 for r in results if ${condition})
    return count / len(results)
`
}

// ── Sub-forms ─────────────────────────────────────────────────────────────────

function FilteredPassForm({ opts, onChange }: {
  opts: FilteredPassOptions
  onChange: (p: Partial<FilteredPassOptions>) => void
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="caption" color="text.secondary">
        Count trials that match ALL checked conditions.
      </Typography>

      <FormControlLabel
        control={<Checkbox checked={opts.requirePassed} onChange={e => onChange({ requirePassed: e.target.checked })} size="small" />}
        label={<Typography variant="body2">Trial must have passed</Typography>}
      />
      <FormControlLabel
        control={<Checkbox checked={opts.requireNoError} onChange={e => onChange({ requireNoError: e.target.checked })} size="small" />}
        label={<Typography variant="body2">No error message</Typography>}
      />

      <Box>
        <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
          Minimum score (optional)
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Checkbox
            checked={opts.minScore !== null}
            onChange={e => onChange({ minScore: e.target.checked ? 0.7 : null })}
            size="small"
          />
          <Slider
            disabled={opts.minScore === null}
            value={opts.minScore ?? 0.7}
            min={0} max={1} step={0.05}
            onChange={(_, v) => onChange({ minScore: v as number })}
            valueLabelDisplay="auto"
            valueLabelFormat={v => `${(v * 100).toFixed(0)}%`}
            sx={{ flex: 1 }}
          />
          <Typography variant="caption" sx={{ minWidth: 40 }}>
            {opts.minScore !== null ? `≥ ${(opts.minScore * 100).toFixed(0)}%` : 'off'}
          </Typography>
        </Box>
      </Box>

      <Box>
        <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
          Max latency (ms, optional)
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Checkbox
            checked={opts.maxLatencyMs !== null}
            onChange={e => onChange({ maxLatencyMs: e.target.checked ? 3000 : null })}
            size="small"
          />
          <TextField
            disabled={opts.maxLatencyMs === null}
            type="number"
            size="small"
            value={opts.maxLatencyMs ?? ''}
            onChange={e => onChange({ maxLatencyMs: e.target.value ? Number(e.target.value) : null })}
            inputProps={{ min: 0 }}
            sx={{ width: 120 }}
          />
          <Typography variant="caption">ms</Typography>
        </Box>
      </Box>

      <Box>
        <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
          Specific grader must pass (optional)
        </Typography>
        <TextField
          size="small"
          placeholder="e.g. output_check (leave blank for all)"
          value={opts.graderName}
          onChange={e => onChange({ graderName: e.target.value })}
          fullWidth
        />
      </Box>
    </Box>
  )
}

function PercentileForm({ opts, onChange }: {
  opts: PercentileOptions
  onChange: (p: Partial<PercentileOptions>) => void
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
          Measure
        </Typography>
        <Select size="small" value={opts.field} onChange={e => onChange({ field: e.target.value as 'score' | 'latency_ms' })}>
          <MenuItem value="score">Score (0–1)</MenuItem>
          <MenuItem value="latency_ms">Latency (ms)</MenuItem>
        </Select>
      </Box>
      <Box>
        <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
          Percentile: P{opts.percentile}
        </Typography>
        <Slider
          value={opts.percentile}
          min={50} max={99} step={1}
          onChange={(_, v) => onChange({ percentile: v as number })}
          marks={[{ value: 50, label: 'P50' }, { value: 75, label: 'P75' }, { value: 95, label: 'P95' }, { value: 99, label: 'P99' }]}
          valueLabelDisplay="auto"
        />
      </Box>
    </Box>
  )
}

function ErrorRateForm({ opts, onChange }: {
  opts: ErrorRateOptions
  onChange: (p: Partial<ErrorRateOptions>) => void
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
          Count when
        </Typography>
        <Select size="small" fullWidth value={opts.countType} onChange={e => onChange({ countType: e.target.value as ErrorRateOptions['countType'] })}>
          <MenuItem value="any_error">Trial has an error message</MenuItem>
          <MenuItem value="grader_fail">A specific grader fails</MenuItem>
          <MenuItem value="low_score">Score is below threshold</MenuItem>
        </Select>
      </Box>

      {opts.countType === 'grader_fail' && (
        <TextField
          size="small"
          label="Grader name (blank = any)"
          value={opts.graderName}
          onChange={e => onChange({ graderName: e.target.value })}
          fullWidth
        />
      )}

      {opts.countType === 'low_score' && (
        <Box>
          <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
            Score threshold: {opts.scoreThreshold}
          </Typography>
          <Slider
            value={opts.scoreThreshold}
            min={0} max={1} step={0.05}
            onChange={(_, v) => onChange({ scoreThreshold: v as number })}
            valueLabelDisplay="auto"
            valueLabelFormat={v => `${(v * 100).toFixed(0)}%`}
          />
        </Box>
      )}
    </Box>
  )
}

// ── Code preview ──────────────────────────────────────────────────────────────

function CodePreview({ code }: { code: string }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5, bgcolor: '#1e1e1e', borderRadius: 1,
        fontFamily: 'monospace', fontSize: '0.78rem', color: '#d4d4d4',
        whiteSpace: 'pre', overflowX: 'auto', maxHeight: 220, overflowY: 'auto',
      }}
    >
      {code}
    </Paper>
  )
}

// ── Main dialog ───────────────────────────────────────────────────────────────

const METRIC_TYPES: { value: MetricType; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: 'filtered_pass',
    label: 'Filtered Pass Rate',
    icon: <Filter size={16} />,
    description: 'Fraction of trials that pass all your conditions (score, latency, grader)',
  },
  {
    value: 'percentile',
    label: 'Percentile',
    icon: <Percent size={16} />,
    description: 'Nth percentile of score or latency — useful for worst-case analysis',
  },
  {
    value: 'error_rate',
    label: 'Error / Failure Rate',
    icon: <X size={16} />,
    description: 'Fraction of trials with errors or grader failures',
  },
  {
    value: 'custom',
    label: 'Custom Code',
    icon: <Code size={16} />,
    description: 'Write your own Python function for full control',
  },
]

const DEFAULT_CUSTOM_CODE = `def compute(results):
    """My custom metric.

    Args:
        results: list of task result dicts, each with:
            passed (bool), score (float 0-1), latency_ms (int),
            grader_results (list), error_message (str or None)
    Returns:
        float — the computed metric value
    """
    if not results:
        return 0.0
    # Your logic here
    return sum(r.get('score', 0) for r in results) / len(results)
`

interface CustomMetricBuilderProps {
  open: boolean
  onClose: () => void
  onSave: (metric: CustomMetricOutput) => void
  /** Pre-fill for editing an existing metric */
  initial?: CustomMetricOutput
}

export default function CustomMetricBuilder({ open, onClose, onSave, initial }: CustomMetricBuilderProps) {
  const [name, setName]         = useState('')
  const [desc, setDesc]         = useState('')
  const [metricType, setMetricType] = useState<MetricType>('filtered_pass')
  const [showPreview, setShowPreview] = useState(true)
  const [error, setError]       = useState('')

  // Type-specific state
  const [fpOpts, setFpOpts] = useState<FilteredPassOptions>({
    requirePassed: true, minScore: null, maxLatencyMs: null, requireNoError: false, graderName: '',
  })
  const [pctOpts, setPctOpts] = useState<PercentileOptions>({ field: 'score', percentile: 95 })
  const [errOpts, setErrOpts] = useState<ErrorRateOptions>({ countType: 'any_error', graderName: '', scoreThreshold: 0.5 })
  const [customCode, setCustomCode] = useState(DEFAULT_CUSTOM_CODE)

  // Reset / load initial on open
  useEffect(() => {
    if (open) {
      if (initial) {
        setName(initial.name)
        setDesc(initial.description ?? '')
        // Restore the builder type used when this metric was created (if stored).
        // Fall back to 'custom' so the raw code is always editable for old metrics.
        const typ = (initial.metric_type as MetricType) ?? 'custom'
        setMetricType(typ)
        setCustomCode(initial.code)
        // Reset form opts to defaults — we don't store them, so form-based types
        // will start fresh but with the correct type tab selected.
        setFpOpts({ requirePassed: true, minScore: null, maxLatencyMs: null, requireNoError: false, graderName: '' })
        setPctOpts({ field: 'score', percentile: 95 })
        setErrOpts({ countType: 'any_error', graderName: '', scoreThreshold: 0.5 })
      } else {
        setName('')
        setDesc('')
        setMetricType('filtered_pass')
        setFpOpts({ requirePassed: true, minScore: null, maxLatencyMs: null, requireNoError: false, graderName: '' })
        setPctOpts({ field: 'score', percentile: 95 })
        setErrOpts({ countType: 'any_error', graderName: '', scoreThreshold: 0.5 })
        setCustomCode(DEFAULT_CUSTOM_CODE)
      }
      setError('')
      setShowPreview(true)
    }
  }, [open])

  // Generate code from current form state
  function buildCode(): string {
    if (metricType === 'filtered_pass') return genFilteredPass(name, desc, fpOpts)
    if (metricType === 'percentile')    return genPercentile(name, desc, pctOpts)
    if (metricType === 'error_rate')    return genErrorRate(name, desc, errOpts)
    return customCode
  }

  const generatedCode = buildCode()

  function handleSave() {
    if (!name.trim()) { setError('Metric name is required.'); return }
    if (!/^[a-z_][a-z0-9_]*$/i.test(name.trim())) {
      setError('Name must be a valid Python identifier (letters, numbers, underscores).')
      return
    }
    if (metricType === 'custom' && !customCode.trim()) {
      setError('Code is required for custom metrics.')
      return
    }
    setError('')
    onSave({ name: name.trim(), description: desc.trim() || undefined, code: generatedCode, metric_type: metricType })
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography fontWeight={700} variant="h6">
          {initial ? 'Edit Custom Metric' : 'Create Custom Metric'}
        </Typography>
        <IconButton size="small" onClick={onClose}><X size={16} /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>

        {/* Name + description */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Metric name *"
            helperText="Python identifier (e.g. high_quality_pass)"
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            size="small"
            sx={{ flex: 1 }}
          />
          <TextField
            label="Description (optional)"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            size="small"
            sx={{ flex: 2 }}
          />
        </Box>

        <Divider />

        {/* Metric type picker */}
        <Box>
          <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" sx={{ mb: 1 }}>
            METRIC TYPE
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {METRIC_TYPES.map(mt => (
              <Paper
                key={mt.value}
                variant="outlined"
                onClick={() => setMetricType(mt.value)}
                sx={{
                  p: 1.5, cursor: 'pointer', minWidth: 140, flex: '1 1 140px',
                  border: metricType === mt.value ? '2px solid' : '1px solid',
                  borderColor: metricType === mt.value ? 'primary.main' : 'divider',
                  bgcolor: metricType === mt.value ? 'primary.50' : 'background.paper',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' },
                  transition: 'all 0.15s',
                }}
              >
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
                  <Box sx={{ color: metricType === mt.value ? 'primary.main' : 'text.secondary' }}>{mt.icon}</Box>
                  <Typography variant="body2" fontWeight={700}>{mt.label}</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">{mt.description}</Typography>
              </Paper>
            ))}
          </Box>
        </Box>

        <Divider />

        {/* Type-specific form */}
        <Box>
          <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" sx={{ mb: 1.5 }}>
            CONFIGURATION
          </Typography>
          {metricType === 'filtered_pass' && (
            <FilteredPassForm opts={fpOpts} onChange={p => setFpOpts(o => ({ ...o, ...p }))} />
          )}
          {metricType === 'percentile' && (
            <PercentileForm opts={pctOpts} onChange={p => setPctOpts(o => ({ ...o, ...p }))} />
          )}
          {metricType === 'error_rate' && (
            <ErrorRateForm opts={errOpts} onChange={p => setErrOpts(o => ({ ...o, ...p }))} />
          )}
          {metricType === 'custom' && (
            <TextField
              label="Python code"
              value={customCode}
              onChange={e => setCustomCode(e.target.value)}
              fullWidth
              multiline
              rows={10}
              size="small"
              inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.82rem' } }}
            />
          )}
        </Box>

        {/* Live code preview */}
        {metricType !== 'custom' && (
          <>
            <Divider />
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  GENERATED PYTHON CODE
                </Typography>
                <Tooltip title={showPreview ? 'Hide code' : 'Show code'}>
                  <IconButton size="small" onClick={() => setShowPreview(v => !v)}>
                    {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                  </IconButton>
                </Tooltip>
              </Box>
              {showPreview && <CodePreview code={generatedCode} />}
            </Box>
          </>
        )}

        {error && (
          <Typography color="error" variant="caption">{error}</Typography>
        )}

      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          startIcon={<CheckCircle size={14} />}
          disabled={!name.trim()}
        >
          {initial ? 'Save Changes' : 'Add Metric'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
