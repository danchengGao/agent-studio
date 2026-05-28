import { create } from 'zustand'
import axios from 'axios'
import { getAuthToken } from '@/utils/authUtils'
import { getDefaultSpaceId } from '@/utils/spaceUtils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomMetricDef {
  name: string
  description?: string
  code: string
  /** The builder type used to create this metric (filtered_pass | percentile | error_rate | custom) */
  metric_type?: string
}

export interface EvaluationSuite {
  evaluation_id: string
  suite_name: string
  description?: string
  space_id: string
  config?: {
    custom_metrics?: CustomMetricDef[]
    [key: string]: unknown
  }
  create_time: number
  update_time: number
}

export interface EvaluationTask {
  task_id: string
  evaluation_id: string
  task_name: string
  description?: string
  tags?: string[]
  pattern_type?: string       // legacy single value — read-only for backward compat
  pattern_types?: string[]    // new: array of pattern checks (replaces pattern_type)
  trials: number
  input_data?: Record<string, unknown>
  expected_output?: Record<string, unknown>
  graders_config?: Array<Record<string, unknown>>
  create_time: number
}

export interface EvaluationRun {
  run_id: string
  evaluation_id: string
  workflow_id?: string
  workflow_version?: string
  workflow_name?: string
  agent_id?: string
  agent_version?: string
  agent_name?: string
  status: string
  metrics?: Record<string, unknown>
  start_time?: number
  end_time?: number
  create_time: number
}

export interface TaskResult {
  result_id: string
  task_id: string
  task_name?: string
  trial_number: number
  passed: boolean | null
  score: number | null
  grader_results?: Array<Record<string, unknown>>
  latency_ms?: number
  token_usage?: Record<string, number>
  error_message?: string
  trace_id?: string
}

export interface EvaluationResults {
  run_id: string
  evaluation_id: string
  status: string
  workflow_id?: string
  workflow_name?: string
  agent_id?: string
  agent_name?: string
  metrics?: {
    // Trial-level pass/fail
    success_rate: number
    passed: number
    total_results: number
    error_rate?: number
    // Task-level pass stats
    total_tasks?: number
    task_pass_rate?: number
    tasks_fully_passed_rate?: number
    tasks_never_passed_rate?: number
    // Score stats
    avg_score?: number
    median_score?: number
    score_std?: number
    score_min?: number
    score_max?: number
    // Latency
    avg_latency_ms: number
    total_latency_ms: number
    median_latency_ms?: number
    p75_latency_ms?: number
    p95_latency_ms?: number
    min_latency_ms?: number
    max_latency_ms?: number
    latency_std_ms?: number
    latency_cv?: number
    // Sampling
    pass_at_k?: Record<string, number>
    pass_pow_k?: Record<string, number>
    // Token usage
    token_usage?: Record<string, number>
    custom_metrics?: Record<string, number | { value?: number; error?: string; [key: string]: unknown }>
    // Extended metrics
    perfect_score_rate?: number
    score_distribution?: Record<string, number>
    tokens_per_trial?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    tokens_efficiency?: {
      passed?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
      failed?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    }
    per_grader_breakdown?: Record<string, { pass_rate: number; avg_score: number; count: number }>
    flakiness?: number | null
    // Regression/anomaly alerts (set by harness after comparing to previous run)
    alerts?: Array<{
      type: 'regression' | 'anomaly'
      metric: string
      severity: 'high' | 'medium' | 'low'
      message: string
      previous_run_id: string
      previous_value: number
      current_value: number
      delta: number
    }>
  }
  task_results: TaskResult[]
}

export interface BenchmarkInfo {
  file_name: string
  suite_name: string
  description: string
  task_count: number
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const BASE = '/api/v1/evaluation'

function headers() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface EvaluationState {
  suites: EvaluationSuite[]
  tasks: EvaluationTask[]
  runs: EvaluationRun[]
  currentResults: EvaluationResults | null
  benchmarks: BenchmarkInfo[]
  loading: boolean
  error: string | null

  // Suite actions
  fetchSuites: () => Promise<void>
  createSuite: (name: string, description?: string) => Promise<EvaluationSuite | null>
  updateSuite: (evaluationId: string, name: string, description?: string) => Promise<void>
  updateSuiteConfig: (evaluationId: string, config: EvaluationSuite['config']) => Promise<void>
  deleteSuite: (evaluationId: string) => Promise<void>

  // Task actions
  fetchTasks: (evaluationId: string) => Promise<void>
  addTask: (evaluationId: string, task: Omit<EvaluationTask, 'create_time' | 'evaluation_id'>) => Promise<void>
  updateTask: (evaluationId: string, task: Omit<EvaluationTask, 'create_time' | 'evaluation_id'>) => Promise<void>
  deleteTask: (evaluationId: string, taskId: string) => Promise<void>

  // Run actions
  deleteRun: (runId: string) => Promise<void>
  startRun: (params: {
    evaluationId: string
    workflowId?: string
    workflowVersion?: string
    workflowName?: string
    agentId?: string
    agentVersion?: string
    agentName?: string
    taskIds?: string[]
    parallel?: boolean
  }) => Promise<string | null>
  fetchRuns: (evaluationId: string) => Promise<void>

  // Results
  fetchResults: (runId: string) => Promise<void>
  pollResults: (runId: string, intervalMs?: number) => () => void

  // Benchmarks
  fetchBenchmarks: () => Promise<void>
  importBenchmark: (fileName: string, suiteName?: string) => Promise<string | null>

  clearError: () => void
}

export const useEvaluationStore = create<EvaluationState>((set, get) => ({
  suites: [],
  tasks: [],
  runs: [],
  currentResults: null,
  benchmarks: [],
  loading: false,
  error: null,

  // ── Suite actions ──────────────────────────────────────────────────────────

  fetchSuites: async () => {
    const spaceId = getDefaultSpaceId()
    set({ loading: true, error: null })
    try {
      const res = await axios.get(`${BASE}/list`, {
        params: { space_id: spaceId },
        headers: headers(),
      })
      const data = res.data?.data
      set({ suites: data?.evaluations ?? [], loading: false })
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  createSuite: async (name, description) => {
    const spaceId = getDefaultSpaceId()
    set({ loading: true, error: null })
    try {
      const res = await axios.post(
        `${BASE}/create`,
        { suite_name: name, description, space_id: spaceId },
        { headers: headers() }
      )
      if (res.data?.code === 200) {
        await get().fetchSuites()
        return res.data.data as EvaluationSuite
      }
      throw new Error(res.data?.message ?? 'Failed to create suite')
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
      return null
    }
  },

  updateSuite: async (evaluationId, name, description) => {
    const spaceId = getDefaultSpaceId()
    set({ loading: true, error: null })
    try {
      await axios.put(
        `${BASE}/update`,
        { evaluation_id: evaluationId, space_id: spaceId, suite_name: name, description: description ?? null },
        { headers: headers() }
      )
      set((s) => ({
        suites: s.suites.map((suite) =>
          suite.evaluation_id === evaluationId
            ? { ...suite, suite_name: name, description: description }
            : suite
        ),
        loading: false,
      }))
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  updateSuiteConfig: async (evaluationId, config) => {
    const spaceId = getDefaultSpaceId()
    try {
      await axios.put(
        `${BASE}/update`,
        { evaluation_id: evaluationId, space_id: spaceId, config },
        { headers: headers() }
      )
      set((s) => ({
        suites: s.suites.map((suite) =>
          suite.evaluation_id === evaluationId ? { ...suite, config } : suite
        ),
      }))
    } catch (e: unknown) {
      set({ error: (e as Error).message })
    }
  },

  deleteSuite: async (evaluationId) => {
    const spaceId = getDefaultSpaceId()
    set({ loading: true, error: null })
    try {
      await axios.delete(`${BASE}/${evaluationId}`, {
        params: { space_id: spaceId },
        headers: headers(),
      })
      set((s) => ({ suites: s.suites.filter((s) => s.evaluation_id !== evaluationId), loading: false }))
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  // ── Task actions ───────────────────────────────────────────────────────────

  fetchTasks: async (evaluationId) => {
    const spaceId = getDefaultSpaceId()
    set({ loading: true, error: null })
    try {
      const res = await axios.get(`${BASE}/task/list`, {
        params: { evaluation_id: evaluationId, space_id: spaceId },
        headers: headers(),
      })
      set({ tasks: res.data?.data ?? [], loading: false })
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  addTask: async (evaluationId, task) => {
    set({ loading: true, error: null })
    try {
      await axios.post(
        `${BASE}/task/add`,
        {
          evaluation_id: evaluationId,
          task: {
            ...task,
            graders: task.graders_config ?? [],
            input: task.input_data ?? {},
            expected_outcome: task.expected_output,
          },
        },
        { headers: headers() }
      )
      await get().fetchTasks(evaluationId)
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  updateTask: async (evaluationId, task) => {
    set({ loading: true, error: null })
    try {
      await axios.put(
        `${BASE}/task/update`,
        {
          evaluation_id: evaluationId,
          task: {
            ...task,
            graders: task.graders_config ?? [],
            input: task.input_data ?? {},
            expected_outcome: task.expected_output,
          },
        },
        { headers: headers() }
      )
      await get().fetchTasks(evaluationId)
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  deleteTask: async (evaluationId, taskId) => {
    const spaceId = getDefaultSpaceId()
    set({ loading: true, error: null })
    try {
      await axios.delete(`${BASE}/task/delete`, {
        params: { evaluation_id: evaluationId, task_id: taskId, space_id: spaceId },
        headers: headers(),
      })
      set((s) => ({ tasks: s.tasks.filter((t) => t.task_id !== taskId), loading: false }))
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  // ── Run actions ────────────────────────────────────────────────────────────

  deleteRun: async (runId) => {
    const spaceId = getDefaultSpaceId()
    set({ loading: true, error: null })
    try {
      await axios.delete(`${BASE}/run/delete`, {
        params: { run_id: runId, space_id: spaceId },
        headers: headers(),
      })
      set((s) => ({ runs: s.runs.filter((r) => r.run_id !== runId), loading: false }))
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  startRun: async ({ evaluationId, workflowId, workflowVersion, workflowName, agentId, agentVersion, agentName, taskIds, parallel }) => {
    const spaceId = getDefaultSpaceId()
    set({ loading: true, error: null })
    try {
      const res = await axios.post(
        `${BASE}/run/start`,
        {
          evaluation_id: evaluationId,
          space_id: spaceId,
          workflow_id: workflowId,
          workflow_version: workflowVersion,
          workflow_name: workflowName,
          agent_id: agentId,
          agent_version: agentVersion,
          agent_name: agentName,
          task_ids: taskIds,
          parallel: parallel ?? false,
        },
        { headers: headers() }
      )
      set({ loading: false })
      return res.data?.data?.run_id ?? null
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
      return null
    }
  },

  fetchRuns: async (evaluationId) => {
    const spaceId = getDefaultSpaceId()
    set({ loading: true, error: null })
    try {
      const res = await axios.get(`${BASE}/run/list`, {
        params: { evaluation_id: evaluationId, space_id: spaceId },
        headers: headers(),
      })
      set({ runs: res.data?.data ?? [], loading: false })
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  // ── Results ────────────────────────────────────────────────────────────────

  fetchResults: async (runId) => {
    const spaceId = getDefaultSpaceId()
    set({ loading: true, error: null })
    try {
      const res = await axios.get(`${BASE}/results/${runId}`, {
        params: { space_id: spaceId },
        headers: headers(),
      })
      set({ currentResults: res.data?.data ?? null, loading: false })
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  pollResults: (runId, intervalMs = 3000) => {
    const interval = setInterval(async () => {
      await get().fetchResults(runId)
      const status = get().currentResults?.status
      if (status === '2' || status === '3' || status === '4') {
        // completed, failed, or cancelled
        clearInterval(interval)
      }
    }, intervalMs)
    return () => clearInterval(interval)
  },

  // ── Benchmarks ─────────────────────────────────────────────────────────────

  fetchBenchmarks: async () => {
    set({ loading: true, error: null })
    try {
      const res = await axios.get(`${BASE}/benchmarks/list`, { headers: headers() })
      set({ benchmarks: res.data?.data?.benchmarks ?? [], loading: false })
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  importBenchmark: async (fileName, suiteName) => {
    const spaceId = getDefaultSpaceId()
    set({ loading: true, error: null })
    try {
      const res = await axios.post(
        `${BASE}/benchmarks/import`,
        { file_name: fileName, space_id: spaceId, suite_name: suiteName },
        { headers: headers() }
      )
      if (res.data?.code === 200) {
        await get().fetchSuites()
        set({ loading: false })
        return res.data.data?.evaluation_id ?? null
      }
      throw new Error(res.data?.message ?? 'Import failed')
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
      return null
    }
  },

  clearError: () => set({ error: null }),
}))
