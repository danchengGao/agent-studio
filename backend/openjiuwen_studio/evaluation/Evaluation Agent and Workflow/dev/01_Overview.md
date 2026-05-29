# OpenJiuwen Evaluation System

A pattern-aware benchmarking and evaluation system for OpenJiuwen workflows and agents.

## Overview

The evaluation system lets you define declarative test suites, run them against workflows or agents, and measure correctness, pattern adherence, and performance across a comprehensive set of metrics.

```
Evaluation Suite → Tasks → Trials → Graders → Metrics
```

## Architecture

```
backend/openjiuwen_studio/
├── models/evaluation.py                           # DB models (5 tables)
├── schemas/evaluation.py                          # Pydantic schemas + enums
│                                                  # incl. CustomMetricDef, EvaluationUpdate
├── core/
│   ├── executor/evaluation/
│   │   ├── evaluation_harness.py                  # Run orchestrator (weighted aggregation)
│   │   ├── grader_engine.py                       # 3 grader types + weight propagation
│   │   ├── pattern_validator.py                   # 6 pattern validators
│   │   └── metrics.py                             # All aggregate metrics (see below)
│   └── manager/
│       ├── evaluation.py                          # Manager functions + suite config handling
│       └── repositories/evaluation_repository.py # DB layer
└── routers/evaluation.py                          # REST API (14 endpoints)

frontend/src/
├── pages/Evaluation/
│   ├── EvaluationPage.tsx                         # Main page + custom metrics dialog
│   ├── RunEvaluationDialog.tsx                    # Run dialog
│   ├── EvaluationResults.tsx                      # 4-tab results view
│   ├── MetricsPanel.tsx                           # Overview tab: stat cards
│   └── TraceViewer.tsx                            # Traces tab: per-trial detail
└── stores/useEvaluationStore.ts                   # Zustand state + CustomMetricDef type
```

## Quick Start

### 1. Create an evaluation suite

```bash
POST /api/v1/evaluation/create
{
  "suite_name": "My Routing Tests",
  "description": "Tests for conditional routing",
  "space_id": "your-space-id"
}
```

### 2. Add tasks

```bash
POST /api/v1/evaluation/task/add
{
  "evaluation_id": "<from step 1>",
  "task_name": "Positive sentiment routing",
  "task_definition": "...",
  "input_data": {"message": "I love this!"},
  "expected_output": {"branch": "positive"},
  "graders_config": [{...}],
  "trials": 3,
  "pattern_type": 0,
  "space_id": "your-space-id"
}
```

### 3. Run evaluation

```bash
POST /api/v1/evaluation/run/start
{
  "evaluation_id": "<suite id>",
  "workflow_id": "your-workflow-id",
  "space_id": "your-space-id"
}
# Returns run_id immediately; evaluation runs in background
```

### 4. Check results

```bash
GET /api/v1/evaluation/results/{run_id}
```

## Supported Workflow Patterns

| Pattern | Value | Detection |
|---------|-------|-----------|
| ROUTING | 0 | IF component in execution trace |
| CHAINING | 1 | ≥2 sequential component spans |
| PARALLELIZATION | 2 | Overlapping execution time windows |
| ORCHESTRATOR_WORKER | 3 | SUB_WORKFLOW component used |
| EVALUATOR_OPTIMIZER | 4 | LOOP component used |
| MEMORY_USAGE | 5 | SET_VARIABLE or VARIABLE_MERGE used |

## Metrics

All metrics are computed in `metrics.py` and returned in the run results under the `metrics` key.

### Pass / Fail

| Metric | Description |
|--------|-------------|
| `success_rate` | Fraction of total trials that passed (0.0–1.0) |
| `passed` | Raw count of passing trials |
| `total_results` | Total trials executed |
| `error_rate` | Fraction of trials that raised an execution error |
| `total_tasks` | Count of unique tasks evaluated |
| `task_pass_rate` | Fraction of unique tasks where ≥1 trial passed |
| `tasks_fully_passed_rate` | Fraction of unique tasks where all trials passed |
| `tasks_never_passed_rate` | Fraction of unique tasks where no trial ever passed |

> `total_tasks`, `task_pass_rate`, `tasks_fully_passed_rate`, and `tasks_never_passed_rate` are only shown in the GUI when `total_tasks < total_results` (i.e., multi-trial runs).

### Sampling Metrics

| Metric | Description |
|--------|-------------|
| `pass_at_k` | `{1: p, 3: p, 5: p}` — probability ≥1 of k picks passes |
| `pass_pow_k` | `{1: p, 3: p, 5: p}` — probability all k picks pass |

### Score Quality (when graders return scores)

| Metric | Description |
|--------|-------------|
| `avg_score` | Mean grader score across all trials |
| `median_score` | p50 grader score — less sensitive to outliers than the mean |
| `score_std` | Standard deviation — lower = more consistent |
| `score_min` / `score_max` | Range of scores observed |
| `perfect_score_rate` | Fraction of trials that scored exactly 1.0 |
| `score_distribution` | Histogram: fraction of trials in each 20% bucket (`0_20`, `20_40`, `40_60`, `60_80`, `80_100`) |

### Latency

| Metric | Description |
|--------|-------------|
| `avg_latency_ms` | Mean trial execution time |
| `median_latency_ms` | 50th percentile latency |
| `p75_latency_ms` | 75th percentile latency |
| `p95_latency_ms` | 95th percentile — worst-case for most trials |
| `min_latency_ms` | Fastest trial |
| `max_latency_ms` | Slowest trial |
| `total_latency_ms` | Sum of all trial latencies |
| `latency_std_ms` | Standard deviation of latency — how much execution time varies |
| `latency_cv` | Coefficient of variation (std ÷ mean) — low = predictable latency, high = erratic |

### Token Usage

| Metric | Description |
|--------|-------------|
| `token_usage` | `{prompt_tokens, completion_tokens, total_tokens}` — aggregate |
| `tokens_per_trial` | `{prompt_tokens, completion_tokens, total_tokens}` — per-trial average |
| `tokens_efficiency` | Average token usage split by outcome: `{"passed": {prompt_tokens, completion_tokens, total_tokens}, "failed": {…}}` |

### Reliability

| Metric | Description |
|--------|-------------|
| `flakiness` | Mean std-dev of pass/fail per task across trials. `0.0` = perfectly consistent, `0.5` = random. `null` when no task has multiple trials. |
| `latency_cv` | Coefficient of variation for latency (reliability angle) — measures whether execution time is predictable. |
| `tasks_never_passed_rate` | Fraction of tasks (multi-trial only) that never succeeded across any trial — identifies consistently broken tasks. |
| `tasks_fully_passed_rate` | Fraction of tasks (multi-trial only) where every trial passed — measures robustness under repeated sampling. |

### Per-Grader Breakdown

| Metric | Description |
|--------|-------------|
| `per_grader_breakdown` | `{grader_name: {pass_rate, avg_score, count}}` — aggregate per grader |

### Custom Aggregate Metrics

User-defined Python functions stored in the suite `config.custom_metrics` list. Each definition:

```json
{
  "name": "my_metric",
  "description": "Optional description",
  "code": "def compute(results):\n    return sum(r['score'] for r in results) / len(results)"
}
```

The `compute(results)` function receives the full list of trial result dicts and must return a `float` or a `dict`. Custom metrics appear in the **Metrics** tab of the results view under "Custom Metrics".

## Results UI — Tab Structure

The results view (`EvaluationResults.tsx`) has four sub-tabs:

| Tab | Content | Shown |
|-----|---------|-------|
| **Overview** | Stat cards: success rate, pass/fail counts, score, latency, tokens | Always |
| **Metrics** | pass@k / pass^k table + custom metrics table | When data exists |
| **Graders** | Per-grader pass rate, avg score, trial count | When grader data exists |
| **Traces** | Per-trial expandable detail with grader verdicts | Always |

## Benchmark Suites

Pre-built benchmark YAML files are in:
```
backend/openjiuwen_studio/marketplace/benchmarks/
├── routing_benchmark.yaml
├── chaining_benchmark.yaml
├── parallelization_benchmark.yaml
├── orchestrator_worker_benchmark.yaml
├── evaluator_optimizer_benchmark.yaml
├── memory_usage_benchmark.yaml
└── calculator_benchmark.yaml
```

Load a benchmark via the UI **Load Benchmark** button or POST the tasks via API.

## Running Tests

```bash
cd backend
pytest openjiuwen_studio/core/executor/evaluation/tests/ -v
```

The tests use a `conftest.py` that stubs the `openjiuwen` core library, so they run standalone without the full runtime.
