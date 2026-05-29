/**
 * FirstRunWizard — 5-step onboarding wizard for new Evaluation users.
 *
 * Triggered when:
 *   - suites.length === 0 AND localStorage 'eval_onboarding_done' !== 'true'
 *
 * Can be re-triggered:
 *   - Via the [?] Help button → "Restart Tutorial"
 *
 * Steps:
 *   1. Welcome — what is evaluation?
 *   2. Create your first suite — form (name, description)
 *   3. Add a task — pick a template from TaskTemplateSelector
 *   4. Run it — select a workflow/agent and start
 *   5. You're done — next steps & resources
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  FormControl,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material'
import {
  ArrowRight,
  BookOpen,
  CheckCircle,
  ChevronLeft,
  FlaskConical,
  List,
  Play,
  Rocket,
  Sparkles,
} from 'lucide-react'
import { useWorkflows, useAgents } from '@test-agentstudio/api-client'
import { useAuthStore } from '@/stores/useAuthStore'
import { useEvaluationStore, EvaluationTask } from '@/stores/useEvaluationStore'
import TaskTemplateSelector, { TaskTemplate } from './TaskTemplateSelector'

// ── Storage key ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'eval_onboarding_done'

export function markOnboardingDone() {
  try { localStorage.setItem(STORAGE_KEY, 'true') } catch { /* ignore */ }
}

export function isOnboardingDone(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
}

export function resetOnboarding() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

// ── Step labels ───────────────────────────────────────────────────────────────

const STEPS = ['Welcome', 'Create Suite', 'Add Task', 'Run', 'Done!']

// ── Step 1: Welcome ───────────────────────────────────────────────────────────

function StepWelcome({ onNext, onOpenHelp }: { onNext: () => void; onOpenHelp?: () => void }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, py: 2 }}>
      <Box sx={{ textAlign: 'center' }}>
        <FlaskConical size={56} style={{ color: '#1565c0', marginBottom: 12 }} />
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Welcome to Evaluation
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 460 }}>
          Evaluation lets you systematically test how well your workflows and agents perform.
          This 5-step wizard will help you run your first evaluation in under 5 minutes.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          { icon: <List size={20} />, title: 'Define Tasks', desc: 'Create test cases with inputs & expected outputs' },
          { icon: <Play size={20} />, title: 'Run Evaluation', desc: 'Execute tasks against your workflow or agent' },
          { icon: <CheckCircle size={20} />, title: 'View Results', desc: 'See pass rates, scores and identify failures' },
        ].map((item) => (
          <Paper
            key={item.title}
            variant="outlined"
            sx={{ p: 2, width: 140, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1 }}
          >
            <Box sx={{ color: 'primary.main' }}>{item.icon}</Box>
            <Typography variant="subtitle2" fontWeight={600}>{item.title}</Typography>
            <Typography variant="caption" color="text.secondary">{item.desc}</Typography>
          </Paper>
        ))}
      </Box>

      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'primary.50', maxWidth: 480, width: '100%' }}>
        <Typography variant="caption" color="primary.dark">
          <strong>What you'll build in this tutorial:</strong><br />
          A basic evaluation suite with one task that tests your agent. You'll understand
          the core concepts and be ready to build more complex evaluations on your own.
        </Typography>
      </Paper>

      <Button variant="contained" size="large" endIcon={<ArrowRight size={16} />} onClick={onNext}>
        Let's Get Started
      </Button>

      {onOpenHelp && (
        <Paper
          variant="outlined"
          sx={{
            p: 1.5, maxWidth: 480, width: '100%',
            borderColor: 'primary.light',
            bgcolor: 'primary.50',
            display: 'flex', alignItems: 'center', gap: 1.5,
          }}
        >
          <BookOpen size={20} style={{ color: '#1565c0', flexShrink: 0 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" fontWeight={600} color="primary.dark">
              New to Evaluation?
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Read the User Guide before getting started to understand key concepts.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={onOpenHelp}
            sx={{ flexShrink: 0 }}
          >
            Open Guide
          </Button>
        </Paper>
      )}
    </Box>
  )
}

// ── Step 2: Create Suite ──────────────────────────────────────────────────────

interface StepCreateSuiteProps {
  onNext: (suiteId: string) => void
  onBack: () => void
}

function StepCreateSuite({ onNext, onBack }: StepCreateSuiteProps) {
  const { createSuite, loading, error, clearError } = useEvaluationStore()
  const [name, setName] = useState('My First Evaluation Suite')
  const [desc, setDesc] = useState('')

  const handleCreate = async () => {
    clearError()
    const result = await createSuite(name.trim(), desc.trim() || undefined)
    // createSuite calls fetchSuites() internally before returning, so the
    // store's suites list is already up-to-date when we reach this point.
    // We don't rely on `result` being truthy (the backend may return null data)
    // — instead we read the newest suite directly from store state.
    const stateAfter = useEvaluationStore.getState()
    if (stateAfter.error) return  // error is already shown in the UI Alert

    // Prefer the ID from the return value; fall back to the most-recently-created suite.
    const suiteId =
      (result as { evaluation_id?: string } | null | undefined)?.evaluation_id ??
      stateAfter.suites
        .slice()
        .sort((a, b) => b.create_time - a.create_time)[0]?.evaluation_id

    if (suiteId) {
      onNext(suiteId)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Create your first suite
        </Typography>
        <Typography variant="body2" color="text.secondary">
          A suite groups related evaluation tasks together. Think of it as a test suite
          in unit testing — it holds all the tests for one feature or use case.
        </Typography>
      </Box>

      {error && <Alert severity="error" onClose={clearError}>{error}</Alert>}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Suite Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          required
          size="small"
          helperText='Example: "Customer Support Quality", "Calculator Tests", "RAG Accuracy"'
        />
        <TextField
          label="Description (optional)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          fullWidth
          multiline
          rows={2}
          size="small"
          helperText="What does this suite test? This helps team members understand the purpose."
        />
      </Box>

      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
        <Typography variant="caption" color="text.secondary">
          <strong>Tip:</strong> Name your suite after the feature or workflow it tests, not the
          test type. "Customer Support Routing" is better than "Grader Tests".
        </Typography>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button startIcon={<ChevronLeft size={16} />} onClick={onBack}>Back</Button>
        <Button
          variant="contained"
          endIcon={loading ? <CircularProgress size={14} color="inherit" /> : <ArrowRight size={16} />}
          onClick={handleCreate}
          disabled={!name.trim() || loading}
        >
          {loading ? 'Creating…' : 'Create Suite'}
        </Button>
      </Box>
    </Box>
  )
}

// ── Step 3: Add Task ──────────────────────────────────────────────────────────

interface StepAddTaskProps {
  suiteId: string
  onNext: () => void
  onBack: () => void
}

function StepAddTask({ suiteId, onNext, onBack }: StepAddTaskProps) {
  const { addTask, loading, error, clearError } = useEvaluationStore()
  const [templateOpen, setTemplateOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null)
  const [taskName, setTaskName] = useState('')
  const [inputJson, setInputJson] = useState('{}')
  const [jsonError, setJsonError] = useState('')

  const handleTemplateSelect = (t: TaskTemplate) => {
    setSelectedTemplate(t)
    setTaskName(t.name)
    setInputJson(t.inputJson)
    setJsonError('')
  }

  const validateJson = (val: string) => {
    try { JSON.parse(val); setJsonError(''); return true }
    catch { setJsonError('Invalid JSON'); return false }
  }

  const handleAdd = async () => {
    if (!selectedTemplate) return
    if (!validateJson(inputJson)) return
    clearError()

    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const payload: EvaluationTask = {
      task_id: taskId,
      evaluation_id: suiteId,
      task_name: taskName.trim() || selectedTemplate.name,
      description: selectedTemplate.description,
      trials: selectedTemplate.trials,
      pattern_type: selectedTemplate.patternType || undefined,
      input_data: JSON.parse(inputJson),
      expected_output: JSON.parse(selectedTemplate.expectedJson),
      graders_config: JSON.parse(selectedTemplate.gradersJson),
      create_time: Date.now(),
    }

    await addTask(suiteId, payload)
    onNext()
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Add your first task
        </Typography>
        <Typography variant="body2" color="text.secondary">
          A task is one test case. It defines what input to send to your agent,
          what you expect back, and how to grade the response.
        </Typography>
      </Box>

      {error && <Alert severity="error" onClose={clearError}>{error}</Alert>}

      {!selectedTemplate ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 2 }}>
          <Typography variant="body2" color="text.secondary">
            The easiest way to start is with a pre-built template:
          </Typography>
          <Button
            variant="contained"
            startIcon={<Sparkles size={16} />}
            onClick={() => setTemplateOpen(true)}
            size="large"
          >
            Choose a Task Template
          </Button>
          <Typography variant="caption" color="text.secondary">
            Templates come pre-configured with graders — you just adjust the input.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircle size={16} style={{ color: '#2e7d32' }} />
            <Typography variant="body2" color="success.main" fontWeight={600}>
              Template selected: {selectedTemplate.name}
            </Typography>
            <Button size="small" variant="text" onClick={() => setTemplateOpen(true)}>Change</Button>
          </Box>

          <TextField
            label="Task Name"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            fullWidth
            size="small"
          />

          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
              Input Data (JSON) — edit to match your agent's input
            </Typography>
            <TextField
              value={inputJson}
              onChange={(e) => { setInputJson(e.target.value); validateJson(e.target.value) }}
              multiline
              rows={5}
              fullWidth
              size="small"
              error={!!jsonError}
              helperText={jsonError || 'This is what your agent will receive as input.'}
              inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.75rem' } }}
            />
          </Box>

          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
            <Typography variant="caption" color="text.secondary">
              <strong>Graders:</strong>{' '}
              {JSON.parse(selectedTemplate.gradersJson)
                .map((g: Record<string, unknown>) => g.name as string)
                .join(' · ')}
            </Typography>
          </Paper>
        </Box>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button startIcon={<ChevronLeft size={16} />} onClick={onBack}>Back</Button>
        <Button
          variant="contained"
          endIcon={loading ? <CircularProgress size={14} color="inherit" /> : <ArrowRight size={16} />}
          onClick={handleAdd}
          disabled={!selectedTemplate || loading}
        >
          {loading ? 'Adding…' : 'Add Task'}
        </Button>
      </Box>

      <TaskTemplateSelector
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        onSelect={handleTemplateSelect}
      />
    </Box>
  )
}

// ── Step 4: Run ───────────────────────────────────────────────────────────────

interface StepRunProps {
  suiteId: string
  onNext: (runId: string) => void
  onBack: () => void
}

function StepRun({ suiteId, onNext, onBack }: StepRunProps) {
  const { startRun, loading, error, clearError } = useEvaluationStore()
  const spaceId = useAuthStore((s) => s.user?.spaceId) || ''

  const [targetType, setTargetType] = useState<'workflow' | 'agent'>('workflow')
  const [selectedId, setSelectedId] = useState('')

  const { data: workflowsResponse, isFetching: wfLoading } = useWorkflows({ space_id: spaceId, page: 1, page_size: 100 })
  const { data: agentsResponse, isFetching: agLoading } = useAgents({ space_id: spaceId, page: 1, page_size: 100 } as any)

  const workflows = workflowsResponse?.data?.workflow_list ?? []
  const agents = (agentsResponse?.data?.agent_items as any[]) ?? []
  const listLoading = targetType === 'workflow' ? wfLoading : agLoading
  const items = targetType === 'workflow'
    ? (workflows as any[]).map((w) => ({ id: w.workflow_id, label: w.name || w.workflow_id }))
    : (agents as any[]).map((a) => ({ id: a.agent_id, label: a.agent_name || a.agent_id }))

  const handleRun = async () => {
    clearError()
    const selectedItem = items.find((i) => i.id === selectedId)
    const runId = await startRun({
      evaluationId: suiteId,
      workflowId: targetType === 'workflow' ? selectedId : undefined,
      workflowVersion: targetType === 'workflow' ? 'draft' : undefined,
      workflowName: targetType === 'workflow' ? selectedItem?.label : undefined,
      agentId: targetType === 'agent' ? selectedId : undefined,
      agentVersion: targetType === 'agent' ? 'draft' : undefined,
      agentName: targetType === 'agent' ? selectedItem?.label : undefined,
      parallel: false,
    })
    if (runId) onNext(runId)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Run your first evaluation
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Select the workflow or agent to test. The evaluation runner will send each task's
          input to your target and collect the response for grading.
        </Typography>
      </Box>

      {error && <Alert severity="error" onClose={clearError}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 2 }}>
        {(['workflow', 'agent'] as const).map((type) => (
          <Paper
            key={type}
            variant="outlined"
            onClick={() => { setTargetType(type); setSelectedId('') }}
            sx={{
              flex: 1, p: 2, cursor: 'pointer', textAlign: 'center',
              borderColor: targetType === type ? 'primary.main' : 'divider',
              bgcolor: targetType === type ? 'primary.50' : 'background.paper',
              '&:hover': { borderColor: 'primary.main' },
            }}
          >
            <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>
              {type}
            </Typography>
          </Paper>
        ))}
      </Box>

      <FormControl fullWidth size="small">
        <Select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={listLoading}
          displayEmpty
        >
          <MenuItem value="" disabled>
            {listLoading ? 'Loading…' : `Select a ${targetType}…`}
          </MenuItem>
          {items.map((item) => (
            <MenuItem key={item.id} value={item.id}>{item.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {items.length === 0 && !listLoading && (
        <Alert severity="info">
          No {targetType}s found in this space. Make sure you've created a {targetType} first.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'info.50' }}>
        <Typography variant="caption" color="info.dark">
          <strong>What happens next:</strong> The runner will execute your task against the
          selected {targetType}, apply the graders, and calculate a success rate.
          This may take 10–60 seconds depending on your agent's response time.
        </Typography>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button startIcon={<ChevronLeft size={16} />} onClick={onBack}>Back</Button>
        <Button
          variant="contained"
          color="success"
          endIcon={loading ? <CircularProgress size={14} color="inherit" /> : <Play size={16} />}
          onClick={handleRun}
          disabled={!selectedId || loading}
        >
          {loading ? 'Starting…' : 'Start Evaluation'}
        </Button>
      </Box>
    </Box>
  )
}

// ── Step 5: Done ──────────────────────────────────────────────────────────────

interface StepDoneProps {
  suiteId: string
  runId: string
  onFinish: () => void
  onGoToResults: () => void
}

function StepDone({ suiteId, runId, onFinish, onGoToResults }: StepDoneProps) {
  const { fetchRuns, runs } = useEvaluationStore()
  const [polling, setPolling] = useState(true)

  useEffect(() => {
    fetchRuns(suiteId)
    const id = setInterval(() => {
      fetchRuns(suiteId)
    }, 4000)
    return () => clearInterval(id)
  }, [suiteId])

  const run = runs.find((r) => r.run_id === runId)
  const isRunning = run?.status === '0' || run?.status === '1'
  const isComplete = run?.status === '2'
  const isFailed = run?.status === '3'

  useEffect(() => {
    if (isComplete || isFailed) setPolling(false)
  }, [isComplete, isFailed])

  const successRate = run?.metrics
    ? (((run.metrics as Record<string, unknown>).success_rate as number) ?? 0) * 100
    : null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ textAlign: 'center' }}>
        <Rocket size={52} style={{ color: '#1565c0', marginBottom: 12 }} />
        <Typography variant="h5" fontWeight={700} gutterBottom>
          {isRunning ? 'Evaluation Running…' : isComplete ? 'Evaluation Complete!' : 'Run Submitted!'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {isRunning
            ? 'Your agent is being tested. Results will appear when the run finishes.'
            : isComplete
            ? 'Your first evaluation is done. Here\'s a summary of what you\'ve built.'
            : 'The evaluation was submitted successfully.'}
        </Typography>
      </Box>

      {(isRunning || polling) && <LinearProgress />}

      {isComplete && successRate !== null && (
        <Paper
          variant="outlined"
          sx={{
            p: 3, textAlign: 'center',
            borderColor: successRate >= 80 ? 'success.main' : successRate >= 50 ? 'warning.main' : 'error.main',
            bgcolor: successRate >= 80 ? 'success.50' : successRate >= 50 ? 'warning.50' : 'error.50',
          }}
        >
          <Typography variant="h4" fontWeight={700}
            color={successRate >= 80 ? 'success.main' : successRate >= 50 ? 'warning.main' : 'error.main'}
          >
            {successRate.toFixed(1)}%
          </Typography>
          <Typography variant="body2" color="text.secondary">Success Rate</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {successRate >= 80
              ? '✅ Excellent! Your agent is performing well on this task.'
              : successRate >= 50
              ? '⚠️ Fair. Some tasks are failing — check the Traces tab to see why.'
              : '❌ Below 50%. The agent may not be handling this type of input yet.'}
          </Typography>
        </Paper>
      )}

      <Divider />

      <Box>
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
          What to do next:
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<BookOpen size={16} />}
            fullWidth
            onClick={onGoToResults}
          >
            View Full Results & Traces
          </Button>
          <Button
            variant="text"
            size="small"
            fullWidth
            href="https://github.com/anthropics/claude-code"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read the Cookbook (20 recipes) →
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
        {[
          { label: 'Add more tasks', desc: 'Cover more edge cases' },
          { label: 'Try different graders', desc: 'Model-based, code-based' },
          { label: 'Load a benchmark', desc: 'Pre-built test suites' },
        ].map((item) => (
          <Chip key={item.label} label={item.label} variant="outlined" size="small" />
        ))}
      </Box>

      <Button variant="contained" size="large" onClick={onFinish} startIcon={<CheckCircle size={16} />}>
        Go to Evaluation Dashboard
      </Button>
    </Box>
  )
}

// ── Main Wizard ───────────────────────────────────────────────────────────────

interface FirstRunWizardProps {
  open: boolean
  onClose: () => void
  /** Called when wizard completes — parent should select the new suite + run */
  onComplete: (suiteId: string, runId: string) => void
  /** Optional: open the help/docs modal from the welcome step */
  onOpenHelp?: () => void
}

export default function FirstRunWizard({ open, onClose, onComplete, onOpenHelp }: FirstRunWizardProps) {
  const [step, setStep] = useState(0)
  const [suiteId, setSuiteId] = useState('')
  const [runId, setRunId] = useState('')

  const handleClose = () => {
    markOnboardingDone()
    onClose()
  }

  const handleFinish = () => {
    markOnboardingDone()
    onComplete(suiteId, runId)
    onClose()
  }

  const handleGoToResults = () => {
    markOnboardingDone()
    onComplete(suiteId, runId)
    onClose()
  }

  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1))
  const goBack = () => setStep((s) => Math.max(s - 1, 0))

  // Reset when reopened
  useEffect(() => {
    if (open) { setStep(0); setSuiteId(''); setRunId('') }
  }, [open])

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      {/* Progress stepper */}
      <Box sx={{ px: 3, pt: 3, pb: 1 }}>
        <Stepper activeStep={step} alternativeLabel>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      <DialogContent sx={{ px: 4, py: 3 }}>
        {step === 0 && <StepWelcome onNext={goNext} onOpenHelp={onOpenHelp} />}
        {step === 1 && (
          <StepCreateSuite
            onNext={(id) => { setSuiteId(id); goNext() }}
            onBack={goBack}
          />
        )}
        {step === 2 && suiteId && (
          <StepAddTask
            suiteId={suiteId}
            onNext={goNext}
            onBack={goBack}
          />
        )}
        {step === 3 && suiteId && (
          <StepRun
            suiteId={suiteId}
            onNext={(id) => { setRunId(id); goNext() }}
            onBack={goBack}
          />
        )}
        {step === 4 && suiteId && runId && (
          <StepDone
            suiteId={suiteId}
            runId={runId}
            onFinish={handleFinish}
            onGoToResults={handleGoToResults}
          />
        )}
      </DialogContent>

      {/* Skip link */}
      <Box sx={{ px: 4, pb: 2, textAlign: 'center' }}>
        <Button size="small" color="inherit" onClick={handleClose} sx={{ color: 'text.disabled', fontSize: '0.75rem' }}>
          Skip tutorial
        </Button>
      </Box>
    </Dialog>
  )
}
