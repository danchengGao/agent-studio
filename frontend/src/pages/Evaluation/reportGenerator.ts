import { EvaluationResults, TaskResult } from '@/stores/useEvaluationStore'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${(n * 100).toFixed(1)}%`
}

function ms(n: number | null | undefined): string {
  if (n == null || n === 0) return '—'
  return n >= 1000 ? `${(n / 1000).toFixed(2)}s` : `${Math.round(n)}ms`
}

function fmtTokens(n: number | null | undefined): string {
  if (n == null) return '—'
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function esc(s: unknown): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function passedBool(r: TaskResult): boolean {
  return r.passed === true || (r.passed as unknown) === 1
}
function failedBool(r: TaskResult): boolean {
  return r.passed === false || (r.passed as unknown) === 0
}

function colorClass(val: number | null | undefined, hi = 0.8, lo = 0.5): string {
  if (val == null) return ''
  return val >= hi ? 'good' : val >= lo ? 'warn' : 'bad'
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #212121; background: #fafafa; padding: 32px; }
  h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
  h2 { font-size: 0.75rem; font-weight: 700; margin: 28px 0 10px; color: #9e9e9e; letter-spacing: 0.1em; text-transform: uppercase; }
  .meta { font-size: 0.8rem; color: #757575; margin-bottom: 24px; }
  .meta span { margin-right: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.82rem; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
  th { background: #f5f5f5; font-weight: 600; text-align: left; padding: 8px 12px; border-bottom: 1px solid #e0e0e0; color: #424242; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
  td { padding: 7px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .pass { color: #2e7d32; font-weight: 700; }
  .fail { color: #c62828; font-weight: 700; }
  .badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; }
  .badge-pass { background: #e8f5e9; color: #2e7d32; }
  .badge-fail { background: #ffebee; color: #c62828; }
  .badge-pending { background: #f5f5f5; color: #757575; }
  .num { font-variant-numeric: tabular-nums; }
  .mono { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 0.75rem; }
  .error-cell { color: #c62828; font-size: 0.75rem; max-width: 280px; white-space: pre-wrap; word-break: break-word; }
  .footer { margin-top: 40px; font-size: 0.72rem; color: #9e9e9e; text-align: right; }
  .metric-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; margin-bottom: 4px; }
  .metric-card { background: #fff; border-radius: 8px; padding: 12px 14px; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
  .metric-label { font-size: 0.70rem; color: #757575; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .metric-value { font-size: 1.15rem; font-weight: 700; color: #212121; }
  .metric-value.good { color: #2e7d32; }
  .metric-value.warn { color: #e65100; }
  .metric-value.bad  { color: #c62828; }
  .na { color: #bdbdbd; font-style: italic; }

  /* ── Traces section ── */
  .task-group { margin-bottom: 24px; }
  .task-header { display: flex; align-items: center; gap: 8px; padding: 6px 0 8px; font-size: 0.9rem; flex-wrap: wrap; }
  .task-header strong { font-size: 0.95rem; }
  .dim { color: #9e9e9e; font-size: 0.75rem; font-family: monospace; }
  .chip { display: inline-block; padding: 1px 7px; border-radius: 12px; font-size: 0.68rem; background: #eeeeee; color: #424242; margin: 0 1px; }
  .chip-outline { background: transparent; border: 1px solid #bdbdbd; color: #616161; }
  .chip-pass { border-color: #2e7d32; color: #2e7d32; }
  .chip-fail { border-color: #c62828; color: #c62828; }
  .chip-warn { border-color: #e65100; color: #e65100; }
  .trial-details { margin-bottom: 6px; border: 1px solid #e0e0e0; border-radius: 6px; background: #fff; overflow: hidden; }
  .trial-details[open] { box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .trial-summary { cursor: pointer; list-style: none; display: flex; align-items: center; gap: 8px; padding: 8px 12px; font-size: 0.82rem; flex-wrap: wrap; user-select: none; }
  .trial-summary::-webkit-details-marker { display: none; }
  .trial-summary::before { content: '▶'; font-size: 0.6rem; color: #9e9e9e; transition: transform 0.15s; flex-shrink: 0; }
  .trial-details[open] > .trial-summary::before { transform: rotate(90deg); }
  .trial-icon-pass { color: #2e7d32; font-weight: 700; }
  .trial-icon-fail { color: #c62828; font-weight: 700; }
  .trial-icon-pending { color: #9e9e9e; }
  .trace-id { margin-left: auto; font-family: monospace; font-size: 0.7rem; color: #9e9e9e; }
  .trial-body { padding: 0 12px 12px; border-top: 1px solid #f0f0f0; }
  .error-banner { margin: 10px 0 8px; padding: 8px 10px; background: #fff8f8; border: 1px solid #ef9a9a; border-radius: 4px; }
  .error-banner strong { display: block; color: #c62828; font-size: 0.75rem; margin-bottom: 4px; }
  .error-banner pre { color: #c62828; font-size: 0.72rem; white-space: pre-wrap; word-break: break-word; font-family: monospace; margin: 0; }
  .output-section { margin: 10px 0 8px; }
  .section-label { font-size: 0.72rem; font-weight: 600; color: #757575; margin-bottom: 4px; }
  .output-box { font-size: 0.75rem; font-family: monospace; white-space: pre-wrap; word-break: break-word; padding: 8px 10px; border-radius: 4px; max-height: 180px; overflow-y: auto; margin: 0; border: 1px solid; }
  .output-pass { background: rgba(46,125,50,0.06); border-color: #a5d6a7; }
  .output-fail { background: rgba(198,40,40,0.06); border-color: #ef9a9a; }
  .grader-table { margin: 6px 0 0; }
  .grader-table th { font-size: 0.65rem; padding: 5px 8px; }
  .grader-table td { padding: 5px 8px; font-size: 0.75rem; }
  .grader-row-pass { background: rgba(46,125,50,0.04); }
  .grader-row-fail { background: rgba(198,40,40,0.04); }
  .grader-icon-pass { color: #2e7d32; font-weight: 700; }
  .grader-icon-fail { color: #c62828; font-weight: 700; }
  .good { color: #2e7d32; }
  .bad  { color: #c62828; }
  .warn { color: #e65100; }
  .good-text { color: #1b5e20; }
  .bad-text  { color: #b71c1c; }
  .warn-text { color: #bf360c; }
  .detail-row { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 2px; }
  .detail-key { min-width: 60px; flex-shrink: 0; color: #757575; font-size: 0.68rem; padding-top: 1px; }
  .detail-val { white-space: pre-wrap; word-break: break-word; margin: 0; font-family: monospace; font-size: 0.68rem; color: #212121; }
  .token-chips { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px; }
  .no-graders { font-size: 0.72rem; color: #bdbdbd; font-style: italic; margin-top: 8px; }
`

// ─── Section builder ──────────────────────────────────────────────────────────

function metricSection(
  title: string,
  cards: Array<{ label: string; value: string; cls?: string } | null>,
): string {
  const visible = cards.filter(Boolean) as Array<{ label: string; value: string; cls?: string }>
  if (visible.length === 0) return ''
  const cardsHtml = visible.map(({ label, value, cls }) => `
    <div class="metric-card">
      <div class="metric-label">${esc(label)}</div>
      <div class="metric-value${cls ? ` ${cls}` : ''}">${esc(value)}</div>
    </div>
  `).join('')
  return `<h2>${esc(title)}</h2><div class="metric-grid">${cardsHtml}</div>`
}

// ─── Main generator ───────────────────────────────────────────────────────────

export function generateHtmlReport(
  results: EvaluationResults,
  runLabel: string,
): string {
  const m = results.metrics
  const generated = new Date().toLocaleString()

  const targetStr = results.workflow_name
    ? `Workflow: ${results.workflow_name}`
    : results.workflow_id
      ? `Workflow: ${results.workflow_id.slice(0, 12)}…`
      : results.agent_name
        ? `Agent: ${results.agent_name}`
        : results.agent_id
          ? `Agent: ${results.agent_id.slice(0, 12)}…`
          : 'Unknown target'

  const passed = m?.passed ?? 0
  const total = m?.total_results ?? 0
  const failed = total - passed
  const hasTaskReliability = m != null && m.total_tasks != null && m.total_tasks > 0 && m.total_tasks < m.total_results

  // ── Accuracy section (mirrors Overview tab) ──────────────────────────────────
  const accuracyHtml = metricSection('Accuracy', [
    { label: 'Success Rate', value: pct(m?.success_rate), cls: colorClass(m?.success_rate) },
    { label: 'Passed / Total', value: m ? `${passed} / ${total}` : '—' },
    { label: 'Failed', value: String(failed), cls: failed > 0 ? 'bad' : '' },
    m?.avg_score != null ? { label: 'Avg Score', value: pct(m.avg_score), cls: colorClass(m.avg_score) } : null,
  ])

  // ── Reliability section (mirrors Overview tab) ───────────────────────────────
  const consistencyVal = m?.score_std == null ? null
    : m.score_std <= 0.05 ? `${pct(m.score_std)} (high)`
    : m.score_std <= 0.15 ? `${pct(m.score_std)} (med)`
    : `${pct(m.score_std)} (low)`
  const consistencyCls = m?.score_std == null ? '' : m.score_std <= 0.05 ? 'good' : m.score_std <= 0.15 ? 'warn' : 'bad'

  const reliabilityHtml = metricSection('Reliability', [
    m?.flakiness != null ? { label: 'Flakiness', value: m.flakiness.toFixed(3), cls: m.flakiness <= 0.05 ? 'good' : m.flakiness <= 0.2 ? 'warn' : 'bad' } : null,
    consistencyVal != null ? { label: 'Consistency', value: consistencyVal, cls: consistencyCls } : null,
    hasTaskReliability && m!.tasks_fully_passed_rate != null ? { label: 'Always Pass (rate)', value: pct(m!.tasks_fully_passed_rate), cls: colorClass(m!.tasks_fully_passed_rate, 0.8, 0.4) } : null,
    hasTaskReliability && (m?.tasks_never_passed_rate ?? 0) > 0 ? { label: 'Never Pass (rate)', value: pct(m!.tasks_never_passed_rate), cls: 'bad' } : null,
  ])

  // ── Tasks section (mirrors Tasks tab — computed from task_results) ────────────
  const taskSummaryHtml = (() => {
    if (results.task_results.length === 0) return ''
    const taskMap: Record<string, TaskResult[]> = {}
    for (const r of results.task_results) {
      if (!taskMap[r.task_id]) taskMap[r.task_id] = []
      taskMap[r.task_id].push(r)
    }
    const taskIds = Object.keys(taskMap)
    const taskTotal = taskIds.length
    let taskPassed = 0, alwaysPass = 0, neverPass = 0
    for (const id of taskIds) {
      const taskTrials = taskMap[id]
      const passCount = taskTrials.filter(passedBool).length
      if (passCount > 0) taskPassed++
      if (passCount === taskTrials.length) alwaysPass++
      if (passCount === 0) neverPass++
    }
    const multiTrial = results.task_results.reduce((max, r) => Math.max(max, r.trial_number), 0) > 1
    return metricSection('Tasks', [
      { label: 'Total Tasks', value: String(taskTotal) },
      { label: 'Tasks Passed', value: `${taskPassed} / ${taskTotal}`, cls: colorClass(taskPassed / taskTotal) },
      multiTrial ? { label: 'Always Pass', value: String(alwaysPass), cls: alwaysPass > 0 ? 'good' : '' } : null,
      multiTrial ? { label: 'Never Pass', value: String(neverPass), cls: neverPass > 0 ? 'bad' : '' } : null,
    ])
  })()

  // ── Accuracy detail section (mirrors Analysis tab) ───────────────────────────
  const accuracyDetailHtml = metricSection('Accuracy Detail', [
    (m?.error_rate ?? 0) > 0 ? { label: 'Error Rate', value: pct(m!.error_rate), cls: 'bad' } : null,
    m?.median_score != null ? { label: 'Median Score', value: pct(m.median_score), cls: colorClass(m.median_score) } : null,
    m?.perfect_score_rate != null ? { label: 'Perfect (1.0)', value: pct(m.perfect_score_rate), cls: colorClass(m.perfect_score_rate, 0.5, 0.2) } : null,
  ])

  // ── Performance section ─────────────────────────────────────────────────────
  const cvLabel = (!m?.latency_cv || m.latency_cv === 0) ? null
    : m.latency_cv <= 0.2 ? `${pct(m.latency_cv)} (low)`
    : m.latency_cv <= 0.5 ? `${pct(m.latency_cv)} (med)`
    : `${pct(m.latency_cv)} (high)`
  const cvCls = (!m?.latency_cv || m.latency_cv === 0) ? ''
    : m.latency_cv <= 0.2 ? 'good' : m.latency_cv <= 0.5 ? 'warn' : 'bad'

  const performanceHtml = metricSection('Performance', [
    { label: 'Avg Latency', value: ms(m?.avg_latency_ms) },
    m?.p95_latency_ms ? { label: 'p95 Latency', value: ms(m.p95_latency_ms) } : null,
    cvLabel != null ? { label: 'Latency CV', value: cvLabel, cls: cvCls } : null,
    m?.token_usage?.total_tokens ? { label: 'Total Tokens', value: fmtTokens(m.token_usage.total_tokens) } : null,
    m?.tokens_per_trial?.total_tokens ? { label: 'Avg Tokens / Trial', value: fmtTokens(m.tokens_per_trial.total_tokens) } : null,
  ])

  // ── Sampling section (pass@k / pass^k) ─────────────────────────────────────
  const passAtK = m?.pass_at_k
  const passPowK = m?.pass_pow_k
  const hasPassAtK = !!(passAtK && Object.keys(passAtK).length)
  const trialsPerTask = (m?.total_tasks && m.total_tasks > 0)
    ? Math.round((m.total_results ?? 1) / m.total_tasks)
    : (m?.total_results ?? 1)

  const samplingHtml = hasPassAtK ? (() => {
    const ks = Array.from(
      new Set([...Object.keys(passAtK!), ...Object.keys(passPowK ?? {})].map(Number).sort((a, b) => a - b))
    )
    const rows = ks.map(k => {
      const applicable = trialsPerTask >= k
      const atK = passAtK![String(k)]
      const powK = passPowK?.[String(k)]
      const naCell = `<td class="na" colspan="2">N/A — requires ≥${k} trials</td>`
      const valCells = `
        <td class="num ${colorClass(atK)}">${pct(atK)}</td>
        <td class="num ${colorClass(powK)}">${pct(powK)}</td>
      `
      return `<tr><td class="mono">k=${k}</td>${applicable ? valCells : naCell}</tr>`
    }).join('')
    return `
      <h2>Sampling (pass@k / pass^k)</h2>
      <table>
        <thead><tr><th>k</th><th>pass@k — at least 1 passes</th><th>pass^k — all pass</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size:0.72rem;color:#9e9e9e;margin-top:6px">Trials per task: ${trialsPerTask}</p>
    `
  })() : ''

  // ── Custom Metrics section ──────────────────────────────────────────────────
  const customMetrics = m?.custom_metrics
  const hasCustom = !!(customMetrics && Object.keys(customMetrics).length)

  const customHtml = hasCustom ? (() => {
    const rows = Object.entries(customMetrics!).map(([name, val]) => {
      const isErr = typeof val === 'object' && val !== null && 'error' in val
      let display: string
      let cls = ''
      if (isErr) {
        display = `<span class="bad">${esc(String((val as { error: string }).error))}</span>`
      } else if (typeof val === 'number') {
        display = val >= 0 && val <= 1 ? pct(val) : val.toFixed(4)
        cls = val >= 0 && val <= 1 ? colorClass(val) : ''
      } else if (typeof val === 'object' && val !== null && 'value' in val && typeof (val as { value: unknown }).value === 'number') {
        const v = (val as { value: number }).value
        display = v >= 0 && v <= 1 ? pct(v) : v.toFixed(4)
        cls = v >= 0 && v <= 1 ? colorClass(v) : ''
      } else {
        display = `<span class="mono">${esc(JSON.stringify(val))}</span>`
      }
      return `<tr><td class="mono">${esc(name)}</td><td class="num ${cls}">${display}</td></tr>`
    }).join('')
    return `
      <h2>Custom Metrics</h2>
      <table>
        <thead><tr><th>Metric</th><th>Value</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `
  })() : ''

  // ── Grader breakdown ────────────────────────────────────────────────────────
  const graderBreakdown = m?.per_grader_breakdown ?? {}
  const hasGraders = Object.keys(graderBreakdown).length > 0

  const graderHtml = hasGraders ? `
    <h2>Grader Breakdown</h2>
    <table>
      <thead>
        <tr><th>Grader</th><th>Pass Rate</th><th>Avg Score</th><th>Trials</th></tr>
      </thead>
      <tbody>
        ${Object.entries(graderBreakdown).map(([name, { pass_rate, avg_score, count }]) => `
          <tr>
            <td class="mono">${esc(name)}</td>
            <td class="${colorClass(pass_rate)} num">${pct(pass_rate)}</td>
            <td class="num">${pct(avg_score)}</td>
            <td class="num">${count}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''

  // ── Traces (mirrors TraceViewer: grouped by task, per-trial accordions) ────
  const taskHtml = (() => {
    if (results.task_results.length === 0) return ''

    function fmtVal(v: unknown): string {
      if (v === null || v === undefined) return '—'
      if (typeof v === 'object') return JSON.stringify(v, null, 2)
      return String(v)
    }

    // Group by task_id, sort trials within each group
    const taskMap = new Map<string, TaskResult[]>()
    const taskOrder: string[] = []
    for (const r of [...results.task_results].sort((a, b) => {
      const na = a.task_name ?? a.task_id
      const nb = b.task_name ?? b.task_id
      return na !== nb ? na.localeCompare(nb) : a.trial_number - b.trial_number
    })) {
      if (!taskMap.has(r.task_id)) { taskMap.set(r.task_id, []); taskOrder.push(r.task_id) }
      taskMap.get(r.task_id)!.push(r)
    }

    const taskGroupsHtml = taskOrder.map(taskId => {
      const trials = taskMap.get(taskId)!
      const passedCount = trials.filter(passedBool).length
      const total = trials.length
      const displayName = trials[0]?.task_name || taskId
      const passChipClass = passedCount === total ? 'chip-pass' : passedCount === 0 ? 'chip-fail' : 'chip-warn'

      const trialsHtml = trials.map(r => {
        const p = passedBool(r)
        const f = failedBool(r)
        const graderResults = (r.grader_results ?? []) as Array<Record<string, unknown>>
        const gradersPassedCount = graderResults.filter(g => Boolean(g.passed)).length

        // Find workflow output from output_check grader
        const firstOutputGrader = (
          graderResults.find(g => g.check_type === 'output_check') ??
          graderResults.find(g => (g.details as Record<string, unknown>)?.actual !== undefined)
        )
        const actualOutput = (firstOutputGrader?.details as Record<string, unknown> | undefined)?.actual

        const latencyStr = r.latency_ms != null
          ? r.latency_ms >= 1000 ? `${(r.latency_ms / 1000).toFixed(2)}s` : `${r.latency_ms}ms`
          : null
        const tokensStr = r.token_usage?.total_tokens != null ? `${r.token_usage.total_tokens} tok` : null
        const badgeClass = p ? 'badge-pass' : f ? 'badge-fail' : 'badge-pending'
        const badgeLabel = p ? 'PASS' : f ? 'FAIL' : 'PENDING'
        const iconClass = p ? 'trial-icon-pass' : f ? 'trial-icon-fail' : 'trial-icon-pending'
        const iconChar = p ? '✓' : f ? '✗' : '?'

        // Grader rows
        const graderRowsHtml = graderResults.map((g, idx) => {
          const gPassed = Boolean(g.passed)
          const gScore = g.score != null ? Number(g.score) : null
          const gName = (g.grader_name as string) ?? `grader_${idx}`
          const gType = (g.grader_type as string) ?? ''
          const gCheckType = (g.check_type as string) ?? ''
          const details = (g.details as Record<string, unknown>) ?? {}
          const errorMsg = (g.error as string) ?? null

          let detailsHtml = ''
          if (errorMsg) {
            detailsHtml = `<span class="warn-text">⚠ ${esc(errorMsg)}</span>`
          } else {
            const parts: string[] = []
            if ('expected' in details)
              parts.push(`<div class="detail-row"><span class="detail-key">Expected:</span><pre class="detail-val">${esc(fmtVal(details.expected))}</pre></div>`)
            if ('actual' in details)
              parts.push(`<div class="detail-row"><span class="detail-key">Actual:</span><pre class="detail-val ${gPassed ? 'good-text' : 'bad-text'}">${esc(fmtVal(details.actual))}</pre></div>`)
            if ('condition' in details)
              parts.push(`<div class="detail-row"><span class="detail-key">Condition:</span><pre class="detail-val dim">${esc(fmtVal(details.condition))}</pre></div>`)
            for (const [k, v] of Object.entries(details).filter(([k]) => !['expected', 'actual', 'condition'].includes(k)))
              parts.push(`<div class="detail-row"><span class="detail-key">${esc(k)}:</span><pre class="detail-val">${esc(fmtVal(v))}</pre></div>`)
            detailsHtml = parts.join('') || '<span class="na">—</span>'
          }

          return `
            <tr class="${gPassed ? 'grader-row-pass' : 'grader-row-fail'}">
              <td class="${gPassed ? 'grader-icon-pass' : 'grader-icon-fail'}" style="width:24px;padding:5px 6px">${gPassed ? '✓' : '✗'}</td>
              <td>
                <strong>${esc(gName)}</strong>
                ${gType ? `<span class="chip" style="margin-left:4px">${esc(gType)}</span>` : ''}
                ${gCheckType ? `<span class="chip chip-outline" style="margin-left:2px">${esc(gCheckType)}</span>` : ''}
              </td>
              <td class="${gPassed ? 'good' : 'bad'}" style="font-weight:700;width:60px">${gScore != null ? `${(gScore * 100).toFixed(0)}%` : '—'}</td>
              <td>${detailsHtml}</td>
            </tr>`
        }).join('')

        const tokenChips = r.token_usage && Object.keys(r.token_usage).length > 0
          ? `<div class="token-chips">${Object.entries(r.token_usage).map(([k, v]) => `<span class="chip chip-outline">${esc(k.replace(/_/g, ' '))}: ${v}</span>`).join('')}</div>`
          : ''

        return `
          <details class="trial-details">
            <summary class="trial-summary">
              <span class="${iconClass}">${iconChar}</span>
              <strong>Trial #${r.trial_number}</strong>
              <span class="badge ${badgeClass}">${badgeLabel}</span>
              ${graderResults.length > 0 ? `<span class="chip chip-outline ${passedBool(r) ? 'chip-pass' : 'chip-fail'}">${gradersPassedCount}/${graderResults.length} graders passed</span>` : ''}
              ${latencyStr ? `<span class="chip chip-outline">⚡ ${esc(latencyStr)}</span>` : ''}
              ${tokensStr ? `<span class="chip chip-outline">◈ ${esc(tokensStr)}</span>` : ''}
              ${r.trace_id ? `<span class="trace-id">${esc(r.trace_id.slice(0, 12))}…</span>` : ''}
            </summary>
            <div class="trial-body">
              ${r.error_message ? `
                <div class="error-banner">
                  <strong>Execution Error</strong>
                  <pre>${esc(r.error_message)}</pre>
                </div>` : ''}
              ${actualOutput !== undefined && actualOutput !== null ? `
                <div class="output-section">
                  <div class="section-label">Workflow Output</div>
                  <pre class="output-box ${p ? 'output-pass' : 'output-fail'}">${esc(fmtVal(actualOutput))}</pre>
                </div>` : ''}
              ${graderResults.length > 0 ? `
                <div class="section-label" style="margin-top:10px">Grader Details</div>
                <table class="grader-table">
                  <thead><tr><th style="width:24px"></th><th>Grader</th><th style="width:60px">Score</th><th>Expected / Actual / Details</th></tr></thead>
                  <tbody>${graderRowsHtml}</tbody>
                </table>` : (!r.error_message ? `<p class="no-graders">No grader results — trial may still be running or had no graders configured.</p>` : '')}
              ${tokenChips}
            </div>
          </details>`
      }).join('')

      return `
        <div class="task-group">
          <div class="task-header">
            <strong>${esc(displayName)}</strong>
            ${displayName !== taskId ? `<span class="dim mono">(${esc(taskId)})</span>` : ''}
            <span class="chip chip-outline ${passChipClass}">${passedCount}/${total} passed</span>
          </div>
          ${trialsHtml}
        </div>`
    }).join('')

    return `<h2>Traces</h2>${taskGroupsHtml}`
  })()

  // ── Assemble ─────────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Evaluation Report — ${esc(runLabel)}</title>
  <style>${CSS}</style>
</head>
<body>
  <h1>Evaluation Report</h1>
  <div class="meta">
    <span><strong>Target:</strong> ${esc(targetStr)}</span>
    <span><strong>Run:</strong> <span class="mono">${esc(results.run_id.slice(0, 16))}…</span></span>
    <span><strong>Status:</strong> ${esc(results.status === '2' ? 'Completed' : results.status === '3' ? 'Failed' : results.status)}</span>
    <span><strong>Generated:</strong> ${esc(generated)}</span>
  </div>

  ${accuracyHtml}
  ${reliabilityHtml}
  ${taskSummaryHtml}
  ${accuracyDetailHtml}
  ${performanceHtml}
  ${samplingHtml}
  ${customHtml}
  ${graderHtml}
  ${taskHtml}

  <div class="footer">Generated by OpenJiuwen Evaluation &nbsp;·&nbsp; ${esc(generated)}</div>
</body>
</html>`
}

// ─── CSV exporter ─────────────────────────────────────────────────────────────

export function generateCsv(results: EvaluationResults): string {
  const escCsv = (v: unknown): string => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }

  const headers = [
    'task_name', 'task_id', 'trial_number', 'passed', 'score',
    'latency_ms', 'total_tokens', 'prompt_tokens', 'completion_tokens', 'error_message',
  ]

  const rows = results.task_results.map(r => [
    r.task_name ?? r.task_id,
    r.task_id,
    r.trial_number,
    r.passed == null ? '' : (r.passed === true || (r.passed as unknown) === 1) ? 'true' : 'false',
    r.score ?? '',
    r.latency_ms ?? '',
    r.token_usage?.total_tokens ?? '',
    r.token_usage?.prompt_tokens ?? '',
    r.token_usage?.completion_tokens ?? '',
    r.error_message ?? '',
  ].map(escCsv).join(','))

  return [headers.join(','), ...rows].join('\n')
}

// ─── Download trigger ─────────────────────────────────────────────────────────

export function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
