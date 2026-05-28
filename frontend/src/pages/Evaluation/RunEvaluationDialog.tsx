import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, FormControlLabel, Switch, Typography, Alert,
  RadioGroup, Radio, FormControl, FormLabel, CircularProgress,
  Select, MenuItem, InputLabel, Box,
} from '@mui/material'
import InfoTooltip from './InfoTooltip'
import { useWorkflows, useAgents } from '@test-agentstudio/api-client'
import { useAuthStore } from '@/stores/useAuthStore'
import { useEvaluationStore } from '@/stores/useEvaluationStore'

interface Props {
  open: boolean
  evaluationId: string
  onClose: () => void
  onRunStarted: (runId: string) => void
}

export default function RunEvaluationDialog({ open, evaluationId, onClose, onRunStarted }: Props) {
  const { startRun, loading, error } = useEvaluationStore()
  const spaceId = useAuthStore((s) => s.user?.spaceId) || ''

  const [targetType, setTargetType] = useState<'workflow' | 'agent'>('workflow')
  const [selectedId, setSelectedId] = useState('')
  const [parallel, setParallel] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  // Fetch workflow and agent lists
  const { data: workflowsResponse, isFetching: workflowsLoading } = useWorkflows({
    space_id: spaceId,
    page: 1,
    page_size: 100,
  })
  const { data: agentsResponse, isFetching: agentsLoading } = useAgents({
    space_id: spaceId,
    page: 1,
    page_size: 100,
  } as any)

  const workflows = workflowsResponse?.data?.workflow_list ?? []
  const agents = (agentsResponse?.data?.agent_items as any[]) ?? []

  const isListLoading = targetType === 'workflow' ? workflowsLoading : agentsLoading

  const handleTypeChange = (type: 'workflow' | 'agent') => {
    setTargetType(type)
    setSelectedId('')
  }

  const handleStart = async () => {
    setLocalError(null)
    if (!selectedId) {
      setLocalError(`Please select a ${targetType}.`)
      return
    }

    // Resolve human-readable name for display in the Runs table
    const selectedWorkflow = targetType === 'workflow'
      ? workflows.find((w: any) => w.workflow_id === selectedId)
      : undefined
    const selectedAgent = targetType === 'agent'
      ? agents.find((a: any) => a.agent_id === selectedId)
      : undefined

    const runId = await startRun({
      evaluationId,
      workflowId: targetType === 'workflow' ? selectedId : undefined,
      workflowVersion: targetType === 'workflow' ? 'draft' : undefined,
      workflowName: selectedWorkflow ? (selectedWorkflow.name || selectedWorkflow.workflow_id) : undefined,
      agentId: targetType === 'agent' ? selectedId : undefined,
      agentVersion: targetType === 'agent' ? 'draft' : undefined,
      agentName: selectedAgent ? (selectedAgent.agent_name || selectedAgent.agent_id) : undefined,
      parallel,
    })
    if (runId) {
      onRunStarted(runId)
      onClose()
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Run Evaluation</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {(localError || error) && (
          <Alert severity="error">{localError || error}</Alert>
        )}

        <FormControl>
          <FormLabel>Target Type</FormLabel>
          <RadioGroup
            row
            value={targetType}
            onChange={(e) => handleTypeChange(e.target.value as 'workflow' | 'agent')}
          >
            <FormControlLabel value="workflow" control={<Radio size="small" />} label="Workflow" />
            <FormControlLabel value="agent" control={<Radio size="small" />} label="Agent" />
          </RadioGroup>
        </FormControl>

        <FormControl fullWidth size="small" required>
          <InputLabel>
            {isListLoading
              ? 'Loading…'
              : targetType === 'workflow' ? 'Select Workflow' : 'Select Agent'}
          </InputLabel>
          <Select
            value={selectedId}
            label={targetType === 'workflow' ? 'Select Workflow' : 'Select Agent'}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={isListLoading}
          >
            {targetType === 'workflow'
              ? workflows.map((w: any) => (
                  <MenuItem key={w.workflow_id} value={w.workflow_id}>
                    {w.name || w.workflow_id}
                  </MenuItem>
                ))
              : agents.map((a: any) => (
                  <MenuItem key={a.agent_id} value={a.agent_id}>
                    {a.agent_name || a.agent_id}
                  </MenuItem>
                ))
            }
          </Select>
        </FormControl>

        <FormControlLabel
          control={<Switch checked={parallel} onChange={(e) => setParallel(e.target.checked)} />}
          label={
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="body2">Run tasks in parallel</Typography>
                <InfoTooltip
                  text={
                    'Run all tasks simultaneously instead of one at a time.\n\n' +
                    '• Parallel: faster overall, but higher concurrency load on your agent\n' +
                    '• Sequential (default): tasks run one after another — safer, easier to debug\n\n' +
                    'Recommendation: use Sequential while setting up, switch to Parallel for large suites.'
                  }
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                Faster but uses more resources simultaneously
              </Typography>
            </Box>
          }
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleStart}
          disabled={loading || !selectedId}
          startIcon={loading ? <CircularProgress size={14} /> : undefined}
        >
          {loading ? 'Starting…' : 'Start Run'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
