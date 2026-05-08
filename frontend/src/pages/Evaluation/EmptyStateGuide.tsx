import { type ReactNode } from 'react'
import { Box, Button, Chip, Divider, Paper, Typography } from '@mui/material'
import { BookOpen, List, Play, Plus, FlaskConical, ArrowRight, Sparkles } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface EmptyStateAction {
  label: string
  icon: ReactNode
  onClick: () => void
  primary?: boolean
  description?: string
}

interface EmptyStateGuideProps {
  /** Which empty state to display */
  variant: 'no-suites' | 'no-suite-selected' | 'no-tasks' | 'no-runs'
  /** Called when the user clicks "Browse Examples" (unified templates + benchmarks) */
  onBrowseExamples?: () => void
  /** Called when the user clicks "New Suite" */
  onNewSuite?: () => void
  /** Called when the user clicks "Add Suite" (opens the chooser) */
  onAddSuite?: () => void
  /** Called when the user clicks "Add Task" */
  onAddTask?: () => void
  /** Called when the user clicks "Run Evaluation" */
  onRunEvaluation?: () => void
  /** Called when the user clicks "Quick Setup" */
  onTutorial?: () => void
}

// ── Option cards ─────────────────────────────────────────────────────────────

function OptionCard({ label, icon, onClick, primary, description }: EmptyStateAction) {
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        p: 2,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        minWidth: 160,
        maxWidth: 200,
        textAlign: 'center',
        borderColor: primary ? 'primary.main' : 'divider',
        bgcolor: primary ? 'primary.50' : 'background.paper',
        transition: 'all 0.15s',
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: 'primary.50',
          transform: 'translateY(-2px)',
          boxShadow: 2,
        },
      }}
    >
      <Box sx={{ color: primary ? 'primary.main' : 'text.secondary' }}>{icon}</Box>
      <Typography variant="body2" fontWeight={600} color={primary ? 'primary.main' : 'text.primary'}>
        {label}
      </Typography>
      {description && (
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
          {description}
        </Typography>
      )}
    </Paper>
  )
}

// ── Variant configs ───────────────────────────────────────────────────────────

function NoSuites({ onBrowseExamples, onNewSuite, onTutorial }: EmptyStateGuideProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, py: 4 }}>
      <Box sx={{ textAlign: 'center' }}>
        <FlaskConical size={48} style={{ color: '#9e9e9e', marginBottom: 8 }} />
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Welcome to Evaluation
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400 }}>
          Evaluation suites let you systematically test your agents and workflows.
          Create tasks, run them, and track quality over time.
        </Typography>
      </Box>

      <Divider flexItem sx={{ width: '100%', maxWidth: 480 }}>
        <Typography variant="caption" color="text.secondary">Choose how to start</Typography>
      </Divider>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
        {onBrowseExamples && (
          <OptionCard
            label="Add from Library"
            icon={<Sparkles size={28} />}
            onClick={onBrowseExamples}
            primary
            description="Choose from starter templates or comprehensive benchmarks."
          />
        )}
        {onNewSuite && (
          <OptionCard
            label="Blank Suite"
            icon={<Plus size={28} />}
            onClick={onNewSuite}
            description="Start from scratch and add your own tasks."
          />
        )}
      </Box>

      <Box sx={{ mt: 1, p: 2, bgcolor: 'info.50', borderRadius: 1, maxWidth: 480, width: '100%' }}>
        <Typography variant="caption" color="info.dark">
          <strong>Tip:</strong> New to evaluation? Use <em>Add from Library</em> to find a benchmark
          or starter template that matches your use case (10–15 tasks for benchmarks, 1–3 for templates).
          Everything is fully customizable after adding.
        </Typography>
      </Box>

      {/* Resources strip */}
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          maxWidth: 520,
        }}
      >
        {onTutorial && (
          <Button
            size="small"
            variant="text"
            startIcon={<Play size={13} />}
            onClick={onTutorial}
            sx={{ fontSize: '0.75rem', color: 'text.secondary' }}
          >
            Quick Setup
          </Button>
        )}
        <Typography variant="caption" color="text.disabled">·</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Sparkles size={12} style={{ flexShrink: 0 }} />
          5 starter templates + 17 benchmarks
        </Typography>
        <Typography variant="caption" color="text.disabled">·</Typography>
        <Chip
          label="Video tutorials coming soon"
          size="small"
          variant="outlined"
          sx={{ height: 20, fontSize: '0.7rem', borderStyle: 'dashed', color: 'text.secondary' }}
        />
      </Box>
    </Box>
  )
}

function NoSuiteSelected({ onAddSuite }: EmptyStateGuideProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
      <FlaskConical size={40} style={{ color: '#bdbdbd' }} />
      <Typography variant="body1" color="text.secondary" fontWeight={500}>
        Select a suite on the left to view its details
      </Typography>
      {onAddSuite && (
        <Button variant="contained" size="small" startIcon={<Plus size={14} />} onClick={onAddSuite}>
          Add Suite
        </Button>
      )}
    </Box>
  )
}

function NoTasks({ onAddTask, onBrowseExamples }: EmptyStateGuideProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="body1" fontWeight={600} gutterBottom>
          No tasks yet
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380 }}>
          Tasks define what you're testing. Each task has an input, an expected output,
          and graders that check whether the agent's response is correct.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
        {onAddTask && (
          <Button variant="contained" size="small" startIcon={<Plus size={14} />} onClick={onAddTask}>
            Add First Task
          </Button>
        )}
        {onBrowseExamples && (
          <Button variant="outlined" size="small" startIcon={<Sparkles size={14} />} onClick={onBrowseExamples}>
            Add from Library
          </Button>
        )}
      </Box>

      <Paper variant="outlined" sx={{ p: 2, maxWidth: 420, bgcolor: 'grey.50' }}>
        <Typography variant="caption" color="text.secondary" component="div">
          <strong>What makes a good task?</strong>
          <br />
          • Specific input that mirrors real usage<br />
          • Clear expected output or criteria<br />
          • At least one grader to check the output<br />
          • 3+ trials for reliable statistics
        </Typography>
      </Paper>
    </Box>
  )
}

function NoRuns({ onRunEvaluation }: EmptyStateGuideProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
      <Typography variant="body1" fontWeight={600} gutterBottom>
        No runs yet
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, textAlign: 'center' }}>
        A run executes all tasks in this suite against your workflow or agent and collects results.
      </Typography>
      {onRunEvaluation && (
        <Button
          variant="contained"
          size="small"
          endIcon={<ArrowRight size={14} />}
          onClick={onRunEvaluation}
        >
          Run Evaluation
        </Button>
      )}
      <Typography variant="caption" color="text.secondary">
        Make sure you have at least one task before running.
      </Typography>
    </Box>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function EmptyStateGuide(props: EmptyStateGuideProps) {
  switch (props.variant) {
    case 'no-suites':        return <NoSuites {...props} />
    case 'no-suite-selected': return <NoSuiteSelected {...props} />
    case 'no-tasks':         return <NoTasks {...props} />
    case 'no-runs':          return <NoRuns {...props} />
  }
}
