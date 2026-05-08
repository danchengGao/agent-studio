import React, { useState } from 'react'
import {
  Alert, Box, Button, Chip, Divider, IconButton,
  Paper, Tooltip, Typography,
} from '@mui/material'
import { Code2, Edit2, Info, Plus, Sigma, Trash2 } from 'lucide-react'
import { CustomMetricDef, EvaluationResults, useEvaluationStore } from '@/stores/useEvaluationStore'
import CustomMetricBuilder, { CustomMetricOutput } from './CustomMetricBuilder'

// ─── helpers ──────────────────────────────────────────────────────────────────

function pct(n: number): string { return `${(n * 100).toFixed(1)}%` }

function formatValue(raw: unknown): { display: string; color: 'success' | 'warning' | 'error' | 'default'; error?: string } {
  if (raw === undefined || raw === null) return { display: '—', color: 'default' }
  if (typeof raw === 'object' && raw !== null && 'error' in raw) {
    return { display: 'Error', color: 'error', error: String((raw as { error: string }).error) }
  }
  if (typeof raw === 'number') {
    const display = raw >= 0 && raw <= 1 ? pct(raw) : raw.toFixed(3)
    const color = raw >= 0 && raw <= 1
      ? (raw >= 0.8 ? 'success' : raw >= 0.5 ? 'warning' : 'error')
      : 'default'
    return { display, color: color as 'success' | 'warning' | 'error' | 'default' }
  }
  if (typeof raw === 'object' && raw !== null && 'value' in raw) {
    return formatValue((raw as { value: unknown }).value)
  }
  return { display: JSON.stringify(raw), color: 'default' }
}

// ─── Explanation banner ────────────────────────────────────────────────────────

function ExplanationBanner() {
  return (
    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'info.50', borderColor: 'info.200' }}>
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <Info size={16} style={{ color: '#0288d1', flexShrink: 0, marginTop: 2 }} />
        <Typography variant="subtitle2" color="info.dark" fontWeight={700}>
          What are Custom Metrics?
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Custom Metrics are Python functions you write once and attach to a suite. After every run
        they receive <em>all trial results</em> as input and compute an aggregate number — for
        example "average score on easy tasks only", "error rate for a specific pattern", or
        "latency at the 95th percentile".
      </Typography>

      <Divider sx={{ my: 1.5 }} />

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
        <Box>
          <Typography variant="caption" fontWeight={700} color="text.primary" display="block" gutterBottom>
            When they run
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Automatically after each evaluation run completes. Values appear in this tab and in
            exported reports. They do <em>not</em> affect the pass/fail decision — they are
            additive measurements.
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" fontWeight={700} color="text.primary" display="block" gutterBottom>
            Function signature
          </Typography>
          <Box component="pre" sx={{ m: 0, p: 1, bgcolor: 'grey.100', borderRadius: 1, fontSize: '0.72rem', fontFamily: 'monospace', border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
{`def compute(results):
  # results: list of dicts
  # keys: task_id, passed,
  # score, latency_ms,
  # token_usage, error_message,
  # grader_results
  return float  # or dict`}
          </Box>
        </Box>
        <Box>
          <Typography variant="caption" fontWeight={700} color="text.primary" display="block" gutterBottom>
            Return value
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Return a <strong>float 0–1</strong> (shown as %) or any JSON-serialisable value.
            Floats between 0 and 1 are colour-coded: green ≥ 80%, orange ≥ 50%, red below.
            You can also return a dict with a <code>value</code> key for richer output.
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ my: 1.5 }} />

      <Typography variant="caption" color="text.secondary">
        <strong>Tip:</strong> Use the builder to pick a template (filtered pass rate, percentile,
        error rate) or write your own Python. Metrics are stored with the suite and run on every
        future evaluation automatically.
      </Typography>
    </Paper>
  )
}

// ─── MetricRow ────────────────────────────────────────────────────────────────

interface MetricRowProps {
  metric: CustomMetricDef
  computedValue: unknown
  onEdit: () => void
  onDelete: () => void
}

function MetricRow({ metric, computedValue, onEdit, onDelete }: MetricRowProps) {
  const { display, color, error } = formatValue(computedValue)
  const hasValue = computedValue !== undefined

  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
      <Box sx={{ color: 'text.disabled', flexShrink: 0, mt: 0.25 }}>
        <Sigma size={18} />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Name + value chip + type chip */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
          <Typography variant="subtitle2" fontWeight={700}>{metric.name}</Typography>

          {hasValue ? (
            <Tooltip title={error ?? ''}>
              <Chip
                label={display}
                size="small"
                color={color}
                sx={{ height: 22, fontSize: '0.75rem', fontWeight: 700 }}
              />
            </Tooltip>
          ) : (
            <Chip
              label="run to see value"
              size="small"
              variant="outlined"
              sx={{ height: 22, fontSize: '0.72rem', color: 'text.disabled', borderStyle: 'dashed' }}
            />
          )}

          {metric.metric_type && metric.metric_type !== 'custom' && (
            <Chip
              label={metric.metric_type.replace(/_/g, ' ')}
              size="small"
              variant="outlined"
              sx={{ height: 18, fontSize: '0.65rem' }}
            />
          )}
        </Box>

        {/* Description */}
        {metric.description && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
            {metric.description}
          </Typography>
        )}

        {/* Code preview */}
        <Box
          component="pre"
          sx={{
            m: 0, p: 1, bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider',
            borderRadius: 1, fontSize: '0.72rem', fontFamily: 'monospace',
            overflowX: 'auto', maxHeight: 80,
          }}
        >
          {metric.code.slice(0, 300)}{metric.code.length > 300 ? '\n…' : ''}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 1, py: 0, fontSize: '0.75rem' }}>
            {error}
          </Alert>
        )}
      </Box>

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
        <Tooltip title="Edit metric">
          <IconButton size="small" onClick={onEdit}><Edit2 size={14} /></IconButton>
        </Tooltip>
        <Tooltip title="Delete metric">
          <IconButton size="small" onClick={onDelete}><Trash2 size={14} /></IconButton>
        </Tooltip>
      </Box>
    </Paper>
  )
}

// ─── CustomMetricsPanel ───────────────────────────────────────────────────────

interface Props {
  results: EvaluationResults
  evaluationId: string
}

export default function CustomMetricsPanel({ results, evaluationId }: Props) {
  const [builderOpen, setBuilderOpen] = useState(false)
  const [builderInitial, setBuilderInitial] = useState<CustomMetricOutput | undefined>(undefined)

  const { suites, updateSuiteConfig } = useEvaluationStore()
  const suite = suites.find(s => s.evaluation_id === evaluationId)
  const definedMetrics: CustomMetricDef[] = suite?.config?.custom_metrics ?? []
  const computedValues = results.metrics?.custom_metrics ?? {}

  const handleSave = async (metric: CustomMetricOutput) => {
    if (!suite) return
    const editIdx = definedMetrics.findIndex(m => m.name === (builderInitial?.name ?? ''))
    const updated = { name: metric.name, description: metric.description, code: metric.code, metric_type: metric.metric_type }
    const newList = editIdx >= 0
      ? definedMetrics.map((m, i) => i === editIdx ? updated : m)
      : [...definedMetrics, updated]
    await updateSuiteConfig(suite.evaluation_id, { ...suite.config, custom_metrics: newList })
    setBuilderInitial(undefined)
  }

  const handleDelete = async (idx: number) => {
    if (!suite) return
    const newList = definedMetrics.filter((_, i) => i !== idx)
    await updateSuiteConfig(suite.evaluation_id, { ...suite.config, custom_metrics: newList })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <ExplanationBanner />

      {/* Header + Add button */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Defined Metrics ({definedMetrics.length})
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<Plus size={14} />}
          onClick={() => { setBuilderInitial(undefined); setBuilderOpen(true) }}
        >
          Add Metric
        </Button>
      </Box>

      {/* Empty state */}
      {definedMetrics.length === 0 && (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', borderStyle: 'dashed' }}>
          <Code2 size={32} style={{ color: '#bdbdbd', marginBottom: 8 }} />
          <Typography variant="body2" color="text.secondary" gutterBottom>
            No custom metrics defined yet.
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            Click <strong>Add Metric</strong> to create a Python function that computes an
            aggregate score from run results.
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Plus size={13} />}
            onClick={() => { setBuilderInitial(undefined); setBuilderOpen(true) }}
          >
            Add First Metric
          </Button>
        </Paper>
      )}

      {/* Metric rows */}
      {definedMetrics.map((metric, idx) => (
        <MetricRow
          key={metric.name}
          metric={metric}
          computedValue={computedValues[metric.name]}
          onEdit={() => {
            setBuilderInitial({ name: metric.name, description: metric.description,
              code: metric.code, metric_type: metric.metric_type })
            setBuilderOpen(true)
          }}
          onDelete={() => handleDelete(idx)}
        />
      ))}

      <CustomMetricBuilder
        open={builderOpen}
        onClose={() => { setBuilderOpen(false); setBuilderInitial(undefined) }}
        onSave={handleSave}
        initial={builderInitial}
      />
    </Box>
  )
}
