/**
 * GraderWizard — visual, no-JSON grader configuration form.
 *
 * Usage:
 *   <GraderWizard
 *     open={open}
 *     onClose={onClose}
 *     onSave={(graderConfig) => appendGraderToJson(graderConfig)}
 *   />
 *
 * Produces a grader config object compatible with the evaluation backend:
 *   {
 *     name, type (0|1|2), weight,
 *     // deterministic:
 *     check_type, pattern?, field_path?, min_value?, max_value?, schema?,
 *     // model-based:
 *     model_id?, rubric?, passing_score?,
 *     // code-based:
 *     code?,
 *   }
 */

import { useState, useEffect } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Slider,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { Bot, CheckCircle, Code, Sparkles, WandSparkles, Zap } from 'lucide-react'
import { useModels } from '@test-agentstudio/api-client'
import { useAuthStore } from '@/stores/useAuthStore'
import { getAuthToken } from '@/utils/authUtils'
import InfoTooltip from './InfoTooltip'

// ── Types ─────────────────────────────────────────────────────────────────────

type GraderType = 0 | 1 | 2
// 0 = Deterministic, 1 = Model-Based, 2 = Code-Based

type CheckType = 'contains' | 'equals' | 'regex' | 'range' | 'json_schema'

export interface GraderConfig {
  name: string
  type: GraderType
  weight: number
  // deterministic
  check_type?: CheckType
  pattern?: string
  field_path?: string
  min_value?: number
  max_value?: number
  schema?: object
  // model-based
  model_id?: number
  rubric?: string
  passing_score?: number
  // code-based
  code?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const GRADER_TYPE_LABELS: Record<GraderType, string> = {
  0: 'Deterministic',
  1: 'Model-Based',
  2: 'Code-Based',
}

const GRADER_TYPE_DESCS: Record<GraderType, string> = {
  0: 'Rule-based check — always gives the same result. Best for exact matches, keywords, regex, numbers.',
  1: 'AI judge — uses an LLM to evaluate quality with a rubric. Best for tone, helpfulness, reasoning.',
  2: 'Python function — full custom logic. Best for complex domain-specific checks.',
}

const CHECK_TYPE_LABELS: Record<CheckType, string> = {
  contains: 'Contains (substring)',
  equals: 'Equals (exact match)',
  regex: 'Regex pattern',
  range: 'Numeric range',
  json_schema: 'JSON schema validation',
}

const CHECK_TYPE_DESCS: Record<CheckType, string> = {
  contains: 'Checks if the output text contains a specific substring. Case-insensitive by default.',
  equals: 'Checks if the output exactly equals the expected value. Strict, character-for-character.',
  regex: 'Checks if the output matches a regular expression (Python regex syntax).',
  range: 'Checks if a numeric value in the output falls within min/max bounds.',
  json_schema: 'Validates that a JSON field matches a specific schema structure.',
}

const DEFAULT_GRADE_CODE = `def grade(output, expected, context):
    """
    Custom grader — return a dict with:
      passed (bool): whether this trial passed
      score  (float 0-1): quality score
      reason (str): explanation
    """
    # output: the agent's response (string or dict)
    # expected: the expected_output dict from the task
    # context: dict with task metadata

    passed = True  # your logic here
    score = 1.0 if passed else 0.0
    return {
        "passed": passed,
        "score": score,
        "reason": "Your explanation here"
    }`

// ── JSON Preview ──────────────────────────────────────────────────────────────

function JsonPreview({ config }: { config: GraderConfig }) {
  const cleanConfig = Object.fromEntries(
    Object.entries(config).filter(([, v]) => v !== '' && v !== undefined && v !== null)
  )
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
        Generated Config Preview
      </Typography>
      <Box
        component="pre"
        sx={{
          p: 1.5, bgcolor: 'grey.50', borderRadius: 1,
          fontSize: '0.7rem', overflow: 'auto', maxHeight: 200,
          border: '1px solid', borderColor: 'divider',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}
      >
        {JSON.stringify(cleanConfig, null, 2)}
      </Box>
    </Box>
  )
}

// ── Deterministic Form ────────────────────────────────────────────────────────

interface DetForm {
  checkType: CheckType
  fieldPath: string
  pattern: string
  minValue: string
  maxValue: string
  schema: string
  schemaError: string
}

function DeterministicForm({ state, onChange }: {
  state: DetForm
  onChange: (partial: Partial<DetForm>) => void
}) {
  const validateSchema = (val: string) => {
    try { JSON.parse(val); return '' }
    catch { return 'Invalid JSON schema' }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <InfoTooltip
          text="Determines how the grader compares the agent's output to the expected value."
          label="Check Type"
          sx={{ mb: 0.5 }}
        />
        <FormControl fullWidth size="small">
          <Select
            value={state.checkType}
            onChange={(e) => onChange({ checkType: e.target.value as CheckType })}
          >
            {(Object.entries(CHECK_TYPE_LABELS) as [CheckType, string][]).map(([val, label]) => (
              <MenuItem key={val} value={val}>
                <Box>
                  <Typography variant="body2">{label}</Typography>
                  <Typography variant="caption" color="text.secondary">{CHECK_TYPE_DESCS[val]}</Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <TextField
        label="Field Path (optional)"
        value={state.fieldPath}
        onChange={(e) => onChange({ fieldPath: e.target.value })}
        size="small"
        fullWidth
        helperText='Dot-notation path into output JSON, e.g. "data.result". Leave blank to check the full output text.'
        placeholder="e.g. result, data.user.email"
      />

      {(state.checkType === 'contains' || state.checkType === 'equals' || state.checkType === 'regex') && (
        <TextField
          label={state.checkType === 'regex' ? 'Regex Pattern' : 'Expected Value / Pattern'}
          value={state.pattern}
          onChange={(e) => onChange({ pattern: e.target.value })}
          size="small"
          fullWidth
          required
          helperText={
            state.checkType === 'regex'
              ? 'Python regex, e.g. "(success|completed|done)"'
              : state.checkType === 'equals'
              ? 'Exact string that the output must equal'
              : 'Substring that the output must contain'
          }
        />
      )}

      {state.checkType === 'range' && (
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Min Value"
            value={state.minValue}
            onChange={(e) => onChange({ minValue: e.target.value })}
            type="number"
            size="small"
            fullWidth
          />
          <TextField
            label="Max Value"
            value={state.maxValue}
            onChange={(e) => onChange({ maxValue: e.target.value })}
            type="number"
            size="small"
            fullWidth
          />
        </Box>
      )}

      {state.checkType === 'json_schema' && (
        <TextField
          label="JSON Schema"
          value={state.schema}
          onChange={(e) => {
            onChange({ schema: e.target.value, schemaError: validateSchema(e.target.value) })
          }}
          multiline
          rows={5}
          size="small"
          fullWidth
          error={!!state.schemaError}
          helperText={state.schemaError || 'JSON Schema (draft-07) to validate against'}
          inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.72rem' } }}
          placeholder='{"type": "object", "required": ["name", "score"], "properties": {...}}'
        />
      )}
    </Box>
  )
}

// ── Model-Based Form ──────────────────────────────────────────────────────────

interface ModelForm {
  modelId: string
  rubric: string
  passingScore: number
}

function ModelBasedForm({ state, onChange, availableModels }: {
  state: ModelForm
  onChange: (partial: Partial<ModelForm>) => void
  availableModels: Array<{ id: string; name: string }>
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box>
        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
          AI Judge Model *
        </Typography>
        <FormControl fullWidth size="small">
          <Select
            value={state.modelId}
            onChange={(e) => onChange({ modelId: e.target.value })}
            displayEmpty
          >
            <MenuItem value="" disabled><em>Select a model…</em></MenuItem>
            {availableModels.map((m) => (
              <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        {availableModels.length === 0 && (
          <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
            No models configured. Add a model in Settings → Models first.
          </Typography>
        )}
      </Box>

      <Box>
        <InfoTooltip helpKey="GRADER_RUBRIC" label="Rubric" sx={{ mb: 0.5 }} />
        <TextField
          value={state.rubric}
          onChange={(e) => onChange({ rubric: e.target.value })}
          multiline
          rows={6}
          fullWidth
          size="small"
          placeholder="Describe what makes a good response. Be specific.
Example: The response should correctly identify the sentiment as positive or negative,
provide a clear routing decision (support/sales/billing), and give a brief reasoning.
Score 0.0-1.0. Return: {&quot;score&quot;: float, &quot;passed&quot;: bool, &quot;reasoning&quot;: string}"
          helperText="Tell the AI judge what to look for and how to score it. End your rubric with the return format instruction."
        />
      </Box>

      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <InfoTooltip helpKey="GRADER_PASSING_SCORE" label="Passing Score Threshold" />
          <Chip label={state.passingScore.toFixed(2)} size="small" color="primary" />
        </Box>
        <Slider
          value={state.passingScore}
          onChange={(_, val) => onChange({ passingScore: val as number })}
          min={0}
          max={1}
          step={0.05}
          marks={[
            { value: 0, label: '0.0' },
            { value: 0.5, label: '0.5' },
            { value: 0.7, label: '0.7 (rec)' },
            { value: 0.9, label: '0.9' },
            { value: 1, label: '1.0' },
          ]}
          sx={{ mx: 1 }}
        />
        <Typography variant="caption" color="text.secondary">
          Score ≥ {state.passingScore.toFixed(2)} counts as "passed".
          Recommended: 0.7 for quality checks, 0.9 for strict requirements.
        </Typography>
      </Box>
    </Box>
  )
}

// ── Code-Based Form ───────────────────────────────────────────────────────────

interface CodeForm {
  code: string
}

function CodeBasedForm({ state, onChange }: {
  state: CodeForm
  onChange: (partial: Partial<CodeForm>) => void
}) {
  return (
    <Box>
      <InfoTooltip helpKey="GRADER_TYPE_CODE" label="Grader Code (Python)" sx={{ mb: 0.5 }} />
      <TextField
        value={state.code}
        onChange={(e) => onChange({ code: e.target.value })}
        multiline
        rows={12}
        fullWidth
        size="small"
        inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.72rem' } }}
        helperText="Python function: def grade(output, expected, context) → return dict with 'passed', 'score', 'reason'"
      />
    </Box>
  )
}

// ── Main Dialog ───────────────────────────────────────────────────────────────

interface GraderWizardProps {
  open: boolean
  onClose: () => void
  /** Called with the generated grader config when user clicks Save */
  onSave: (config: GraderConfig) => void
}

export default function GraderWizard({ open, onClose, onSave }: GraderWizardProps) {
  const spaceId = useAuthStore((s) => s.user?.spaceId) || ''
  const { data: modelsData } = useModels({ spaceId: spaceId || undefined })
  const availableModels = (modelsData?.items ?? []).map((m) => ({ id: m.id, name: m.name }))

  const [graderType, setGraderType] = useState<GraderType>(0)
  const [name, setName] = useState('')
  const [weight, setWeight] = useState(1)
  const [showPreview, setShowPreview] = useState(false)
  const [error, setError] = useState('')

  // Deterministic state
  const [det, setDet] = useState<DetForm>({
    checkType: 'contains', fieldPath: '', pattern: '',
    minValue: '', maxValue: '', schema: '', schemaError: '',
  })

  // Model-based state
  const [model, setModel] = useState<ModelForm>({ modelId: '', rubric: '', passingScore: 0.7 })

  // Code-based state
  const [code, setCode] = useState<CodeForm>({ code: DEFAULT_GRADE_CODE })

  // AI assistant state
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual')
  const [aiDesc, setAiDesc] = useState('')
  const [aiModelId, setAiModelId] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiResult, setAiResult] = useState<GraderConfig | null>(null)
  const [aiError, setAiError] = useState('')

  // Reset when opened
  useEffect(() => {
    if (open) {
      setGraderType(0)
      setName('')
      setWeight(1)
      setShowPreview(false)
      setError('')
      setDet({ checkType: 'contains', fieldPath: '', pattern: '', minValue: '', maxValue: '', schema: '', schemaError: '' })
      setModel({ modelId: '', rubric: '', passingScore: 0.7 })
      setCode({ code: DEFAULT_GRADE_CODE })
      setActiveTab('manual')
      setAiDesc('')
      setAiResult(null)
      setAiError('')
    }
  }, [open])

  const buildConfig = (): GraderConfig => {
    const base: GraderConfig = {
      name: name.trim() || `grader_${graderType}_${det.checkType ?? ''}`,
      type: graderType,
      weight,
    }
    if (graderType === 0) {
      base.check_type = det.checkType
      if (det.fieldPath.trim()) base.field_path = det.fieldPath.trim()
      if (det.checkType !== 'range' && det.checkType !== 'json_schema') {
        base.pattern = det.pattern
      }
      if (det.checkType === 'range') {
        if (det.minValue !== '') base.min_value = parseFloat(det.minValue)
        if (det.maxValue !== '') base.max_value = parseFloat(det.maxValue)
      }
      if (det.checkType === 'json_schema' && det.schema.trim()) {
        try { base.schema = JSON.parse(det.schema) } catch { /* validated separately */ }
      }
    } else if (graderType === 1) {
      if (model.modelId) base.model_id = parseInt(model.modelId, 10)
      base.rubric = model.rubric
      base.passing_score = model.passingScore
    } else {
      base.code = code.code
    }
    return base
  }

  const validate = (): boolean => {
    if (graderType === 0) {
      if ((det.checkType === 'contains' || det.checkType === 'equals' || det.checkType === 'regex') && !det.pattern.trim()) {
        setError('Pattern / expected value is required for this check type.')
        return false
      }
      if (det.checkType === 'json_schema' && det.schemaError) {
        setError('Fix the JSON schema error before saving.')
        return false
      }
    } else if (graderType === 1) {
      if (!model.modelId) {
        setError('Select an AI judge model.')
        return false
      }
      if (!model.rubric.trim()) {
        setError('Rubric is required for model-based graders.')
        return false
      }
    } else {
      if (!code.code.trim()) {
        setError('Code is required for code-based graders.')
        return false
      }
    }
    setError('')
    return true
  }

  const handleSave = () => {
    if (!validate()) return
    onSave(buildConfig())
    onClose()
  }

  // AI grader generation
  const handleGenerate = async () => {
    if (!aiDesc.trim()) { setAiError('Please describe what you want to check.'); return }
    setAiGenerating(true)
    setAiError('')
    setAiResult(null)
    try {
      const token = getAuthToken()
      const resp = await fetch('/api/v1/evaluation/grader/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          description: aiDesc.trim(),
          space_id: spaceId,
          model_id: aiModelId ? parseInt(aiModelId, 10) : undefined,
        }),
      })
      const json = await resp.json()
      if (json.code === 200 && json.data?.grader_config) {
        setAiResult(json.data.grader_config as GraderConfig)
      } else {
        setAiError(json.message || 'Generation failed. Try rephrasing your description.')
      }
    } catch (e) {
      setAiError('Network error — could not reach the server.')
    } finally {
      setAiGenerating(false)
    }
  }

  const handleUseAiResult = () => {
    if (!aiResult) return
    // Populate the manual form from the generated config
    const g = aiResult
    if (g.name) setName(g.name)
    if (g.weight) setWeight(g.weight)
    const t = (g.type ?? 0) as GraderType
    setGraderType(t)
    if (t === 0) {
      setDet({
        checkType: (g.check_type as DetForm['checkType']) || 'contains',
        fieldPath: g.field_path || '',
        pattern: g.pattern || '',
        minValue: g.min_value != null ? String(g.min_value) : '',
        maxValue: g.max_value != null ? String(g.max_value) : '',
        schema: g.schema ? JSON.stringify(g.schema, null, 2) : '',
        schemaError: '',
      })
    } else if (t === 1) {
      setModel({
        modelId: g.model_id ? String(g.model_id) : '',
        rubric: g.rubric || '',
        passingScore: g.passing_score ?? 0.7,
      })
    } else if (t === 2) {
      setCode({ code: g.code || '' })
    }
    setActiveTab('manual')
  }

  const config = buildConfig()

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Zap size={18} />
          Add Grader
        </Box>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab value="manual" label="Manual Setup" icon={<CheckCircle size={14} />} iconPosition="start" sx={{ minHeight: 40 }} />
          <Tab value="ai" label="AI Assistant" icon={<Bot size={14} />} iconPosition="start" sx={{ minHeight: 40 }} />
        </Tabs>
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', gap: 3, p: 3 }}>

      {/* ── AI Assistant Tab ──────────────────────────────────────────────── */}
      {activeTab === 'ai' && (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Typography variant="body2" color="text.secondary">
            Describe in plain English what you want the grader to check. The AI will generate a grader configuration for you.
          </Typography>

          <TextField
            label="Describe what to check *"
            placeholder="e.g. Check if the output contains a valid phone number in E.164 format"
            value={aiDesc}
            onChange={e => { setAiDesc(e.target.value); setAiError('') }}
            multiline
            rows={3}
            fullWidth
            size="small"
          />

          <Box>
            <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
              AI Model (optional — uses first active model if not set)
            </Typography>
            <FormControl fullWidth size="small">
              <Select
                value={aiModelId}
                onChange={e => setAiModelId(e.target.value)}
                displayEmpty
              >
                <MenuItem value=""><em>Auto-select model</em></MenuItem>
                {availableModels.map(m => (
                  <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={aiGenerating || !aiDesc.trim()}
            startIcon={aiGenerating ? <CircularProgress size={14} color="inherit" /> : <WandSparkles size={14} />}
          >
            {aiGenerating ? 'Generating…' : 'Generate Grader'}
          </Button>

          {aiError && <Alert severity="error">{aiError}</Alert>}

          {aiResult && (
            <Box>
              <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                GENERATED GRADER
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5, bgcolor: '#1e1e1e', borderRadius: 1,
                  fontFamily: 'monospace', fontSize: '0.78rem', color: '#d4d4d4',
                  whiteSpace: 'pre', overflowX: 'auto', maxHeight: 200, overflowY: 'auto', mb: 1.5,
                }}
              >
                {JSON.stringify(aiResult, null, 2)}
              </Paper>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<CheckCircle size={14} />}
                  onClick={() => { onSave(aiResult); onClose() }}
                >
                  Use This Grader
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleUseAiResult}
                >
                  Edit in Manual Setup
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* ── Manual Setup Tab ─────────────────────────────────────────────── */}
      {activeTab === 'manual' && (<>
        {/* Left: configuration form */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>

          {/* Grader type selector */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 1 }}>
              Grader Type
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {([0, 1, 2] as GraderType[]).map((t) => (
                <Paper
                  key={t}
                  variant="outlined"
                  onClick={() => setGraderType(t)}
                  sx={{
                    p: 1.5, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 1.5,
                    borderColor: graderType === t ? 'primary.main' : 'divider',
                    bgcolor: graderType === t ? 'primary.50' : 'background.paper',
                    '&:hover': { borderColor: 'primary.main' },
                  }}
                >
                  <Box sx={{ color: graderType === t ? 'primary.main' : 'text.disabled', mt: 0.25 }}>
                    {t === 0 ? <CheckCircle size={16} /> : t === 1 ? <Sparkles size={16} /> : <Code size={16} />}
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{GRADER_TYPE_LABELS[t]}</Typography>
                    <Typography variant="caption" color="text.secondary">{GRADER_TYPE_DESCS[t]}</Typography>
                  </Box>
                </Paper>
              ))}
            </Box>
          </Box>

          <Divider />

          {/* Type-specific form */}
          {graderType === 0 && <DeterministicForm state={det} onChange={(p) => setDet((s) => ({ ...s, ...p }))} />}
          {graderType === 1 && <ModelBasedForm state={model} onChange={(p) => setModel((s) => ({ ...s, ...p }))} availableModels={availableModels} />}
          {graderType === 2 && <CodeBasedForm state={code} onChange={(p) => setCode((s) => ({ ...s, ...p }))} />}

          <Divider />

          {/* Common: name + weight */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Grader Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              size="small"
              fullWidth
              helperText="Auto-generated if blank"
            />
            <Box sx={{ minWidth: 120 }}>
              <InfoTooltip helpKey="GRADER_WEIGHT" label="Weight" sx={{ mb: 0.5 }} />
              <TextField
                value={weight}
                onChange={(e) => setWeight(parseFloat(e.target.value) || 1)}
                size="small"
                type="number"
                fullWidth
                inputProps={{ min: 0.1, max: 10, step: 0.5 }}
              />
            </Box>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
        </Box>

        {/* Right: JSON preview */}
        <Box sx={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <JsonPreview config={config} />
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
            This JSON will be appended to the Graders Config array in the task form.
            Advanced users can edit it directly in the textarea.
          </Typography>
        </Box>
      </>)}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} startIcon={<CheckCircle size={14} />}>
          Add Grader
        </Button>
      </DialogActions>
    </Dialog>
  )
}
