import { useEffect, useState } from 'react'
import axios from 'axios'
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material'
import {
  Activity,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  Scale,
  ShieldCheck,
  Shuffle,
  Star,
  StarOff,
  TrendingDown,
  TrendingUp,
  X,
  AlertTriangle,
  Info,
  Lightbulb,
} from 'lucide-react'
import { getAuthToken } from '@/utils/authUtils'
import { getDefaultSpaceId } from '@/utils/spaceUtils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Insight {
  severity: 'good' | 'warn' | 'bad' | 'info'
  icon: string
  title: string
  body: string
}

interface FailingSample {
  task_id: string
  task_name: string
  failure_reason: string
  grader_names: string[]
}

interface ExplainData {
  headline: string
  summary: string
  insights: Insight[]
  top_fails: FailingSample[]
  recommendations: string[]
  data_quality_warnings: string[]
}

// ─── Icon lookup ──────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, JSX.Element> = {
  TrendingUp:   <TrendingUp size={18} />,
  TrendingDown: <TrendingDown size={18} />,
  Star:         <Star size={18} />,
  StarOff:      <StarOff size={18} />,
  Shuffle:      <Shuffle size={18} />,
  Activity:     <Activity size={18} />,
  ShieldCheck:  <ShieldCheck size={18} />,
  Scale:        <Scale size={18} />,
  Clock:        <Clock size={18} />,
  Cpu:          <Cpu size={18} />,
}

function resolveIcon(name: string): JSX.Element {
  return ICON_MAP[name] ?? <Info size={18} />
}

// ─── Severity styling ─────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<Insight['severity'], string> = {
  good: '#2e7d32',
  warn: '#e65100',
  bad:  '#c62828',
  info: '#1565c0',
}

const SEVERITY_BG: Record<Insight['severity'], string> = {
  good: '#f1f8e9',
  warn: '#fff3e0',
  bad:  '#ffebee',
  info: '#e3f2fd',
}

const SEVERITY_CHIP_COLOR: Record<Insight['severity'], 'success' | 'warning' | 'error' | 'info'> = {
  good: 'success',
  warn: 'warning',
  bad:  'error',
  info: 'info',
}

// ─── Insight card ─────────────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: Insight }) {
  const color = SEVERITY_COLOR[insight.severity]
  const bg    = SEVERITY_BG[insight.severity]
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderLeft: `4px solid ${color}`,
        bgcolor: bg,
        mb: 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ color, mt: 0.25, flexShrink: 0 }}>{resolveIcon(insight.icon)}</Box>
        <Box>
          <Typography variant="body2" fontWeight={700} sx={{ color }}>
            {insight.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
            {insight.body}
          </Typography>
        </Box>
      </Box>
    </Paper>
  )
}

// ─── Failing task row ─────────────────────────────────────────────────────────

function FailRow({ fail }: { fail: FailingSample }) {
  return (
    <ListItem
      dense
      disableGutters
      sx={{
        flexDirection: 'column',
        alignItems: 'flex-start',
        py: 0.75,
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' }}>
        <ListItemIcon sx={{ minWidth: 24 }}>
          <ChevronRight size={14} color="#c62828" />
        </ListItemIcon>
        <ListItemText
          primary={
            <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 320 }}>
              {fail.task_name}
            </Typography>
          }
          secondary={
            <Typography variant="caption" color="text.secondary">
              {fail.failure_reason}
            </Typography>
          }
        />
      </Box>
      {fail.grader_names.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', pl: 3, mt: 0.5 }}>
          {fail.grader_names.slice(0, 4).map((g) => (
            <Chip key={g} label={g} size="small" variant="outlined" color="error" sx={{ fontSize: '0.65rem', height: 18 }} />
          ))}
          {fail.grader_names.length > 4 && (
            <Typography variant="caption" color="text.secondary">
              +{fail.grader_names.length - 4} more
            </Typography>
          )}
        </Box>
      )}
    </ListItem>
  )
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <Typography
      variant="overline"
      sx={{ fontSize: '0.65rem', letterSpacing: 1.2, color: 'text.disabled', display: 'block', mb: 1 }}
    >
      {children}
    </Typography>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface ExplainResultsModalProps {
  open: boolean
  onClose: () => void
  runId: string
}

export default function ExplainResultsModal({ open, onClose, runId }: ExplainResultsModalProps) {
  const [data, setData]       = useState<ExplainData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    setData(null)

    const spaceId = getDefaultSpaceId()
    const token   = getAuthToken()
    const hdrs    = token ? { Authorization: `Bearer ${token}` } : {}

    axios
      .get(`/api/v1/evaluation/run/${runId}/explain`, {
        params:  { space_id: spaceId },
        headers: hdrs,
      })
      .then((res) => {
        if (res.data?.code === 200) {
          setData(res.data.data as ExplainData)
        } else {
          setError(res.data?.message ?? 'Unexpected response from server')
        }
      })
      .catch((e) => setError(e.message ?? 'Network error'))
      .finally(() => setLoading(false))
  }, [open, runId])

  // Count severity groups
  const badCount  = data?.insights.filter((i) => i.severity === 'bad').length  ?? 0
  const warnCount = data?.insights.filter((i) => i.severity === 'warn').length ?? 0
  const goodCount = data?.insights.filter((i) => i.severity === 'good').length ?? 0

  const headlineColor =
    data == null     ? 'text.primary' :
    badCount > 0     ? '#c62828'      :
    warnCount > 0    ? '#e65100'      :
    '#2e7d32'

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
        <Lightbulb size={20} style={{ color: '#1565c0' }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" fontWeight={700}>Explain Results</Typography>
          <Typography variant="caption" color="text.secondary">
            Heuristic analysis of this evaluation run
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 2 }}>

        {/* ── Loading ─────────────────────────────────────────────────── */}
        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 2 }}>
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary">Analysing results…</Typography>
          </Box>
        )}

        {/* ── Error ───────────────────────────────────────────────────── */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* ── Content ─────────────────────────────────────────────────── */}
        {data && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

            {/* Headline + summary */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Typography variant="h6" fontWeight={700} sx={{ color: headlineColor }}>
                {data.headline}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {data.summary}
              </Typography>

              {/* Quick severity tally */}
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.5 }}>
                {goodCount > 0 && (
                  <Chip
                    icon={<CheckCircle2 size={12} />}
                    label={`${goodCount} good`}
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                )}
                {warnCount > 0 && (
                  <Chip
                    icon={<AlertTriangle size={12} />}
                    label={`${warnCount} warning${warnCount > 1 ? 's' : ''}`}
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                )}
                {badCount > 0 && (
                  <Chip
                    icon={<AlertTriangle size={12} />}
                    label={`${badCount} issue${badCount > 1 ? 's' : ''}`}
                    size="small"
                    color="error"
                    variant="outlined"
                  />
                )}
              </Box>
            </Box>

            <Divider />

            {/* Data quality warnings */}
            {data.data_quality_warnings.length > 0 && (
              <Box>
                {data.data_quality_warnings.map((w, i) => (
                  <Alert key={i} severity="warning" sx={{ mb: 1, py: 0.5 }}>
                    <Typography variant="caption">{w}</Typography>
                  </Alert>
                ))}
              </Box>
            )}

            {/* Insights */}
            {data.insights.length > 0 && (
              <Box>
                <SectionLabel>Insights ({data.insights.length})</SectionLabel>
                {/* Sort: bad → warn → good → info */}
                {[...data.insights]
                  .sort((a, b) => {
                    const order = { bad: 0, warn: 1, good: 2, info: 3 }
                    return order[a.severity] - order[b.severity]
                  })
                  .map((insight, i) => (
                    <InsightCard key={i} insight={insight} />
                  ))
                }
              </Box>
            )}

            {/* Top failing tasks */}
            {data.top_fails.length > 0 && (
              <>
                <Divider />
                <Box>
                  <SectionLabel>Top failing tasks</SectionLabel>
                  <Paper variant="outlined" sx={{ px: 1 }}>
                    <List dense disablePadding>
                      {data.top_fails.map((fail) => (
                        <FailRow key={fail.task_id} fail={fail} />
                      ))}
                    </List>
                  </Paper>
                </Box>
              </>
            )}

            {/* Recommendations */}
            {data.recommendations.length > 0 && (
              <>
                <Divider />
                <Box>
                  <SectionLabel>Recommendations</SectionLabel>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {data.recommendations.map((rec, i) => (
                      <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                        <Box sx={{ color: '#1565c0', mt: 0.25, flexShrink: 0 }}>
                          <ChevronRight size={14} />
                        </Box>
                        <Typography variant="body2" color="text.primary" sx={{ lineHeight: 1.6 }}>
                          {rec}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </>
            )}

          </Box>
        )}
      </DialogContent>
    </Dialog>
  )
}
