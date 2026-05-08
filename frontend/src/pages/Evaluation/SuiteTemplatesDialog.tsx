import React, { useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { CheckCircle, FlaskConical, GitBranch, Repeat, Star } from 'lucide-react'
import { useEvaluationStore, EvaluationTask } from '@/stores/useEvaluationStore'

// ─── Template definitions ─────────────────────────────────────────────────────

type TemplateTask = Omit<EvaluationTask, 'create_time' | 'evaluation_id'>

interface SuiteTemplate {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  tags: string[]
  tasks: TemplateTask[]
}

const TEMPLATES: SuiteTemplate[] = [
  {
    id: 'llm-quality',
    name: 'LLM Response Quality',
    description: 'Evaluate text output quality using model-based rubric graders. Good starting point for any generative workflow.',
    icon: <Star size={22} />,
    tags: ['model-based', 'scoring'],
    tasks: [
      {
        task_id: 'llm-quality-task-1',
        task_name: 'Coherent factual answer',
        description: 'The response should be factually accurate and coherent.',
        trials: 1,
        input_data: { query: 'What is the capital of France?' },
        expected_output: { answer: 'Paris' },
        graders_config: [
          {
            grader_type: 1,
            name: 'factual_accuracy',
            weight: 1.0,
            config: {
              model_id: 'gpt-4o-mini',
              rubric: 'Score 1.0 if the answer correctly states Paris as the capital of France. Score 0.0 otherwise.',
            },
          },
        ],
      },
      {
        task_id: 'llm-quality-task-2',
        task_name: 'Tone and relevance check',
        description: 'Response must be relevant and professionally toned.',
        trials: 1,
        input_data: { query: 'Explain the concept of recursion in programming.' },
        expected_output: {},
        graders_config: [
          {
            grader_type: 1,
            name: 'relevance_and_tone',
            weight: 1.0,
            config: {
              model_id: 'gpt-4o-mini',
              assertions: [
                'The response explains recursion accurately',
                'The response uses a clear example',
                'The tone is professional and educational',
              ],
            },
          },
        ],
      },
    ],
  },
  {
    id: 'tool-use',
    name: 'Tool Use Verification',
    description: 'Verify that the agent calls the correct tools with the correct arguments. Uses deterministic graders.',
    icon: <FlaskConical size={22} />,
    tags: ['deterministic', 'tool-calls'],
    tasks: [
      {
        task_id: 'tool-use-task-1',
        task_name: 'Search tool invocation',
        description: 'Agent should call the search tool when asked a factual question.',
        trials: 1,
        input_data: { user_message: 'Find the latest news about AI.' },
        expected_output: {},
        graders_config: [
          {
            grader_type: 0,
            name: 'search_tool_called',
            weight: 1.0,
            config: {
              check_type: 'tool_call_check',
              expected_tools: ['search', 'web_search'],
            },
          },
        ],
      },
      {
        task_id: 'tool-use-task-2',
        task_name: 'Calculator tool for arithmetic',
        description: 'Agent should use the calculator tool for math questions.',
        trials: 1,
        input_data: { user_message: 'What is 142 multiplied by 37?' },
        expected_output: { result: 5254 },
        graders_config: [
          {
            grader_type: 0,
            name: 'calculator_called',
            weight: 0.5,
            config: {
              check_type: 'tool_call_check',
              expected_tools: ['calculator', 'compute'],
            },
          },
          {
            grader_type: 0,
            name: 'correct_result',
            weight: 0.5,
            config: {
              check_type: 'output_check',
              expected_value: 5254,
              path: 'result',
              condition: 'eq',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'routing',
    name: 'Routing Accuracy',
    description: 'Test conditional branching: does the workflow route inputs to the correct branch? Uses state_check graders.',
    icon: <GitBranch size={22} />,
    tags: ['routing', 'deterministic', 'branching'],
    tasks: [
      {
        task_id: 'routing-task-1',
        task_name: 'Positive sentiment → positive branch',
        description: 'A positive input should route to the positive-handling branch.',
        trials: 1,
        input_data: { message: 'I love this product, it is amazing!' },
        expected_output: { branch: 'positive' },
        graders_config: [
          {
            grader_type: 0,
            name: 'correct_branch',
            weight: 1.0,
            config: {
              check_type: 'state_check',
              path: 'branch',
              expected_value: 'positive',
              condition: 'eq',
            },
          },
        ],
      },
      {
        task_id: 'routing-task-2',
        task_name: 'Negative sentiment → escalation branch',
        description: 'A negative complaint should be routed to the escalation branch.',
        trials: 1,
        input_data: { message: 'This is terrible, I want a refund immediately.' },
        expected_output: { branch: 'escalate' },
        graders_config: [
          {
            grader_type: 0,
            name: 'correct_branch',
            weight: 1.0,
            config: {
              check_type: 'state_check',
              path: 'branch',
              expected_value: 'escalate',
              condition: 'eq',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'reliability',
    name: 'Reliability Sampling',
    description: 'Each task runs 3 trials to measure consistency. Reveals flakiness and score variance in non-deterministic workflows.',
    icon: <Repeat size={22} />,
    tags: ['multi-trial', 'reliability', 'flakiness'],
    tasks: [
      {
        task_id: 'reliability-task-1',
        task_name: 'Consistent summarisation',
        description: 'Run 3 times — the summary should always be accurate and concise.',
        trials: 3,
        input_data: {
          text: 'The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. It is named after the engineer Gustave Eiffel, whose company designed and built the tower from 1887 to 1889.',
        },
        expected_output: {},
        graders_config: [
          {
            grader_type: 1,
            name: 'summary_quality',
            weight: 1.0,
            config: {
              model_id: 'gpt-4o-mini',
              assertions: [
                'The summary mentions the Eiffel Tower',
                'The summary mentions Paris or France',
                'The summary is shorter than the source text',
              ],
            },
          },
        ],
      },
      {
        task_id: 'reliability-task-2',
        task_name: 'Deterministic classification',
        description: 'Run 3 times — the category label should be identical each time.',
        trials: 3,
        input_data: { text: 'The stock market fell sharply today amid inflation concerns.' },
        expected_output: { category: 'finance' },
        graders_config: [
          {
            grader_type: 0,
            name: 'correct_category',
            weight: 1.0,
            config: {
              check_type: 'state_check',
              path: 'category',
              expected_value: 'finance',
              condition: 'eq',
            },
          },
        ],
      },
    ],
  },
]

// ─── Dialog ───────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (evaluationId: string, suiteName: string) => void
}

export default function SuiteTemplatesDialog({ open, onClose, onCreated }: Props) {
  const { createSuite, addTask } = useEvaluationStore()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [suiteName, setSuiteName] = useState('')
  const [creating, setCreating] = useState(false)

  const selected = TEMPLATES.find((t) => t.id === selectedId) ?? null

  const handleSelect = (t: SuiteTemplate) => {
    setSelectedId(t.id)
    setSuiteName(t.name)
  }

  const handleUseTemplate = async () => {
    if (!selected || !suiteName.trim()) return
    setCreating(true)
    const trimmedName = suiteName.trim()
    try {
      await createSuite(trimmedName, selected.description)
      // createSuite returns null (backend create returns no data payload) but internally
      // calls fetchSuites, so the store state is already updated. Find the suite by name.
      const freshSuites = useEvaluationStore.getState().suites
      const newSuite = freshSuites.find((s) => s.suite_name === trimmedName)
      if (newSuite) {
        for (const task of selected.tasks) {
          await addTask(newSuite.evaluation_id, task)
        }
        onCreated(newSuite.evaluation_id, trimmedName)
      }
    } finally {
      setCreating(false)
      setSelectedId(null)
      setSuiteName('')
      onClose()
    }
  }

  const handleClose = () => {
    if (creating) return
    setSelectedId(null)
    setSuiteName('')
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircle size={20} />
          Create Suite from Template
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose a template to pre-populate the suite with example tasks and graders.
          You can customise everything after creation.
        </Typography>

        {/* Template cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: selected ? 2 : 0 }}>
          {TEMPLATES.map((t) => {
            const isSelected = t.id === selectedId
            return (
              <Paper
                key={t.id}
                variant="outlined"
                onClick={() => handleSelect(t)}
                sx={{
                  p: 2, cursor: 'pointer', transition: 'border-color 0.15s',
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  bgcolor: isSelected ? 'primary.50' : 'background.paper',
                  '&:hover': { borderColor: 'primary.main' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Box sx={{ color: isSelected ? 'primary.main' : 'text.secondary', flexShrink: 0, mt: 0.25 }}>
                    {t.icon}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600}>{t.name}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25, lineHeight: 1.4 }}>
                      {t.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                      <Chip label={`${t.tasks.length} tasks`} size="small" />
                      {t.tags.map((tag) => (
                        <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
                      ))}
                    </Box>
                  </Box>
                </Box>
              </Paper>
            )
          })}
        </Box>

        {/* Task preview + name field */}
        {selected && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 1 }}>
              Tasks included
            </Typography>
            {selected.tasks.map((task) => (
              <Box
                key={task.task_id}
                sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75, p: 1, borderRadius: 1, bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider' }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" fontWeight={600}>{task.task_name}</Typography>
                  {task.description && (
                    <Typography variant="caption" color="text.secondary" display="block">{task.description}</Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                  {task.trials > 1 && (
                    <Tooltip title={`${task.trials} trials per run`}>
                      <Chip label={`×${task.trials}`} size="small" color="primary" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                    </Tooltip>
                  )}
                  <Chip label={`${(task.graders_config ?? []).length} grader${(task.graders_config ?? []).length !== 1 ? 's' : ''}`} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                </Box>
              </Box>
            ))}

            <TextField
              label="Suite name"
              value={suiteName}
              onChange={(e) => setSuiteName(e.target.value)}
              fullWidth
              size="small"
              margin="dense"
              sx={{ mt: 1.5 }}
            />
          </Box>
        )}

        {creating && <LinearProgress sx={{ mt: 2 }} />}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={creating}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleUseTemplate}
          disabled={!selected || !suiteName.trim() || creating}
        >
          {creating ? 'Creating…' : 'Use Template'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
