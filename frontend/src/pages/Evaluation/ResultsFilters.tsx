/**
 * ResultsFilters
 *
 * Self-contained filter bar + HeatmapPanel wrapper for the Tasks tab.
 * All filtering happens internally; parent simply passes raw task_results.
 *
 * Filters:
 *   - Text search (task name)
 *   - Status: All | Always Pass | Partially Pass | Never Pass | Has Error
 *   - Grader: show only tasks where a specific grader failed
 */

import { useMemo, useState } from 'react'
import {
  Box, Chip, InputAdornment, MenuItem, Select, Typography, TextField,
} from '@mui/material'
import { Filter, Search, X } from 'lucide-react'
import { TaskResult } from '@/stores/useEvaluationStore'
import HeatmapPanel from './HeatmapPanel'

// ── Types ─────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'always_pass' | 'partial_pass' | 'never_pass' | 'has_error'

const STATUS_OPTIONS: { value: StatusFilter; label: string; activeColor: string }[] = [
  { value: 'all',          label: 'All',            activeColor: '#1565c0' },
  { value: 'always_pass',  label: 'Always Pass',    activeColor: '#2e7d32' },
  { value: 'partial_pass', label: 'Partially Pass', activeColor: '#e65100' },
  { value: 'never_pass',   label: 'Never Pass',     activeColor: '#c62828' },
  { value: 'has_error',    label: 'Has Error',      activeColor: '#6a1a9a' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function isPassed(r: TaskResult): boolean {
  return r.passed === true || (r.passed as unknown) === 1
}

/** Group task results by task_id */
function groupByTask(results: TaskResult[]): Map<string, TaskResult[]> {
  const map = new Map<string, TaskResult[]>()
  for (const r of results) {
    const list = map.get(r.task_id) ?? []
    list.push(r)
    map.set(r.task_id, list)
  }
  return map
}

/** Extract all unique grader names across all task results */
function extractGraders(results: TaskResult[]): string[] {
  const seen = new Set<string>()
  for (const r of results) {
    for (const gr of (r.grader_results ?? [])) {
      const name = gr.grader_name as string
      if (name) seen.add(name)
    }
  }
  return [...seen].sort()
}

/** Apply all filters and return matching TaskResult rows */
function applyFilters(
  results: TaskResult[],
  search: string,
  status: StatusFilter,
  grader: string,
): TaskResult[] {
  if (!search && status === 'all' && !grader) return results

  const grouped = groupByTask(results)

  // Determine which task_ids survive the status filter
  const passStatus = new Set<string>()
  for (const [taskId, trials] of grouped.entries()) {
    const passCount = trials.filter(isPassed).length
    const hasErr = trials.some(t => t.error_message)
    let ok = true
    if (status === 'always_pass')  ok = passCount === trials.length
    else if (status === 'partial_pass') ok = passCount > 0 && passCount < trials.length
    else if (status === 'never_pass')   ok = passCount === 0
    else if (status === 'has_error')    ok = hasErr
    if (ok) passStatus.add(taskId)
  }

  return results.filter(r => {
    // Status
    if (status !== 'all' && !passStatus.has(r.task_id)) return false

    // Name search
    if (search) {
      const name = (r.task_name ?? r.task_id).toLowerCase()
      if (!name.includes(search.toLowerCase())) return false
    }

    // Grader filter — hide trials where the chosen grader passed
    if (grader) {
      const gr = (r.grader_results ?? []).find(g => (g.grader_name as string) === grader)
      if (gr?.passed) return false
    }

    return true
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ResultsFiltersProps {
  taskResults: TaskResult[]
}

export default function ResultsFilters({ taskResults }: ResultsFiltersProps) {
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState<StatusFilter>('all')
  const [grader, setGrader]   = useState('')

  const graders  = useMemo(() => extractGraders(taskResults), [taskResults])
  const filtered = useMemo(() => applyFilters(taskResults, search, status, grader), [taskResults, search, status, grader])

  const isFiltered = search !== '' || status !== 'all' || grader !== ''
  const hidden = taskResults.length - filtered.length

  function reset() {
    setSearch('')
    setStatus('all')
    setGrader('')
  }

  return (
    <Box>
      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1.5 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>

          {/* Name search */}
          <TextField
            size="small"
            placeholder="Search tasks…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search size={14} /></InputAdornment>,
            }}
            sx={{ minWidth: 180, maxWidth: 260 }}
          />

          {/* Grader selector */}
          {graders.length > 0 && (
            <Select
              size="small"
              value={grader}
              onChange={e => setGrader(e.target.value)}
              displayEmpty
              sx={{ minWidth: 170 }}
            >
              <MenuItem value=""><em>All graders</em></MenuItem>
              {graders.map(g => (
                <MenuItem key={g} value={g}>Show where "{g}" failed</MenuItem>
              ))}
            </Select>
          )}

          {/* Filter icon separator */}
          <Filter size={14} style={{ opacity: 0.4 }} />

          {/* Status chips */}
          {STATUS_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              label={opt.label}
              size="small"
              clickable
              onClick={() => setStatus(opt.value)}
              variant={status === opt.value ? 'filled' : 'outlined'}
              sx={status === opt.value ? {
                bgcolor: opt.activeColor,
                color: '#fff',
                '&:hover': { bgcolor: opt.activeColor, filter: 'brightness(1.1)' },
              } : {}}
            />
          ))}

          {/* Reset */}
          {isFiltered && (
            <Chip
              label="Reset filters"
              size="small"
              deleteIcon={<X size={12} />}
              onDelete={reset}
              onClick={reset}
              variant="outlined"
            />
          )}
        </Box>

        {/* Filter summary */}
        {isFiltered && (
          <Typography variant="caption" color="text.secondary">
            Showing {filtered.length} of {taskResults.length} trial results
            {hidden > 0 ? ` — ${hidden} hidden by active filter` : ''}
          </Typography>
        )}
      </Box>

      {/* ── Heatmap ─────────────────────────────────────────────────────── */}
      <HeatmapPanel taskResults={filtered} />
    </Box>
  )
}
