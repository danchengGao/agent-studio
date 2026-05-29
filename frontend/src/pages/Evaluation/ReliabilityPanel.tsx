import React from 'react'
import {
  Alert, Box, Card, CardContent, Chip, Grid, IconButton, LinearProgress,
  Link, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tooltip, Typography,
} from '@mui/material'
import {
  Activity, AlertTriangle, BarChart2, BookOpen, CheckCircle, Eye,
  HelpCircle, Shield, Target, TrendingUp,
} from 'lucide-react'

interface Props {
  results: any
}

// Subtle tinted backgrounds — light enough that black text is always readable
const BG = {
  success: 'rgba(46,125,50,0.07)',
  warning: 'rgba(237,108,2,0.07)',
  error:   'rgba(211,47,47,0.07)',
}

function scoreBg(score: number) {
  if (score >= 0.8) return BG.success
  if (score >= 0.5) return BG.warning
  return BG.error
}

function scoreColor(score: number): 'success' | 'warning' | 'error' {
  if (score >= 0.8) return 'success'
  if (score >= 0.5) return 'warning'
  return 'error'
}

// Small "?" icon with rich tooltip
function MetricHelp({ text }: { text: string }) {
  return (
    <Tooltip
      title={<Typography variant="caption" sx={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>{text}</Typography>}
      arrow
      placement="top"
      componentsProps={{ tooltip: { sx: { maxWidth: 340, p: 1.5 } } }}
    >
      <IconButton size="small" sx={{ p: 0.25, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}>
        <HelpCircle size={13} />
      </IconButton>
    </Tooltip>
  )
}

// Metric name cell with optional help icon
function MetricCell({ name, help }: { name: string; help: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
      <Typography variant="body2" fontFamily="monospace">{name}</Typography>
      <MetricHelp text={help} />
    </Box>
  )
}

// ── Tooltip texts ─────────────────────────────────────────────────────────────

const HELP = {
  overall: `Overall Reliability (ℛ) is a weighted geometric mean of Consistency (40 %), Robustness (35 %), and Predictability (25 %).\n\nSafety is tracked separately as a hard constraint and is NOT included in this score.\n\n≥ 0.8 — Excellent\n0.5–0.8 — Moderate\n< 0.5 — Needs improvement`,

  consistency: `Consistency (ℛCon) measures how stable the agent's behaviour is across repeated runs of the same task.\n\nIt is the mean of four sub-metrics: outcome consistency, two trajectory consistency scores, and resource consistency.\n\nHigh score → the agent behaves the same way every time it runs.`,

  robustness: `Robustness (ℛRob) measures how well the agent performs when inputs are deliberately perturbed.\n\nIt is the mean of three scores: fault injection, environment changes, and prompt paraphrasing.\n\nHigh score → the agent handles variations and unexpected inputs gracefully.`,

  predictability: `Predictability (ℛPred) measures how well the agent's confidence scores reflect its actual accuracy (calibration).\n\nIt is the mean of Pcal, PAUROC, and Pbrier.\n\nHigh score → when the agent says it is confident, it is usually correct.`,

  safety: `Safety (ℛSaf) measures constraint compliance.\n\nIt is the mean of compliance rate (Scomp) and harm avoidance (Sharm).\n\nReported separately because safety violations are a hard constraint — even a single violation is significant regardless of the overall score.`,

  // Consistency sub-metrics
  cout: `Outcome Consistency (Cout)\n\nMeasures the fraction of trials that produce the same pass/fail result across repeated nominal runs.\n\nFormula: 1 − Var(pass/fail outcomes)\nExample: if 8 out of 10 runs pass, Cout ≈ 0.96\n\nHigh Cout → the agent reliably produces the same correctness level every time.`,

  ctrajD: `Trajectory Consistency — Distributional (Ctraj-d)\n\nCompares how often the same types of actions appear across trials using Jensen-Shannon divergence on action-frequency distributions.\n\nIt does NOT care about order — only that the agent uses the same mix of tools/components.\n\nHigh score → consistent tool usage patterns across runs.`,

  ctrajS: `Trajectory Consistency — Sequence (Ctraj-s)\n\nCompares the sequential order of actions using Longest Common Subsequence (LCS) similarity.\n\nUnlike Ctraj-d, this cares about ORDER — the agent should follow the same step-by-step path.\n\nHigh score → the agent takes the same ordered steps every time.`,

  cres: `Resource Consistency (Cres)\n\nMeasures stability of latency (ms) and token usage across trials using the Coefficient of Variation (CV).\n\nFormula: 1 − CV, where CV = std / mean\n\nHigh score → predictable, stable resource consumption with little run-to-run variance.`,

  // Robustness sub-metrics
  rfault: `Fault Injection Robustness (Rfault)\n\nRatio of accuracy under injected faults to baseline (nominal) accuracy.\n\nFaults are synthetic errors injected into tool responses (e.g., a tool randomly returning an error).\n\nFormula: acc_fault / acc_nominal (capped at 1.0)\nHigh score → the agent handles tool failures without losing overall accuracy.`,

  renv: `Environment Robustness (Renv)\n\nRatio of accuracy under changed environmental conditions to baseline accuracy.\n\nEnvironment changes can include altered context, different data in the workspace, or modified system state.\n\nFormula: acc_env / acc_nominal (capped at 1.0)\nHigh score → the agent adapts well to contextual changes.`,

  rprompt: `Prompt Robustness (Rprompt)\n\nRatio of accuracy when the input prompt is paraphrased to baseline accuracy.\n\nTests whether the agent is sensitive to superficial wording changes in the task description.\n\nFormula: acc_prompt / acc_nominal (capped at 1.0)\nHigh score → the agent is not sensitive to how a task is worded.`,

  // Predictability sub-metrics
  pcal: `Calibration (Pcal)\n\nMeasures whether the agent's stated confidence scores match its actual accuracy.\n\nPerfect calibration: when the agent says "70 % confident", it is correct exactly 70 % of the time.\n\nFormula: 1 − ECE (Expected Calibration Error)\nHigh score → confidence scores are trustworthy and interpretable.`,

  pauroc: `Discrimination / AUROC (PAUROC)\n\nArea Under the Receiver Operating Characteristic Curve.\n\nMeasures how well confidence scores separate correct from incorrect outcomes.\n\n0.5 = random (confidence is useless)\n1.0 = perfect separation\n\nHigh score → the agent's confidence reliably distinguishes right from wrong answers.`,

  pbrier: `Brier Score — inverted (Pbrier)\n\nMeasures mean squared error between confidence scores and binary correctness.\n\nFormula: 1 − BrierScore  (so higher is better)\nBrierScore = mean((confidence − correct)²)\n\nHigh score → confidence scores are both accurate and sharp (not just well-calibrated, but also decisive).`,

  // Safety sub-metrics
  scomp: `Compliance Rate (Scomp)\n\nFraction of trials that completed with ZERO safety-constraint violations.\n\n1.0 = fully compliant on every run\n0.0 = every run had at least one violation\n\nThis is a strict binary measure — any violation counts, regardless of severity.`,

  sharm: `Harm Avoidance Score (Sharm)\n\nMeasures average violation severity across ALL trials (including safe ones).\n\nSeverity weights: low = 0.25 · medium = 0.5 · high = 1.0\nFormula: 1 − mean_severity\n\nHigh score → violations that do occur are minor. Combined with Scomp, this gives a full picture of safety.`,

  violations: `Violation Rate\n\nPercentage of trials that had at least one safety constraint triggered.\n\n0 % is ideal. Any value above 0 % means the agent sometimes crosses defined safety boundaries.\n\nLower is strictly better — this metric has no grey zone.`,
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ReliabilityPanel({ results }: Props) {
  const m = results.metrics || {}

  const hasReliability = m.reliability_overall !== undefined

  if (!hasReliability) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          Reliability metrics are not available for this evaluation run.
          <br />
          Ensure the evaluation was run with perturbations and confidence tracking enabled.
        </Alert>
      </Box>
    )
  }

  const rOverall = m.reliability_overall ?? 0
  const rCon     = m.reliability_consistency_overall ?? 0
  const rRob     = m.reliability_robustness_overall ?? 0
  const rPred    = m.reliability_predictability_overall ?? 0
  const rSaf     = m.reliability_safety_overall ?? 0

  const cout   = m.reliability_consistency_outcome ?? 0
  const ctrajD = m.reliability_consistency_trajectory_distribution ?? 0
  const ctrajS = m.reliability_consistency_trajectory_sequence ?? 0
  const cres   = m.reliability_consistency_resource ?? 0

  const rfault       = m.reliability_robustness_fault ?? 0
  const renv         = m.reliability_robustness_env ?? 0
  const rprompt      = m.reliability_robustness_prompt ?? 0
  const robAccuracies = m.reliability_robustness_accuracies || {}

  const pcal   = m.reliability_predictability_calibration ?? 0
  const pauroc = m.reliability_predictability_auroc ?? 0
  const pbrier = m.reliability_predictability_brier ?? 0

  const scomp        = m.reliability_safety_compliance ?? 0
  const sharm        = m.reliability_safety_harm ?? 0
  const violationRate = m.reliability_safety_violation_rate ?? 0
  const avgSeverity  = m.reliability_safety_avg_severity ?? 0

  const fmt  = (v: number) => v.toFixed(3)
  const pct  = (v: number) => `${(v * 100).toFixed(1)}%`

  // Section header with icon + title + optional help
  function SectionHeader({
    icon, label, help,
  }: { icon: React.ReactNode; label: string; help: string }) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
        {icon}
        <Typography variant="h6">{label}</Typography>
        <MetricHelp text={help} />
      </Box>
    )
  }

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>

      {/* Overall Reliability Score */}
      <Card
        variant="outlined"
        sx={{
          bgcolor: scoreBg(rOverall),
          borderColor: `${scoreColor(rOverall)}.main`,
          borderWidth: 2,
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Target
              size={32}
              color={rOverall >= 0.8 ? '#2e7d32' : rOverall >= 0.5 ? '#e65100' : '#c62828'}
            />
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="overline" color="text.secondary">
                  Overall Reliability (ℛ)
                </Typography>
                <MetricHelp text={HELP.overall} />
              </Box>
              <Typography variant="h3" fontWeight={700}>{fmt(rOverall)}</Typography>
              <Typography variant="caption" color="text.secondary">
                Weighted geometric mean of consistency (40 %), robustness (35 %), and predictability (25 %)
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Paper attribution */}
      <Paper
        variant="outlined"
        sx={{
          display: 'flex', alignItems: 'flex-start', gap: 1.5,
          px: 2, py: 1.5,
          bgcolor: 'rgba(25,118,210,0.04)',
          borderColor: 'rgba(25,118,210,0.25)',
        }}
      >
        <BookOpen size={18} color="#1976d2" style={{ marginTop: 2, flexShrink: 0 }} />
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.5 }}>
            <strong>Methodology based on: </strong>
            <Link
              href="https://arxiv.org/abs/2602.16666"
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              sx={{ fontWeight: 600 }}
            >
              "Towards a Science of AI Agent Reliability"
            </Link>
            {' '}(arXiv:2602.16666)
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
            The twelve metrics across the four dimensions — Consistency, Robustness, Predictability, and Safety —
            are derived directly from this work, which argues that a single accuracy score is insufficient and
            proposes a holistic reliability profile grounded in safety-critical engineering principles.
          </Typography>
        </Box>
      </Paper>

      {/* Dimension Cards */}
      <Grid container spacing={2}>
        {[
          { label: 'Consistency', sym: 'ℛCon', val: rCon, icon: <Activity size={20} color="#1976d2" />, help: HELP.consistency },
          { label: 'Robustness',  sym: 'ℛRob', val: rRob, icon: <Shield    size={20} color="#388e3c" />, help: HELP.robustness },
          { label: 'Predictability', sym: 'ℛPred', val: rPred, icon: <Eye  size={20} color="#f57c00" />, help: HELP.predictability },
          { label: 'Safety',      sym: 'ℛSaf', val: rSaf, icon: <AlertTriangle size={20} color="#d32f2f" />, help: HELP.safety },
        ].map(({ label, sym, val, icon, help }) => (
          <Grid item xs={12} sm={6} md={3} key={sym}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mb: 1 }}>
                  <Box sx={{ mt: 0.3, flexShrink: 0 }}>{icon}</Box>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="subtitle1" fontWeight={600} lineHeight={1.2}>{label}</Typography>
                    <Typography variant="caption" color="text.secondary" fontFamily="monospace">{sym}</Typography>
                  </Box>
                  <MetricHelp text={help} />
                </Box>
                <Typography variant="h4" fontWeight={700} color={`${scoreColor(val)}.main`}>
                  {fmt(val)}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={val * 100}
                  color={scoreColor(val)}
                  sx={{ my: 1, height: 6, borderRadius: 3 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {label === 'Consistency'    && 'Stability across repeated runs'}
                  {label === 'Robustness'     && 'Performance under perturbations'}
                  {label === 'Predictability' && 'Confidence calibration quality'}
                  {label === 'Safety'         && 'Constraint compliance (reported separately)'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Consistency Sub-metrics */}
      <Box>
        <SectionHeader icon={<Activity size={18} />} label="Consistency Breakdown" help={HELP.consistency} />
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Metric</TableCell>
                <TableCell>Score</TableCell>
                <TableCell>Description</TableCell>
                <TableCell sx={{ width: 200 }}>Progress</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[
                { name: 'Cout',    val: cout,   help: HELP.cout,   desc: 'Outcome consistency across trials' },
                { name: 'Ctraj-d', val: ctrajD, help: HELP.ctrajD, desc: 'Trajectory consistency (distributional)' },
                { name: 'Ctraj-s', val: ctrajS, help: HELP.ctrajS, desc: 'Trajectory consistency (sequence order)' },
                { name: 'Cres',    val: cres,   help: HELP.cres,   desc: 'Resource usage consistency (latency & tokens)' },
              ].map(({ name, val, help, desc }) => (
                <TableRow key={name}>
                  <TableCell><MetricCell name={name} help={help} /></TableCell>
                  <TableCell><Chip label={fmt(val)} size="small" color={scoreColor(val)} /></TableCell>
                  <TableCell><Typography variant="caption">{desc}</Typography></TableCell>
                  <TableCell>
                    <LinearProgress variant="determinate" value={val * 100} color={scoreColor(val)} sx={{ height: 6, borderRadius: 3 }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Robustness Sub-metrics */}
      <Box>
        <SectionHeader icon={<Shield size={18} />} label="Robustness Breakdown" help={HELP.robustness} />
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Metric</TableCell>
                <TableCell>Score</TableCell>
                <TableCell>Baseline Acc</TableCell>
                <TableCell>Perturbed Acc</TableCell>
                <TableCell>Description</TableCell>
                <TableCell sx={{ width: 180 }}>Progress</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[
                { name: 'Rfault', val: rfault, help: HELP.rfault, pertKey: 'fault_injected',  desc: 'Robustness to fault injection' },
                { name: 'Renv',   val: renv,   help: HELP.renv,   pertKey: 'env_perturbed',   desc: 'Robustness to environment changes' },
                { name: 'Rprompt',val: rprompt,help: HELP.rprompt,pertKey: 'prompt_perturbed', desc: 'Robustness to prompt paraphrasing' },
              ].map(({ name, val, help, pertKey, desc }) => (
                <TableRow key={name}>
                  <TableCell><MetricCell name={name} help={help} /></TableCell>
                  <TableCell><Chip label={fmt(val)} size="small" color={scoreColor(val)} /></TableCell>
                  <TableCell><Typography variant="caption">{pct(robAccuracies.nominal ?? 0)}</Typography></TableCell>
                  <TableCell><Typography variant="caption">{pct(robAccuracies[pertKey] ?? 0)}</Typography></TableCell>
                  <TableCell><Typography variant="caption">{desc}</Typography></TableCell>
                  <TableCell>
                    <LinearProgress variant="determinate" value={val * 100} color={scoreColor(val)} sx={{ height: 6, borderRadius: 3 }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Predictability Sub-metrics */}
      <Box>
        <SectionHeader icon={<Eye size={18} />} label="Predictability Breakdown" help={HELP.predictability} />
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Metric</TableCell>
                <TableCell>Score</TableCell>
                <TableCell>Description</TableCell>
                <TableCell sx={{ width: 200 }}>Progress</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[
                { name: 'Pcal',   val: pcal,   help: HELP.pcal,   desc: 'Calibration — confidence matches accuracy' },
                { name: 'PAUROC', val: pauroc, help: HELP.pauroc, desc: 'Discrimination — separates correct from incorrect' },
                { name: 'Pbrier', val: pbrier, help: HELP.pbrier, desc: 'Brier score — overall sharpness + accuracy' },
              ].map(({ name, val, help, desc }) => (
                <TableRow key={name}>
                  <TableCell><MetricCell name={name} help={help} /></TableCell>
                  <TableCell><Chip label={fmt(val)} size="small" color={scoreColor(val)} /></TableCell>
                  <TableCell><Typography variant="caption">{desc}</Typography></TableCell>
                  <TableCell>
                    <LinearProgress variant="determinate" value={val * 100} color={scoreColor(val)} sx={{ height: 6, borderRadius: 3 }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Safety Sub-metrics */}
      <Box>
        <SectionHeader icon={<AlertTriangle size={18} />} label="Safety Breakdown" help={HELP.safety} />
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Metric</TableCell>
                <TableCell>Score</TableCell>
                <TableCell>Description</TableCell>
                <TableCell sx={{ width: 200 }}>Progress</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell><MetricCell name="Scomp" help={HELP.scomp} /></TableCell>
                <TableCell><Chip label={fmt(scomp)} size="small" color={scoreColor(scomp)} /></TableCell>
                <TableCell>
                  <Typography variant="caption">Compliance — {pct(scomp)} of trials had no violations</Typography>
                </TableCell>
                <TableCell>
                  <LinearProgress variant="determinate" value={scomp * 100} color={scoreColor(scomp)} sx={{ height: 6, borderRadius: 3 }} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell><MetricCell name="Sharm" help={HELP.sharm} /></TableCell>
                <TableCell><Chip label={fmt(sharm)} size="small" color={scoreColor(sharm)} /></TableCell>
                <TableCell>
                  <Typography variant="caption">Harm avoidance — avg severity {avgSeverity.toFixed(3)}</Typography>
                </TableCell>
                <TableCell>
                  <LinearProgress variant="determinate" value={sharm * 100} color={scoreColor(sharm)} sx={{ height: 6, borderRadius: 3 }} />
                </TableCell>
              </TableRow>
              <TableRow
                sx={{ bgcolor: violationRate > 0 ? BG.error : 'transparent' }}
              >
                <TableCell><MetricCell name="Violations" help={HELP.violations} /></TableCell>
                <TableCell>
                  <Chip
                    label={pct(violationRate)}
                    size="small"
                    color={violationRate > 0 ? 'error' : 'success'}
                    icon={violationRate > 0 ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="caption">
                    {violationRate > 0 ? 'Constraint violations detected' : 'No violations detected'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <LinearProgress
                    variant="determinate"
                    value={(1 - violationRate) * 100}
                    color={violationRate > 0 ? 'error' : 'success'}
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Interpretation Guide */}
      <Alert severity="info" icon={<BarChart2 size={18} />}>
        <Typography variant="subtitle2" gutterBottom>Score Thresholds</Typography>
        <Typography variant="caption" component="div">
          • <strong>≥ 0.8</strong> — Excellent (green) — reliable, production-ready behaviour<br />
          • <strong>0.5–0.8</strong> — Moderate (amber) — some variance; investigate sub-metrics<br />
          • <strong>&lt; 0.5</strong> — Poor (red) — significant instability; not production-ready<br />
          <br />
          Hover the <strong>?</strong> icons next to any metric for a detailed explanation and formula.{' '}
          Full methodology:{' '}
          <Link
            href="https://arxiv.org/abs/2602.16666"
            target="_blank"
            rel="noopener noreferrer"
            variant="caption"
            underline="hover"
          >
            arXiv:2602.16666
          </Link>
        </Typography>
      </Alert>

    </Box>
  )
}
