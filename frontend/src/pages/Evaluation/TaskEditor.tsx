import React, { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  LinearProgress,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, FileText, Zap } from 'lucide-react'
import { useEvaluationStore, EvaluationTask } from '@/stores/useEvaluationStore'
import InfoTooltip from './InfoTooltip'
import TaskTemplateSelector, { TaskTemplate } from './TaskTemplateSelector'
import GraderWizard, { GraderConfig } from './GraderWizard'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PATTERN_LABELS: Record<string, string> = {
  '0': 'Routing',
  '1': 'Chaining',
  '2': 'Parallelization',
  '3': 'Orchestrator-Worker',
  '4': 'Evaluator-Optimizer',
  '5': 'Memory Usage',
}

function generateTaskId(): string {
  // Short, human-readable ID: task_<timestamp>_<random>
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

// ─── TaskRow ──────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: EvaluationTask
  onEdit: () => void
  onDelete: () => void
}

function TaskRow({ task, onEdit, onDelete }: TaskRowProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 1 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2, py: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' },
        }}
        onClick={() => setExpanded((e) => !e)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={500} noWrap>{task.task_name}</Typography>
          {/* Support both new pattern_types array and legacy pattern_type string */}
          {(task.pattern_types ?? (task.pattern_type != null ? [String(task.pattern_type)] : [])).map((pt) => (
            <Chip
              key={pt}
              label={PATTERN_LABELS[pt] ?? pt}
              size="small" color="primary" variant="outlined"
            />
          ))}

          <Typography variant="caption" color="text.secondary" noWrap>
            {task.trials} trial{task.trials !== 1 ? 's' : ''}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="Edit task">
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onEdit() }}
            >
              <Edit2 size={14} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete task">
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onDelete() }}
            >
              <Trash2 size={14} />
            </IconButton>
          </Tooltip>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Box>
      </Box>

      {/* Expanded details */}
      {expanded && (
        <Box sx={{ px: 2, pb: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          {task.description && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              {task.description}
            </Typography>
          )}
          {task.input_data && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>Input</Typography>
              <Box
                component="pre"
                sx={{
                  mt: 0.5, p: 1, bgcolor: 'grey.50', borderRadius: 1,
                  fontSize: '0.7rem', overflowX: 'auto', maxHeight: 120, overflowY: 'auto',
                  border: '1px solid', borderColor: 'divider',
                }}
              >
                {JSON.stringify(task.input_data, null, 2)}
              </Box>
            </Box>
          )}
          {task.expected_output && Object.keys(task.expected_output).length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>Expected Output</Typography>
              <Box
                component="pre"
                sx={{
                  mt: 0.5, p: 1, bgcolor: 'grey.50', borderRadius: 1,
                  fontSize: '0.7rem', overflowX: 'auto', maxHeight: 120, overflowY: 'auto',
                  border: '1px solid', borderColor: 'divider',
                }}
              >
                {JSON.stringify(task.expected_output, null, 2)}
              </Box>
            </Box>
          )}
          {task.graders_config && task.graders_config.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Graders ({task.graders_config.length})
              </Typography>
              {task.graders_config.map((g, i) => (
                <Chip
                  key={i}
                  label={(g.name as string) ?? `grader_${i}`}
                  size="small"
                  sx={{ mr: 0.5, mt: 0.5 }}
                />
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}

// ─── TaskFormDialog (create + edit) ───────────────────────────────────────────

interface TaskFormDialogProps {
  open: boolean
  evaluationId: string
  /** When provided, the dialog operates in edit mode pre-populated with this task. */
  initialTask?: EvaluationTask | null
  onClose: () => void
  onSaved: () => void
}

function TaskFormDialog({ open, evaluationId, initialTask, onClose, onSaved }: TaskFormDialogProps) {
  const { addTask, updateTask, loading } = useEvaluationStore()
  const isEdit = !!initialTask

  const [taskName, setTaskName]       = useState('')
  const [description, setDescription] = useState('')
  const [patternTypes, setPatternTypes] = useState<string[]>([])
  const [trials, setTrials]           = useState('3')
  const [inputJson, setInputJson]     = useState('{}')
  const [expectedJson, setExpectedJson] = useState('{}')
  const [gradersJson, setGradersJson] = useState('[]')
  const [jsonErrors, setJsonErrors]   = useState<Record<string, string>>({})

  // Pre-populate fields when editing
  useEffect(() => {
    if (open && initialTask) {
      setTaskName(initialTask.task_name)
      setDescription(initialTask.description ?? '')
      // Support both new pattern_types array and legacy pattern_type string
      setPatternTypes(
        Array.isArray(initialTask.pattern_types) && initialTask.pattern_types.length > 0
          ? initialTask.pattern_types
          : initialTask.pattern_type != null ? [String(initialTask.pattern_type)] : []
      )
      setTrials(String(initialTask.trials ?? 3))
      setInputJson(JSON.stringify(initialTask.input_data ?? {}, null, 2))
      setExpectedJson(JSON.stringify(initialTask.expected_output ?? {}, null, 2))
      setGradersJson(JSON.stringify(initialTask.graders_config ?? [], null, 2))
    } else if (open && !initialTask) {
      reset()
    }
  }, [open, initialTask])

  const validateJson = (key: string, val: string): boolean => {
    try {
      JSON.parse(val)
      setJsonErrors((e) => { const n = { ...e }; delete n[key]; return n })
      return true
    } catch {
      setJsonErrors((e) => ({ ...e, [key]: 'Invalid JSON' }))
      return false
    }
  }

  const handleSubmit = async () => {
    const inputOk = validateJson('input', inputJson)
    const expOk   = validateJson('expected', expectedJson)
    const gradOk  = validateJson('graders', gradersJson)
    if (!inputOk || !expOk || !gradOk || !taskName.trim()) return

    // Reuse existing task_id when editing; generate a new one when creating
    const taskId = isEdit ? initialTask!.task_id : generateTaskId()

    const taskPayload = {
      task_id:         taskId,
      task_name:       taskName.trim(),
      description:     description.trim() || undefined,
      pattern_types:   patternTypes.length > 0 ? patternTypes : undefined,
      trials:          parseInt(trials) || 1,
      input_data:      JSON.parse(inputJson),
      expected_output: JSON.parse(expectedJson),
      graders_config:  JSON.parse(gradersJson),
    }

    if (isEdit) {
      await updateTask(evaluationId, taskPayload)
    } else {
      await addTask(evaluationId, taskPayload)
    }
    onSaved()
    onClose()
  }

  const reset = () => {
    setTaskName(''); setDescription(''); setPatternTypes([])
    setTrials('3'); setInputJson('{}')
    setExpectedJson('{}'); setGradersJson('[]'); setJsonErrors({})
  }

  const handleClose = () => { if (!isEdit) reset(); onClose() }

  const [templateOpen, setTemplateOpen] = useState(false)
  const [graderWizardOpen, setGraderWizardOpen] = useState(false)

  const handleGraderSave = (config: GraderConfig) => {
    try {
      const existing = JSON.parse(gradersJson)
      const updated = Array.isArray(existing) ? [...existing, config] : [config]
      setGradersJson(JSON.stringify(updated, null, 2))
      setJsonErrors((e) => { const n = { ...e }; delete n.graders; return n })
    } catch {
      setGradersJson(JSON.stringify([config], null, 2))
    }
  }

  const handleTemplateSelect = (t: TaskTemplate) => {
    setTaskName(t.name)
    setDescription(t.description)
    setPatternTypes(t.patternType ? [t.patternType] : [])
    setTrials(String(t.trials))
    setInputJson(t.inputJson)
    setExpectedJson(t.expectedJson)
    setGradersJson(t.gradersJson)
    setJsonErrors({})
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{isEdit ? 'Edit Task' : 'Add Evaluation Task'}</span>
          {!isEdit && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<FileText size={13} />}
              onClick={() => setTemplateOpen(true)}
              sx={{ fontWeight: 400, fontSize: '0.75rem' }}
            >
              From Template
            </Button>
          )}
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <TextField
            label="Task Name" value={taskName} onChange={(e) => setTaskName(e.target.value)}
            size="small" required sx={{ gridColumn: '1 / -1' }}
          />
          <TextField
            label="Description" value={description} onChange={(e) => setDescription(e.target.value)}
            size="small" multiline rows={2} sx={{ gridColumn: '1 / -1' }}
          />
          <Box sx={{ gridColumn: '1 / -1' }}>
            <InfoTooltip helpKey="TRIALS" label="Trials" sx={{ mb: 0.5 }} />
            <TextField
              value={trials} onChange={(e) => setTrials(e.target.value)}
              size="small" type="number" sx={{ width: 100 }} inputProps={{ min: 1, max: 20 }}
            />
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          {/* Row 1: Input + Expected Output */}
          <Box>
            <InfoTooltip helpKey="INPUT_DATA" label="Input Data (JSON)" sx={{ mb: 0.5, '& .MuiTypography-root': { fontWeight: 600 } }} />
            <TextField
              value={inputJson}
              onChange={(e) => { setInputJson(e.target.value); validateJson('input', e.target.value) }}
              multiline rows={8} fullWidth size="small" sx={{ mt: 0.5 }}
              error={!!jsonErrors.input} helperText={jsonErrors.input}
              inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.75rem' } }}
            />
          </Box>
          <Box>
            <InfoTooltip helpKey="EXPECTED_OUTPUT" label="Expected Output (JSON)" sx={{ mb: 0.5, '& .MuiTypography-root': { fontWeight: 600 } }} />
            <TextField
              value={expectedJson}
              onChange={(e) => { setExpectedJson(e.target.value); validateJson('expected', e.target.value) }}
              multiline rows={8} fullWidth size="small" sx={{ mt: 0.5 }}
              error={!!jsonErrors.expected} helperText={jsonErrors.expected}
              inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.75rem' } }}
            />
          </Box>

          {/* Row 2: Graders + Pattern Checks */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
              <InfoTooltip helpKey="GRADERS_CONFIG" label="Graders Config (JSON array)" sx={{ '& .MuiTypography-root': { fontWeight: 600 } }} />
              <Button
                size="small"
                variant="outlined"
                startIcon={<Zap size={12} />}
                onClick={() => setGraderWizardOpen(true)}
                sx={{ fontSize: '0.7rem', py: 0.25, px: 1 }}
              >
                Add Grader
              </Button>
            </Box>
            <TextField
              value={gradersJson}
              onChange={(e) => { setGradersJson(e.target.value); validateJson('graders', e.target.value) }}
              multiline rows={8} fullWidth size="small"
              error={!!jsonErrors.graders} helperText={jsonErrors.graders ?? 'Edit JSON directly or use "Add Grader" above'}
              inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.75rem' } }}
            />
          </Box>
          <Box>
            <InfoTooltip helpKey="PATTERN_TYPE" label="Pattern Checks" sx={{ mb: 0.25, '& .MuiTypography-root': { fontWeight: 600 } }} />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Each checked pattern is validated against the execution trace and adds a pass/fail result alongside your graders.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
              {Object.entries(PATTERN_LABELS).map(([v, label]) => (
                <FormControlLabel
                  key={v}
                  control={
                    <Checkbox
                      size="small"
                      checked={patternTypes.includes(v)}
                      onChange={(e) =>
                        setPatternTypes((prev) =>
                          e.target.checked ? [...prev, v] : prev.filter((p) => p !== v)
                        )
                      }
                      sx={{ py: 0.25 }}
                    />
                  }
                  label={<Typography variant="caption">{label}</Typography>}
                  sx={{ mx: 0 }}
                />
              ))}
            </Box>
          </Box>
        </Box>
      </DialogContent>
      {loading && <LinearProgress />}
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !taskName.trim()}
        >
          {isEdit ? 'Save Changes' : 'Add Task'}
        </Button>
      </DialogActions>

      <GraderWizard
        open={graderWizardOpen}
        onClose={() => setGraderWizardOpen(false)}
        onSave={handleGraderSave}
      />

      <TaskTemplateSelector
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        onSelect={handleTemplateSelect}
      />
    </Dialog>
  )
}

// ─── TaskEditor (main export) ─────────────────────────────────────────────────

interface TaskEditorProps {
  evaluationId: string
}

export default function TaskEditor({ evaluationId }: TaskEditorProps) {
  const { tasks, loading, fetchTasks, deleteTask } = useEvaluationStore()
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<EvaluationTask | null>(null)

  useEffect(() => {
    if (evaluationId) fetchTasks(evaluationId)
  }, [evaluationId])

  const handleOpenCreate = () => {
    setEditingTask(null)
    setFormOpen(true)
  }

  const handleOpenEdit = (task: EvaluationTask) => {
    setEditingTask(task)
    setFormOpen(true)
  }

  const handleDelete = async (taskId: string, taskName: string) => {
    if (!window.confirm(`Delete task "${taskName}"?`)) return
    await deleteTask(evaluationId, taskId)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">
          Tasks ({tasks.length})
        </Typography>
        <Button
          variant="outlined" size="small" startIcon={<Plus size={14} />}
          onClick={handleOpenCreate}
        >
          Add Task
        </Button>
      </Box>

      {loading && <LinearProgress sx={{ mb: 1 }} />}

      {tasks.length === 0 && !loading && (
        <Box
          sx={{
            py: 4, textAlign: 'center', border: '1px dashed',
            borderColor: 'divider', borderRadius: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            No tasks defined. Add tasks to this evaluation suite.
          </Typography>
          <Button
            variant="text" size="small" startIcon={<Plus size={14} />}
            onClick={handleOpenCreate} sx={{ mt: 1 }}
          >
            Add First Task
          </Button>
        </Box>
      )}

      {tasks.map((task) => (
        <TaskRow
          key={task.task_id}
          task={task}
          onEdit={() => handleOpenEdit(task)}
          onDelete={() => handleDelete(task.task_id, task.task_name)}
        />
      ))}

      <TaskFormDialog
        open={formOpen}
        evaluationId={evaluationId}
        initialTask={editingTask}
        onClose={() => setFormOpen(false)}
        onSaved={() => fetchTasks(evaluationId)}
      />
    </Box>
  )
}
