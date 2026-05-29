import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Chip,
  Tooltip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Tabs,
  Tab,
  Box,
  LinearProgress,
} from '@mui/material'
import { Plus, Play, Trash2, BarChart2, List, ClipboardList, Download, BookOpen, Edit2, Sparkles, GitCompare, HelpCircle } from 'lucide-react'
import { useWorkflows, useAgents } from '@test-agentstudio/api-client'
import { useAuthStore } from '@/stores/useAuthStore'
import { useEvaluationStore, EvaluationSuite, EvaluationRun } from '@/stores/useEvaluationStore'
import EvaluationResults from './EvaluationResults'
import RunEvaluationDialog from './RunEvaluationDialog'
import TaskEditor from './TaskEditor'
import BrowseExamplesDialog from './BrowseExamplesDialog'
import EmptyStateGuide from './EmptyStateGuide'
import FirstRunWizard, { isOnboardingDone } from './FirstRunWizard'
import RunComparisonModal from './RunComparisonModal'
import EvaluationHelpModal from './EvaluationHelpModal'

const TAB_TASKS   = 0
const TAB_RUNS    = 1
const TAB_RESULTS = 2

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}
function TabPanel({ children, value, index }: TabPanelProps) {
  return value === index ? (
    <Box sx={{ pt: 2, flex: 1, overflowY: 'auto', minHeight: 0 }}>{children}</Box>
  ) : null
}

// ─── Add Suite Chooser Dialog ─────────────────────────────────────────────────

interface AddSuiteChooserProps {
  open: boolean
  onClose: () => void
  onBrowseExamples: () => void
  onBlank: () => void
}

function AddSuiteChooserDialog({ open, onClose, onBrowseExamples, onBlank }: AddSuiteChooserProps) {
  const options = [
    {
      icon: <Sparkles size={24} />,
      label: 'Add from Library',
      desc: 'Choose from ready-made benchmarks (10–15 tasks each) or starter templates to add to your suites.',
      onClick: () => { onClose(); onBrowseExamples() },
    },
    {
      icon: <Plus size={24} />,
      label: 'Blank Suite',
      desc: 'Create an empty suite and add tasks manually. Best when you know exactly what to test.',
      onClick: () => { onClose(); onBlank() },
    },
  ]

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Evaluation Suite</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 2 }}>
        {options.map((opt) => (
          <Paper
            key={opt.label}
            variant="outlined"
            onClick={opt.onClick}
            sx={{
              p: 2, display: 'flex', gap: 2, alignItems: 'flex-start', cursor: 'pointer',
              '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' },
              transition: 'all 0.15s',
            }}
          >
            <Box sx={{ color: 'primary.main', mt: 0.5, flexShrink: 0 }}>{opt.icon}</Box>
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>{opt.label}</Typography>
              <Typography variant="body2" color="text.secondary">{opt.desc}</Typography>
            </Box>
          </Paper>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EvaluationPage() {
  const { t } = useTranslation()
  const {
    suites, runs, loading, error,
    fetchSuites, createSuite, updateSuite, deleteSuite, fetchRuns, deleteRun,
    clearError,
  } = useEvaluationStore()

  const spaceId = useAuthStore((s) => s.user?.spaceId) || ''

  // Default tab is Runs (TAB_RUNS = 1) per spec
  const [tab, setTab] = useState(TAB_RUNS)
  const [createOpen, setCreateOpen] = useState(false)
  const [examplesOpen, setExamplesOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [runDialogOpen, setRunDialogOpen] = useState(false)
  const [selectedSuite, setSelectedSuite] = useState<EvaluationSuite | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [editSuiteOpen, setEditSuiteOpen] = useState(false)
  const [editSuiteTarget, setEditSuiteTarget] = useState<EvaluationSuite | null>(null)
  const [editSuiteName, setEditSuiteName] = useState('')
  const [editSuiteDesc, setEditSuiteDesc] = useState('')

  // Onboarding wizard
  const [wizardOpen, setWizardOpen] = useState(false)

  // Run comparison modal
  const [compareOpen, setCompareOpen] = useState(false)

  // Help docs modal
  const [helpOpen, setHelpOpen] = useState(false)

  // Add Suite chooser
  const [addSuiteOpen, setAddSuiteOpen] = useState(false)

  // ── Workflow + agent name lookup for the runs table ──────────────────────────
  const { data: workflowsData } = useWorkflows({ space_id: spaceId, page: 1, page_size: 200 })
  const { data: agentsData } = useAgents({ space_id: spaceId, page: 1, page_size: 200 } as any)

  const workflowNames = useMemo<Record<string, string>>(() => {
    const list = workflowsData?.data?.workflow_list ?? []
    return Object.fromEntries((list as any[]).map((w) => [w.workflow_id, w.name || w.workflow_id]))
  }, [workflowsData])

  const agentNames = useMemo<Record<string, string>>(() => {
    const list = (agentsData?.data?.agent_items as any[]) ?? []
    return Object.fromEntries(list.map((a) => [a.agent_id, a.agent_name || a.agent_id]))
  }, [agentsData])

  const targetLabel = (run: EvaluationRun) => {
    if (run.workflow_id)
      return run.workflow_name || workflowNames[run.workflow_id] || `WF: ${run.workflow_id.slice(0, 8)}…`
    if (run.agent_id)
      return run.agent_name || agentNames[run.agent_id] || `Agent: ${run.agent_id.slice(0, 8)}…`
    return '—'
  }

  // ── Effects ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchSuites()
  }, [])

  // Auto-open wizard for new users
  useEffect(() => {
    if (!loading && suites.length === 0 && !isOnboardingDone()) {
      setWizardOpen(true)
    }
  }, [loading, suites.length])

  useEffect(() => {
    if (selectedSuite) {
      // Auto-fetch runs when a suite is selected so the Runs tab is populated
      fetchRuns(selectedSuite.evaluation_id)
    }
  }, [selectedSuite])

  // Auto-refresh runs while any run is in "Running" state
  useEffect(() => {
    if (!selectedSuite) return
    const hasRunning = runs.some((r) => r.status === '1')
    if (!hasRunning) return
    const id = setInterval(() => {
      fetchRuns(selectedSuite.evaluation_id)
    }, 5000)
    return () => clearInterval(id)
  }, [runs, selectedSuite])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleCreateSuite = async () => {
    if (!newName.trim()) return
    await createSuite(newName.trim(), newDesc.trim() || undefined)
    setCreateOpen(false)
    setNewName('')
    setNewDesc('')
  }

  const handleDeleteSuite = async (suite: EvaluationSuite) => {
    if (!window.confirm(`Delete evaluation suite "${suite.suite_name}"?`)) return
    await deleteSuite(suite.evaluation_id)
    if (selectedSuite?.evaluation_id === suite.evaluation_id) setSelectedSuite(null)
  }

  const handleOpenEditSuite = (suite: EvaluationSuite, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditSuiteTarget(suite)
    setEditSuiteName(suite.suite_name)
    setEditSuiteDesc(suite.description ?? '')
    setEditSuiteOpen(true)
  }

  const handleSaveEditSuite = async () => {
    if (!editSuiteTarget || !editSuiteName.trim()) return
    await updateSuite(editSuiteTarget.evaluation_id, editSuiteName.trim(), editSuiteDesc.trim() || undefined)
    // Keep selectedSuite in sync
    if (selectedSuite?.evaluation_id === editSuiteTarget.evaluation_id) {
      setSelectedSuite((s) => s ? { ...s, suite_name: editSuiteName.trim(), description: editSuiteDesc.trim() || undefined } : s)
    }
    setEditSuiteOpen(false)
  }

  const handleDeleteRun = async (run: EvaluationRun) => {
    if (!window.confirm(`Delete this run?`)) return
    await deleteRun(run.run_id)
    if (selectedRunId === run.run_id) {
      setSelectedRunId(null)
      setTab(TAB_RUNS)
    }
  }

  const handleRunComplete = async (runId: string) => {
    setSelectedRunId(runId)
    setTab(TAB_RESULTS)
    if (selectedSuite) await fetchRuns(selectedSuite.evaluation_id)
  }

  const handleExampleCreated = (evaluationId: string, suiteName: string) => {
    fetchSuites().then(() => {
      // Newly created suite will appear in the list; user can select it
    })
  }

  const handleWizardComplete = async (newSuiteId: string, newRunId: string) => {
    await fetchSuites()
    // Auto-select the newly created suite
    const fresh = useEvaluationStore.getState().suites.find((s) => s.evaluation_id === newSuiteId)
    if (fresh) {
      setSelectedSuite(fresh)
      setSelectedRunId(newRunId)
      setTab(TAB_RESULTS)
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case '0': return 'default'
      case '1': return 'warning'
      case '2': return 'success'
      case '3': return 'error'
      default:  return 'default'
    }
  }

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      '0': 'Pending', '1': 'Running', '2': 'Completed', '3': 'Failed', '4': 'Cancelled',
    }
    return map[status] ?? status
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* ── Global toolbar ─────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1.5 }}>
        <Typography variant="h5" fontWeight={600}>Evaluation</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Tooltip title="Help & Docs">
            <IconButton size="small" onClick={() => setHelpOpen(true)}>
              <HelpCircle size={18} />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<Sparkles size={16} />}
            onClick={() => setWizardOpen(true)}
            size="small"
          >
            Quick Setup
          </Button>
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => setAddSuiteOpen(true)}
            size="small"
          >
            Add Suite
          </Button>
        </Box>
      </Box>

      {/* Divider separates global controls from suite workspace */}
      <Box component="hr" sx={{ border: 'none', borderTop: '2px solid', borderColor: 'divider', m: 0, mb: 2 }} />

      {error && <Alert severity="error" onClose={clearError} sx={{ mb: 1 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Left panel — suite list */}
        <Paper sx={{ width: 280, p: 2, overflowY: 'auto', flexShrink: 0 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Evaluation Suites
          </Typography>
          {loading && <LinearProgress />}
          {suites.length === 0 && !loading && (
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No suites yet.
              </Typography>
              <Button
                size="small" variant="text" startIcon={<Sparkles size={14} />}
                onClick={() => setExamplesOpen(true)} sx={{ mt: 1 }}
              >
                Add from Library
              </Button>
            </Box>
          )}
          {suites.map((suite) => (
            <Box
              key={suite.evaluation_id}
              onClick={() => { setSelectedSuite(suite); setSelectedRunId(null); setTab(TAB_TASKS) }}
              sx={{
                p: 1.5, mb: 1, borderRadius: 1, cursor: 'pointer',
                border: '1px solid',
                borderColor: selectedSuite?.evaluation_id === suite.evaluation_id
                  ? 'primary.main' : 'divider',
                bgcolor: selectedSuite?.evaluation_id === suite.evaluation_id
                  ? 'primary.50' : 'background.paper',
                '&:hover': { borderColor: 'primary.main' },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <Typography variant="body2" fontWeight={500} sx={{ flex: 1, wordBreak: 'break-word' }}>
                  {suite.suite_name}
                </Typography>
                <Box sx={{ display: 'flex', flexShrink: 0, ml: 0.5 }}>
                  <IconButton
                    size="small"
                    onClick={(e) => handleOpenEditSuite(suite, e)}
                    sx={{ p: 0.5 }}
                  >
                    <Edit2 size={14} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); handleDeleteSuite(suite) }}
                    sx={{ p: 0.5 }}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </Box>
              </Box>
              {suite.description && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {suite.description}
                </Typography>
              )}
            </Box>
          ))}
        </Paper>

        {/* Right panel — details */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          {!selectedSuite ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <EmptyStateGuide
                variant={suites.length === 0 ? 'no-suites' : 'no-suite-selected'}
                onBrowseExamples={() => setExamplesOpen(true)}
                onNewSuite={() => setCreateOpen(true)}
                onAddSuite={() => setAddSuiteOpen(true)}
                onTutorial={() => setWizardOpen(true)}
              />
            </Box>
          ) : (
            <>
              {/* ── Suite workspace header ───────────────────────────────────────── */}
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5, mb: 1.5, flexShrink: 0,
                  borderLeft: '4px solid',
                  borderLeftColor: 'primary.main',
                  bgcolor: 'primary.50',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="overline" color="primary.dark" sx={{ lineHeight: 1.2, display: 'block' }}>
                    Active Suite
                  </Typography>
                  <Typography variant="h6" fontWeight={700} noWrap>
                    {selectedSuite.suite_name}
                  </Typography>
                  {selectedSuite.description && (
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                      {selectedSuite.description}
                    </Typography>
                  )}
                </Box>
                <Button
                  variant="contained"
                  startIcon={<Play size={14} />}
                  size="small"
                  onClick={() => setRunDialogOpen(true)}
                  sx={{ flexShrink: 0 }}
                >
                  Run Evaluation
                </Button>
              </Paper>

              {/* Tabs: Tasks → Runs → Results */}
              <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
                <Tab label="Tasks"   icon={<ClipboardList size={14} />} iconPosition="start" />
                <Tab label="Runs"    icon={<List size={14} />}          iconPosition="start" />
                <Tab label="Results &amp; Traces" icon={<BarChart2 size={14} />} iconPosition="start" />
              </Tabs>

              {/* Tab 0 — Tasks */}
              <TabPanel value={tab} index={TAB_TASKS}>
                <TaskEditor evaluationId={selectedSuite.evaluation_id} />
              </TabPanel>

              {/* Tab 1 — Runs */}
              <TabPanel value={tab} index={TAB_RUNS}>
                {runs.length === 0 ? (
                  <EmptyStateGuide
                    variant="no-runs"
                    onRunEvaluation={() => setRunDialogOpen(true)}
                  />
                ) : null}
                {runs.length > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                  <Tooltip title={runs.filter(r => r.status === '2' && r.metrics != null).length < 2
                    ? 'Need at least 2 completed runs to compare'
                    : 'Compare two runs side by side'}>
                    <span>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<GitCompare size={14} />}
                        onClick={() => setCompareOpen(true)}
                        disabled={runs.filter(r => r.status === '2' && r.metrics != null).length < 2}
                      >
                        Compare Runs
                      </Button>
                    </span>
                  </Tooltip>
                </Box>
                )}
                {runs.length > 0 && (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Run ID</TableCell>
                        <TableCell>Target</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Success Rate</TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {runs.map((run) => (
                        <TableRow key={run.run_id}>
                          <TableCell>
                            <Typography variant="caption" fontFamily="monospace">
                              {run.run_id.slice(0, 8)}…
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">{targetLabel(run)}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={statusLabel(run.status)}
                              color={statusColor(run.status) as 'default' | 'warning' | 'success' | 'error'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {run.metrics
                                ? `${(((run.metrics as Record<string, unknown>).success_rate as number ?? 0) * 100).toFixed(1)}%`
                                : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {run.status !== '0' && (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => { setSelectedRunId(run.run_id); setTab(TAB_RESULTS) }}
                              >
                                {run.status === '1' ? 'Live Results' : 'View Results'}
                              </Button>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Delete run and results">
                              <IconButton size="small" onClick={() => handleDeleteRun(run)}>
                                <Trash2 size={14} />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                )}
              </TabPanel>

              {/* Tab 2 — Results & Traces */}
              <TabPanel value={tab} index={TAB_RESULTS}>
                {selectedRunId ? (
                  <EvaluationResults
                    runId={selectedRunId}
                    evaluationId={selectedSuite?.evaluation_id}
                    workflowNames={workflowNames}
                    agentNames={agentNames}
                  />
                ) : (
                  <Box sx={{ py: 6, textAlign: 'center' }}>
                    <BarChart2 size={32} style={{ color: '#9e9e9e', marginBottom: 8 }} />
                    <Typography variant="body2" color="text.secondary">
                      Go to the <strong>Runs</strong> tab and click <strong>View Results</strong> on any completed run.
                    </Typography>
                  </Box>
                )}
              </TabPanel>
            </>
          )}
        </Box>
      </Box>

      {/* Create Suite Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Evaluation Suite</DialogTitle>
        <DialogContent>
          <TextField
            label="Suite Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            fullWidth size="small" margin="dense" required
          />
          <TextField
            label="Description (optional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            fullWidth size="small" margin="dense" multiline rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateSuite} disabled={!newName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Run Dialog */}
      {selectedSuite && (
        <RunEvaluationDialog
          open={runDialogOpen}
          evaluationId={selectedSuite.evaluation_id}
          onClose={() => setRunDialogOpen(false)}
          onRunStarted={handleRunComplete}
        />
      )}

      {/* Add Suite Chooser */}
      <AddSuiteChooserDialog
        open={addSuiteOpen}
        onClose={() => setAddSuiteOpen(false)}
        onBrowseExamples={() => setExamplesOpen(true)}
        onBlank={() => setCreateOpen(true)}
      />

      {/* Browse Examples Dialog (unified templates + benchmarks) */}
      <BrowseExamplesDialog
        open={examplesOpen}
        onClose={() => setExamplesOpen(false)}
        onCreated={handleExampleCreated}
      />

      {/* Edit Suite Dialog */}
      <Dialog open={editSuiteOpen} onClose={() => setEditSuiteOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Evaluation Suite</DialogTitle>
        <DialogContent>
          <TextField
            label="Suite Name"
            value={editSuiteName}
            onChange={(e) => setEditSuiteName(e.target.value)}
            fullWidth size="small" margin="dense" required
          />
          <TextField
            label="Description (optional)"
            value={editSuiteDesc}
            onChange={(e) => setEditSuiteDesc(e.target.value)}
            fullWidth size="small" margin="dense" multiline rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditSuiteOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEditSuite} disabled={!editSuiteName.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Onboarding Wizard */}
      <FirstRunWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={handleWizardComplete}
        onOpenHelp={() => setHelpOpen(true)}
      />

      {/* Run Comparison Modal */}
      {selectedSuite && (
        <RunComparisonModal
          open={compareOpen}
          onClose={() => setCompareOpen(false)}
          runs={runs}
        />
      )}

      {/* Help Docs Modal */}
      <EvaluationHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

    </Box>
  )
}
