import React, { useEffect, useState } from 'react'
import {
  Alert, Box, Chip, Divider, IconButton, LinearProgress, Menu, MenuItem,
  Paper, Tab, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Tabs, Tooltip, Typography,
} from '@mui/material'
import { BarChart2, Clock, Download, FileText, GitBranch, LayoutGrid, Lightbulb, RefreshCw, Scale, Shield, Sigma, TrendingDown, TrendingUp } from 'lucide-react'
import { useEvaluationStore } from '@/stores/useEvaluationStore'
import MetricsPanel from './MetricsPanel'
import AnalysisPanel from './AnalysisPanel'
import TraceViewer from './TraceViewer'
import ReliabilityPanel from './ReliabilityPanel'
import CustomMetricsPanel from './CustomMetricsPanel'
import ExplainResultsModal from './ExplainResultsModal'
import ResultsFilters from './ResultsFilters'
import { generateHtmlReport, generateCsv, triggerDownload } from './reportGenerator'

type TabKey = 'overview' | 'analysis' | 'graders' | 'traces' | 'tasks' | 'reliability' | 'custom-metrics'

interface Props {
  runId: string
  evaluationId?: string
  workflowNames?: Record<string, string>
  agentNames?: Record<string, string>
}

export default function EvaluationResults({ runId, evaluationId, workflowNames = {}, agentNames = {} }: Props) {
  const { currentResults, loading, error, fetchResults, pollResults } = useEvaluationStore()
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null)
  const [explainOpen, setExplainOpen] = useState(false)

  useEffect(() => {
    fetchResults(runId)
    const stop = pollResults(runId, 4000)
    return stop
  }, [runId])

  const runLabel = currentResults
    ? (currentResults.workflow_name ?? currentResults.agent_name ?? currentResults.run_id.slice(0, 12))
    : runId.slice(0, 12)

  const handleExportCsv = () => {
    if (!currentResults) return
    setExportAnchor(null)
    const date = new Date().toISOString().slice(0, 10)
    triggerDownload(generateCsv(currentResults), `eval-${runId.slice(0, 8)}-${date}.csv`, 'text/csv')
  }

  const handleExportJson = () => {
    if (!currentResults) return
    setExportAnchor(null)
    const date = new Date().toISOString().slice(0, 10)
    triggerDownload(JSON.stringify(currentResults, null, 2), `eval-${runId.slice(0, 8)}-${date}.json`, 'application/json')
  }

  const handleExportReport = () => {
    if (!currentResults) return
    const date = new Date().toISOString().slice(0, 10)
    triggerDownload(generateHtmlReport(currentResults, runLabel), `eval-report-${runId.slice(0, 8)}-${date}.html`, 'text/html')
  }

  if (loading && !currentResults) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 3 }}>
        <LinearProgress sx={{ flex: 1 }} />
        <Typography variant="body2" color="text.secondary">Loading results…</Typography>
      </Box>
    )
  }

  if (error) return <Alert severity="error">{error}</Alert>
  if (!currentResults) return <Typography color="text.secondary">No results available.</Typography>

  const { status, task_results } = currentResults
  const isRunning = status === '1'
  const m = currentResults.metrics

  const graderBreakdown = m?.per_grader_breakdown ?? {}
  const hasGraders = Object.keys(graderBreakdown).length > 0
  const hasReliability = m?.reliability_overall !== undefined

  // Build visible tabs in order: Overview → Tasks → Analysis → Custom Metrics → Reliability → Graders → Traces
  const visibleTabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'overview',  label: 'Overview',  icon: <BarChart2 size={14} /> },
    ...(task_results.length > 0 ? [{ key: 'tasks' as TabKey, label: 'Tasks', icon: <LayoutGrid size={14} /> }] : []),
    { key: 'analysis',  label: 'Analysis',  icon: <TrendingUp size={14} /> },
    ...(evaluationId ? [{ key: 'custom-metrics' as TabKey, label: 'Custom Metrics', icon: <Sigma size={14} /> }] : []),
    ...(hasReliability ? [{ key: 'reliability' as TabKey, label: 'Reliability', icon: <Shield size={14} /> }] : []),
    ...(hasGraders ? [{ key: 'graders' as TabKey, label: `Graders (${Object.keys(graderBreakdown).length})`, icon: <Scale size={14} /> }] : []),
    { key: 'traces', label: `Traces${task_results.length ? ` (${task_results.length})` : ''}`, icon: <GitBranch size={14} /> },
  ]

  // If active tab was removed (e.g. graders disappeared), fall back
  const currentTab = visibleTabs.find(t => t.key === activeTab) ? activeTab : 'overview'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%' }}>

      {isRunning && (
        <Alert severity="info" icon={<Clock size={16} />} sx={{ flexShrink: 0 }}>
          Evaluation is running — results will update automatically.
          <LinearProgress sx={{ mt: 1 }} />
        </Alert>
      )}

      {/* Regression / anomaly alerts from harness comparison */}
      {(currentResults.metrics?.alerts ?? []).length > 0 && (
        <Alert severity="warning" icon={<TrendingDown size={16} />} sx={{ flexShrink: 0 }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            Performance regression detected vs. previous run
          </Typography>
          {(currentResults.metrics!.alerts!).map((alert, i) => (
            <Typography key={i} variant="body2">• {alert.message}</Typography>
          ))}
        </Alert>
      )}

      {/* Identity chips + compact action toolbar */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        {currentResults.workflow_id && (
          <Chip
            label={`Workflow: ${currentResults.workflow_name ?? workflowNames[currentResults.workflow_id] ?? `${currentResults.workflow_id.slice(0, 12)}…`}`}
            size="small" variant="outlined"
          />
        )}
        {currentResults.agent_id && (
          <Chip
            label={`Agent: ${currentResults.agent_name ?? agentNames[currentResults.agent_id] ?? `${currentResults.agent_id.slice(0, 12)}…`}`}
            size="small" variant="outlined"
          />
        )}
        <Chip label={`Run: ${currentResults.run_id.slice(0, 8)}…`} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
        <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Tooltip title="Explain results — plain-language insights">
            <span>
              <IconButton size="small" onClick={() => setExplainOpen(true)} disabled={!currentResults || isRunning}>
                <Lightbulb size={16} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Download HTML report">
            <span>
              <IconButton size="small" onClick={handleExportReport} disabled={!currentResults}>
                <FileText size={16} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Export data (CSV / JSON)">
            <span>
              <IconButton size="small" onClick={(e) => setExportAnchor(e.currentTarget)} disabled={!currentResults}>
                <Download size={16} />
              </IconButton>
            </span>
          </Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={() => fetchResults(runId)}>
              <RefreshCw size={16} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Tabs value={currentTab} onChange={(_, v) => setActiveTab(v as TabKey)}>
          {visibleTabs.map(t => (
            <Tab key={t.key} value={t.key} label={t.label} icon={t.icon as React.ReactElement} iconPosition="start" sx={{ minHeight: 40, py: 0.5 }} />
          ))}
        </Tabs>
      </Box>

      {/* ── Overview: stat cards ──────────────────────────────────────────── */}
      {currentTab === 'overview' && (
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          <MetricsPanel results={currentResults} />
        </Box>
      )}

      {/* ── Analysis: full detailed view ──────────────────────────────────── */}
      {currentTab === 'analysis' && (
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          <AnalysisPanel results={currentResults} />
        </Box>
      )}

      {/* ── Custom Metrics ─────────────────────────────────────────────────── */}
      {currentTab === 'custom-metrics' && evaluationId && (
        <Box sx={{ overflowY: 'auto', flex: 1, p: 0.5 }}>
          <CustomMetricsPanel results={currentResults} evaluationId={evaluationId} />
        </Box>
      )}

      {/* ── Reliability ─────────────────────────────────────────────────────── */}
      {currentTab === 'reliability' && (
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          <ReliabilityPanel results={currentResults} />
        </Box>
      )}

      {/* ── Graders ──────────────────────────────────────────────────────── */}
      {currentTab === 'graders' && (
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Grader</TableCell>
                  <TableCell align="right"><Tooltip title="Fraction of trials where this grader passed"><span>Pass rate</span></Tooltip></TableCell>
                  <TableCell align="right"><Tooltip title="Mean score assigned by this grader"><span>Avg score</span></Tooltip></TableCell>
                  <TableCell align="right">Trials</TableCell>
                  <TableCell sx={{ minWidth: 140 }}>Pass rate (bar)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(graderBreakdown).map(([name, { pass_rate, avg_score, count }]) => (
                  <TableRow key={name}>
                    <TableCell><Typography variant="body2" fontFamily="monospace">{name}</Typography></TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={700}
                        color={pass_rate >= 0.8 ? 'success.main' : pass_rate >= 0.5 ? 'warning.main' : 'error.main'}>
                        {(pass_rate * 100).toFixed(1)}%
                      </Typography>
                    </TableCell>
                    <TableCell align="right"><Typography variant="body2">{(avg_score * 100).toFixed(1)}%</Typography></TableCell>
                    <TableCell align="right"><Typography variant="caption" color="text.secondary">{count}</Typography></TableCell>
                    <TableCell sx={{ minWidth: 140 }}>
                      <LinearProgress variant="determinate" value={pass_rate * 100}
                        color={pass_rate >= 0.8 ? 'success' : pass_rate >= 0.5 ? 'warning' : 'error'}
                        sx={{ height: 6, borderRadius: 3 }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* ── Tasks ────────────────────────────────────────────────────────── */}
      {currentTab === 'tasks' && (
        <Box sx={{ overflowY: 'auto', overflowX: 'auto', flex: 1, p: 1 }}>
          <ResultsFilters taskResults={task_results} />
        </Box>
      )}

      {/* ── Traces ───────────────────────────────────────────────────────── */}
      {currentTab === 'traces' && (
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          <TraceViewer taskResults={task_results} />
        </Box>
      )}

      {/* ── Export menu ──────────────────────────────────────────────────── */}
      <Menu
        anchorEl={exportAnchor}
        open={Boolean(exportAnchor)}
        onClose={() => setExportAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={handleExportCsv} dense>
          <Download size={14} style={{ marginRight: 8 }} />
          Export CSV
        </MenuItem>
        <MenuItem onClick={handleExportJson} dense>
          <Download size={14} style={{ marginRight: 8 }} />
          Export JSON
        </MenuItem>
      </Menu>

      {/* ── Explain Results modal ─────────────────────────────────────────── */}
      <ExplainResultsModal
        open={explainOpen}
        onClose={() => setExplainOpen(false)}
        runId={runId}
      />

    </Box>
  )
}
