import React, { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  Paper,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  Alert,
} from '@mui/material'
import { Bug, CheckCircle, Download, FlaskConical, GitBranch, Info, Repeat, Sparkles, Star } from 'lucide-react'
import { useEvaluationStore, EvaluationTask } from '@/stores/useEvaluationStore'

// ─── Template definitions ────────────────────────────────────────────────────

type TemplateTask = Omit<EvaluationTask, 'create_time' | 'evaluation_id'>

interface SuiteTemplate {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  tags: string[]
  tasks: TemplateTask[]
  type: 'template'
  tooltipDetails?: string   // shown on ℹ hover — practical "what you actually get" info
}

// Benchmark files that belong in the Debug tab instead of Pattern
const DEBUG_BENCHMARK_FILES = new Set(['calculator_benchmark.yaml'])

const TEMPLATES: SuiteTemplate[] = [
  {
    id: 'llm-quality',
    name: 'LLM Response Quality',
    description: 'Evaluate text output quality using AI-judge graders with rubrics and assertions. Good starting point for any generative workflow.',
    icon: <Star size={20} />,
    tags: ['model-based', 'scoring'],
    type: 'template',
    tooltipDetails: '2 tasks: factual answer check + tone/relevance check. Both use gpt-4o-mini as judge. Replace the sample inputs with your real questions before running.',
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
    description: 'Verify that the agent calls the correct tools. Uses deterministic rule-based graders — no AI model required.',
    icon: <FlaskConical size={20} />,
    tags: ['deterministic', 'tool-calls'],
    type: 'template',
    tooltipDetails: '1 task: checks that a search tool (named "search" or "web_search") is invoked. Replace with your own tool names before running.',
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
    ],
  },
  {
    id: 'routing',
    name: 'Routing Accuracy',
    description: 'Test conditional branching — does the workflow route inputs to the correct branch? Uses state_check graders.',
    icon: <GitBranch size={20} />,
    tags: ['routing', 'deterministic'],
    type: 'template',
    tooltipDetails: '2 tasks: positive sentiment → "positive" branch, negative → "escalate" branch. Adapt the branch names and input messages to match your workflow.',
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
    name: 'Reliability & Consistency',
    description: 'Each task runs 3 trials to measure output consistency and detect flakiness in non-deterministic workflows.',
    icon: <Repeat size={20} />,
    tags: ['multi-trial', 'reliability'],
    type: 'template',
    tooltipDetails: '2 tasks × 3 trials each = 6 runs. Covers summarisation quality (AI judge) and classification label consistency (rule-based). Useful for spotting LLM variance.',
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

// Debug template
const DEBUG_TEMPLATE: SuiteTemplate = {
  id: 'debug-testing',
  name: 'Debug & Testing',
  description: 'Minimal sanity-check tasks for validating your workflow during development. No AI model required.',
  icon: <Bug size={20} />,
  tags: ['debugging', 'dev-only'],
  type: 'template',
  tooltipDetails: '2 tasks: (1) Echo test — sends "Hello, world!" and checks the response contains it. (2) Calculator function call — verifies a calculator tool is called and returns 5254. Both use rule-based graders only.',
  tasks: [
    {
      task_id: 'debug-task-1',
      task_name: 'Echo test',
      description: 'Verify the workflow receives and returns input correctly.',
      trials: 1,
      input_data: { message: 'Hello, world!' },
      expected_output: { response: 'Hello, world!' },
      graders_config: [
        {
          grader_type: 0,
          name: 'output_match',
          weight: 1.0,
          config: {
            check_type: 'output_check',
            expected_value: 'Hello, world!',
            path: 'response',
            condition: 'contains',
          },
        },
      ],
    },
    {
      task_id: 'debug-task-2',
      task_name: 'Calculator function call',
      description: 'Verify the workflow calls the calculator tool and returns the correct result.',
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
}

// ─── Benchmark metadata ───────────────────────────────────────────────────────

const DOMAIN_BENCHMARK_META: Record<string, {
  domain: string
  keyPatterns: string
  graderDist: { det: number; model: number; code: number }
  tooltipDetails: string
}> = {
  '01_customer_support.yaml':    { domain: 'Customer Service', keyPatterns: 'Routing, tone checks, empathy',         graderDist: { det: 7, model: 4, code: 3 }, tooltipDetails: '14 tasks: ticket routing, sentiment analysis, empathy scoring, SLA compliance checks, and escalation detection. 4 AI judge tasks require a model.' },
  '02_rag_system.yaml':          { domain: 'RAG / Q&A',        keyPatterns: 'Hallucination prevention, grounding',   graderDist: { det: 5, model: 4, code: 3 }, tooltipDetails: '12 tasks: retrieval accuracy, citation quality, grounding verification, and hallucination detection. 4 AI judge tasks require a model.' },
  '03_code_generation.yaml':     { domain: 'Software Dev',     keyPatterns: 'Syntax validation, security checks',    graderDist: { det: 7, model: 2, code: 5 }, tooltipDetails: '12 tasks: syntax validation, security vulnerability checks, code quality, and best-practices. 5 Python code-based graders.' },
  '04_content_moderation.yaml':  { domain: 'Trust & Safety',   keyPatterns: 'False positive/negative rate',          graderDist: { det: 3, model: 0, code: 5 }, tooltipDetails: '8 tasks: policy violation detection, false positive/negative rate, edge cases. All graders are rule-based or code-based — no model needed.' },
  '05_data_extraction.yaml':     { domain: 'NLP / ETL',        keyPatterns: 'JSON schema, number extraction',        graderDist: { det: 7, model: 0, code: 5 }, tooltipDetails: '12 tasks: structured data extraction from text, JSON schema validation, number/date parsing. No AI model required.' },
  '06_research_agent.yaml':      { domain: 'Research',         keyPatterns: 'Multi-source synthesis, citations',     graderDist: { det: 6, model: 2, code: 3 }, tooltipDetails: '11 tasks: multi-source research synthesis, citation accuracy, fact coverage, and report quality. 2 AI judge tasks require a model.' },
  '07_translation_agent.yaml':   { domain: 'Localization',     keyPatterns: 'Idiom handling, register, terms',       graderDist: { det: 5, model: 3, code: 3 }, tooltipDetails: '11 tasks: translation accuracy, idiom handling, cultural adaptation, and register consistency. 3 AI judge tasks require a model.' },
  '08_email_assistant.yaml':     { domain: 'Productivity',     keyPatterns: 'Tone, completeness, empathy',           graderDist: { det: 9, model: 4, code: 3 }, tooltipDetails: '16 tasks: email drafting quality, tone matching, completeness, professionalism, and empathy. 4 AI judge tasks require a model.' },
  '09_sql_agent.yaml':           { domain: 'Database',         keyPatterns: 'SQL safety, injection prevention',      graderDist: { det: 6, model: 1, code: 5 }, tooltipDetails: '12 tasks: SQL generation correctness, injection prevention, query optimization, and safety checks. 5 Python graders.' },
  '10_conversational_agent.yaml':{ domain: 'Chatbot',          keyPatterns: 'Context retention, safety',             graderDist: { det: 7, model: 3, code: 4 }, tooltipDetails: '14 tasks: multi-turn context retention, topic switching, safety guardrails, and dialogue quality. 3 AI judge tasks require a model.' },
}

function isDomainBenchmark(fileName: string) {
  return /^\d{2}_/.test(fileName)
}

function isDebugBenchmark(fileName: string) {
  return DEBUG_BENCHMARK_FILES.has(fileName)
}

// ─── Reusable card component ─────────────────────────────────────────────────

interface CardChips {
  taskCount?: number
  needsModel?: boolean
  tags?: string[]
  domainLabel?: string
  graderDist?: { det: number; model: number; code: number }
}

function SuiteCard({
  title,
  description,
  tooltipDetails,
  chips,
  isSelected,
  onClick,
}: {
  title: string
  description: string
  tooltipDetails?: string
  chips: CardChips
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        p: 1.5,
        cursor: 'pointer',
        transition: 'all 0.15s',
        borderColor: isSelected ? 'primary.main' : 'divider',
        borderWidth: isSelected ? 2 : 1,
        bgcolor: isSelected ? 'primary.50' : 'background.paper',
        '&:hover': { borderColor: 'primary.main', bgcolor: isSelected ? 'primary.50' : 'grey.50' },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Title row */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 0.5, mb: 0.5 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>{title}</Typography>
        {chips.domainLabel && (
          <Chip label={chips.domainLabel} size="small" color="secondary" variant="outlined" sx={{ height: 18, fontSize: '0.62rem', flexShrink: 0 }} />
        )}
        {tooltipDetails && (
          <Tooltip
            title={<Typography variant="caption" sx={{ whiteSpace: 'pre-line' }}>{tooltipDetails}</Typography>}
            placement="right"
            arrow
          >
            <Box
              component="span"
              onClick={(e) => e.stopPropagation()}
              sx={{ color: 'text.disabled', cursor: 'help', flexShrink: 0, display: 'flex', alignItems: 'center' }}
            >
              <Info size={14} />
            </Box>
          </Tooltip>
        )}
      </Box>

      {/* Description */}
      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4, flex: 1 }}>
        {description}
      </Typography>

      {/* Chips */}
      <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        {chips.taskCount !== undefined && (
          <Chip label={`${chips.taskCount} task${chips.taskCount !== 1 ? 's' : ''}`} size="small" sx={{ height: 18, fontSize: '0.62rem' }} />
        )}
        {chips.needsModel && (
          <Tooltip title="Has AI judge graders — requires a model configured in Settings → Models to run these tasks">
            <Chip label="Needs AI model" size="small" sx={{ bgcolor: 'warning.100', color: 'warning.dark', fontSize: '0.62rem', height: 18, fontWeight: 600, cursor: 'help' }} />
          </Tooltip>
        )}
        {chips.graderDist && (
          <>
            {chips.graderDist.det > 0 && (
              <Tooltip title="Rule-based graders (fast, deterministic — no model needed)">
                <Chip label={`Rule ×${chips.graderDist.det}`} size="small" sx={{ bgcolor: 'info.50', color: 'info.dark', fontSize: '0.62rem', height: 18 }} />
              </Tooltip>
            )}
            {chips.graderDist.code > 0 && (
              <Tooltip title="Code-based graders (custom Python — no model needed)">
                <Chip label={`Code ×${chips.graderDist.code}`} size="small" sx={{ bgcolor: 'success.50', color: 'success.dark', fontSize: '0.62rem', height: 18 }} />
              </Tooltip>
            )}
          </>
        )}
        {chips.tags?.slice(0, 1).map((tag) => (
          <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
        ))}
      </Box>
    </Paper>
  )
}

// ─── Unified Dialog ───────────────────────────────────────────────────────────

const TAB_DOMAIN   = 0
const TAB_PATTERN  = 1
const TAB_TEMPLATE = 2
const TAB_DEBUG    = 3

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (evaluationId: string, suiteName: string) => void
}

export default function BrowseExamplesDialog({ open, onClose, onCreated }: Props) {
  const { benchmarks, fetchBenchmarks, importBenchmark, createSuite, addTask, loading } = useEvaluationStore()

  const [activeTab, setActiveTab] = useState(TAB_DOMAIN)
  const [selectedType, setSelectedType] = useState<'template' | 'benchmark' | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [suiteName, setSuiteName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (open) fetchBenchmarks()
  }, [open])

  // Categorise benchmarks
  const domainBenchmarks  = benchmarks.filter(b => isDomainBenchmark(b.file_name))
  const debugBenchmarks   = benchmarks.filter(b => isDebugBenchmark(b.file_name))
  const patternBenchmarks = benchmarks.filter(b => !isDomainBenchmark(b.file_name) && !isDebugBenchmark(b.file_name))

  const ALL_TEMPLATES = [...TEMPLATES, DEBUG_TEMPLATE]
  const selectedTemplate = selectedType === 'template' ? ALL_TEMPLATES.find((t) => t.id === selectedId) ?? null : null
  const selectedBenchmark = selectedType === 'benchmark' ? benchmarks.find((b) => b.file_name === selectedId) ?? null : null

  // Does the selected item require an AI model?
  const selectedNeedsModel = selectedTemplate
    ? selectedTemplate.tasks.some((t) => (t.graders_config ?? []).some((g) => g.grader_type === 1))
    : selectedBenchmark
      ? (DOMAIN_BENCHMARK_META[selectedBenchmark.file_name]?.graderDist.model ?? 0) > 0
      : false

  const templateNeedsModel = (t: SuiteTemplate) =>
    t.tasks.some((task) => (task.graders_config ?? []).some((g) => g.grader_type === 1))

  const handleSelectTemplate = (t: SuiteTemplate) => {
    setSelectedType('template')
    setSelectedId(t.id)
    setSuiteName(t.name)
  }

  const handleSelectBenchmark = (fileName: string, defaultName: string) => {
    setSelectedType('benchmark')
    setSelectedId(fileName)
    setSuiteName(defaultName)
  }

  const handleUse = async () => {
    if (!suiteName.trim()) return
    setCreating(true)
    try {
      if (selectedType === 'template' && selectedTemplate) {
        const trimmedName = suiteName.trim()
        await createSuite(trimmedName, selectedTemplate.description)
        const freshSuites = useEvaluationStore.getState().suites
        const newSuite = freshSuites.find((s) => s.suite_name === trimmedName)
        if (newSuite) {
          for (const task of selectedTemplate.tasks) {
            await addTask(newSuite.evaluation_id, task)
          }
          onCreated(newSuite.evaluation_id, trimmedName)
        }
      } else if (selectedType === 'benchmark' && selectedId) {
        const evalId = await importBenchmark(selectedId, suiteName.trim())
        if (evalId) onCreated(evalId, suiteName.trim())
      }
    } finally {
      setCreating(false)
      setSelectedType(null)
      setSelectedId(null)
      setSuiteName('')
      onClose()
    }
  }

  const handleClose = () => {
    if (creating) return
    setSelectedType(null)
    setSelectedId(null)
    setSuiteName('')
    onClose()
  }

  // ── Tab definitions ──────────────────────────────────────────────────────────

  const tabs = [
    {
      id: TAB_DOMAIN,
      label: 'Domain Benchmarks',
      badge: 'Production-ready',
      badgeColor: 'primary' as const,
      subtitle: 'Comprehensive, ready-to-run test suites for real-world AI use cases. Import as-is — tasks, graders and expected outputs are all pre-configured.',
    },
    {
      id: TAB_PATTERN,
      label: 'Pattern Benchmarks',
      badge: 'Production-ready',
      badgeColor: 'primary' as const,
      subtitle: 'Validate your workflow\'s structural patterns — routing, chaining, parallelization, memory, and more. All tasks are pre-configured.',
    },
    {
      id: TAB_TEMPLATE,
      label: 'Quick Start Templates',
      badge: '1–3 tasks',
      badgeColor: undefined,
      subtitle: 'Minimal starting points for common evaluation patterns. After adding, you\'ll need to add more tasks and customize inputs and graders to match your actual workflow.',
    },
    {
      id: TAB_DEBUG,
      label: 'Debug & Testing',
      badge: 'Dev tools',
      badgeColor: undefined,
      subtitle: 'Minimal sanity-check tasks for validating your workflow during development. Use to quickly verify basic I/O, tool calls, and output correctness.',
    },
  ]

  // ── Card grids ───────────────────────────────────────────────────────────────

  const renderDomainBenchmarks = () => (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
      {domainBenchmarks.map((bm) => {
        const meta = DOMAIN_BENCHMARK_META[bm.file_name]
        const isSelected = selectedType === 'benchmark' && selectedId === bm.file_name
        return (
          <SuiteCard
            key={bm.file_name}
            title={bm.suite_name}
            description={meta ? `${meta.keyPatterns}` : bm.description ?? ''}
            tooltipDetails={meta?.tooltipDetails}
            isSelected={isSelected}
            onClick={() => handleSelectBenchmark(bm.file_name, bm.suite_name)}
            chips={{
              taskCount: bm.task_count,
              domainLabel: meta?.domain,
              needsModel: (meta?.graderDist.model ?? 0) > 0,
              graderDist: meta?.graderDist,
            }}
          />
        )
      })}
    </Box>
  )

  const renderPatternBenchmarks = () => (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
      {patternBenchmarks.map((bm) => {
        const isSelected = selectedType === 'benchmark' && selectedId === bm.file_name
        return (
          <SuiteCard
            key={bm.file_name}
            title={bm.suite_name}
            description={bm.description ?? 'Validates a specific workflow architecture pattern.'}
            isSelected={isSelected}
            onClick={() => handleSelectBenchmark(bm.file_name, bm.suite_name)}
            chips={{ taskCount: bm.task_count }}
          />
        )
      })}
    </Box>
  )

  const renderTemplates = () => (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
      {TEMPLATES.map((t) => {
        const isSelected = selectedType === 'template' && selectedId === t.id
        const needsModel = templateNeedsModel(t)
        return (
          <SuiteCard
            key={t.id}
            title={t.name}
            description={t.description}
            tooltipDetails={t.tooltipDetails}
            isSelected={isSelected}
            onClick={() => handleSelectTemplate(t)}
            chips={{
              taskCount: t.tasks.length,
              needsModel,
              tags: t.tags,
            }}
          />
        )
      })}
    </Box>
  )

  const renderDebug = () => (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
      {/* Frontend debug template */}
      {(() => {
        const t = DEBUG_TEMPLATE
        const isSelected = selectedType === 'template' && selectedId === t.id
        return (
          <SuiteCard
            key={t.id}
            title={t.name}
            description={t.description}
            tooltipDetails={t.tooltipDetails}
            isSelected={isSelected}
            onClick={() => handleSelectTemplate(t)}
            chips={{ taskCount: t.tasks.length, tags: t.tags }}
          />
        )
      })()}
      {/* Backend debug benchmarks (e.g., calculator_benchmark.yaml) */}
      {debugBenchmarks.map((bm) => {
        const isSelected = selectedType === 'benchmark' && selectedId === bm.file_name
        return (
          <SuiteCard
            key={bm.file_name}
            title={bm.suite_name}
            description={bm.description ?? 'Debug benchmark for validating basic workflow functionality.'}
            isSelected={isSelected}
            onClick={() => handleSelectBenchmark(bm.file_name, bm.suite_name)}
            chips={{ taskCount: bm.task_count }}
          />
        )
      })}
    </Box>
  )

  const activeTabDef = tabs[activeTab]

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { height: '90vh', display: 'flex', flexDirection: 'column' } }}
    >
      <DialogTitle sx={{ pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Sparkles size={20} />
          Add Suite from Library
        </Box>
      </DialogTitle>

      {/* ── Tabs ──────────────────────────────────────────────────────────────── */}
      <Box sx={{ px: 3, pt: 1, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto">
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <span>{tab.label}</span>
                  <Chip
                    label={tab.badge}
                    size="small"
                    color={tab.badgeColor ?? 'default'}
                    variant={tab.badgeColor ? 'filled' : 'outlined'}
                    sx={{ height: 16, fontSize: '0.6rem', pointerEvents: 'none' }}
                  />
                </Box>
              }
              sx={{ textTransform: 'none', fontSize: '0.85rem', minHeight: 48 }}
            />
          ))}
        </Tabs>
      </Box>

      {/* ── Scrollable content ────────────────────────────────────────────────── */}
      <DialogContent sx={{ flex: 1, overflowY: 'auto', pt: 2 }}>
        {/* Tab subtitle */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          {activeTabDef.subtitle}
        </Typography>

        {activeTabDef.id === TAB_TEMPLATE && (
          <Box sx={{ mb: 2, p: 1.5, bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.200', borderRadius: 1 }}>
            <Typography variant="caption" color="warning.dark">
              <strong>Note:</strong> Templates contain only 1–3 example tasks. After adding, you must add more tasks and
              configure inputs and graders to match your actual workflow and data before running.
            </Typography>
          </Box>
        )}

        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {activeTab === TAB_DOMAIN  && renderDomainBenchmarks()}
        {activeTab === TAB_PATTERN && renderPatternBenchmarks()}
        {activeTab === TAB_TEMPLATE && renderTemplates()}
        {activeTab === TAB_DEBUG   && renderDebug()}
      </DialogContent>

      {/* ── Pinned footer: model warning + suite name + actions ──────────────── */}
      <Box sx={{ flexShrink: 0, borderTop: 1, borderColor: 'divider' }}>
        {/* Model warning — always visible when relevant */}
        {selectedNeedsModel && (selectedTemplate || selectedBenchmark) && (
          <Alert severity="warning" sx={{ borderRadius: 0, py: 0.75 }}>
            <Typography variant="caption" fontWeight={600} display="block">
              This suite uses AI judge graders — a model must be configured to run it
            </Typography>
            <Typography variant="caption">
              Go to <strong>Settings → Models</strong> and add at least one AI model before running.
              Alternatively, replace AI judge graders with rule-based graders in the task editor after adding.
            </Typography>
          </Alert>
        )}

        {/* Suite name + action buttons */}
        <Box sx={{ px: 3, py: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
          <TextField
            label="Suite Name"
            value={suiteName}
            onChange={(e) => setSuiteName(e.target.value)}
            size="small"
            sx={{ flex: 1 }}
            placeholder="Select an item above to set the name"
            disabled={!selectedType}
            helperText={selectedType ? 'You can rename before adding' : ' '}
          />
          <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
            <Button onClick={handleClose} disabled={creating}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleUse}
              disabled={!selectedType || !suiteName.trim() || creating}
              startIcon={<Download size={14} />}
            >
              {creating ? 'Adding…' : 'Add to My Suites'}
            </Button>
          </Box>
        </Box>

        {creating && <LinearProgress />}
      </Box>
    </Dialog>
  )
}
