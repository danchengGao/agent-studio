# Evaluation Glossary

Quick reference for every metric, concept, and configuration option.

---

## Core Concepts

### Evaluation Suite
A named container that groups related test tasks. Think of it as a test folder. Each suite targets one workflow or agent.

### Task
One test case. Defines the input sent to the agent, the expected output, and the graders that score the result. A suite contains one or more tasks.

### Trial
A single independent run of one task. Running 3 trials means the task is executed 3 times independently — no shared state between them.

### Run
An execution of an entire suite against a specific workflow or agent. A run produces a result for every task × trial combination.

### Grader
A check applied to a trial's output. Each task can have multiple graders. Graders return a score (0.0–1.0) and a pass/fail decision.

### Benchmark
A pre-built evaluation suite for a standard agent pattern (routing, RAG, code generation, etc.). Load one from the suite chooser to get started quickly.

---

## Result Metrics

### Success Rate
Percentage of tasks where at least one trial passed all graders. The primary overall health number.

> Example: 8 out of 10 tasks passed → 80% success rate.

### pass@k
Probability that at least 1 of k trials succeeds. Measures capability ("can it do it at all?").

> Example: pass@3 = 90% → if you run 3 trials, at least one will pass 90% of the time.

**Formula**: `1 − (fail_rate)^k`

### pass^k (pass-power-k)
Probability that ALL k trials succeed. Measures strictest reliability ("does it always work?").

> Example: pass^5 = 10% → only 1 in 10 batches of 5 will all pass. Indicates low consistency.

**Formula**: `(success_rate)^k`

### Flakiness
How inconsistent results are across trials. 0.0 = perfectly stable (same input always gives same outcome). 0.5 = essentially random.

| Value | Meaning |
|-------|---------|
| < 0.1 | Very stable — production ready |
| 0.1–0.3 | Some variance — monitor |
| > 0.3 | Highly unpredictable — investigate |

### avg_score
Mean quality score (0–100%) across all trials, including failures. Useful for spotting near-misses: 60% success but 85% avg score means the agent is close; 60% success with 40% avg score means it's failing badly.

### median_score
50th percentile score. Less affected by extreme outliers than the average.

### perfect_score_rate
Fraction of trials that scored exactly 1.0 (perfect). High pass rate + high perfect rate = excellent.

### score_std
Standard deviation of scores. Low (<5%) = consistent quality. High (>15%) = quality swings unpredictably between runs.

### error_rate
Fraction of trials that crashed with a system error (exception, timeout). Should be near 0% in production. Different from grader failures.

### avg_latency_ms
Mean execution time per trial in milliseconds.

### p95_latency_ms
95th-percentile latency. 95% of your users will experience this or faster. Plan capacity around this, not the average.

### token_usage
Total LLM tokens consumed (prompt + completion). Multiply by your LLM pricing to estimate cost.

### per_grader_breakdown
Pass rate and average score for each grader individually. When overall pass rate is low, this shows *which* grader is failing.

---

## Task Configuration

### trials
How many times to run this task independently. More trials = more reliable statistics.

| Trials | Use case |
|--------|---------|
| 1 | Quick smoke test |
| 3 | Standard reliability check (enables pass@k) |
| 5–10 | Accurate statistical measurement |

### pattern_type
Which workflow structure to validate. Leave blank to skip pattern validation and only check output.

| Value | Pattern |
|-------|---------|
| Routing | IF/switch component used |
| Chaining | ≥ 2 sequential steps |
| Parallelization | Concurrent execution |
| Orchestrator-Worker | Sub-workflow called |
| Evaluator-Optimizer | Loop component used |
| Memory Usage | Variables read/written |

### tags
Custom labels for filtering and grouping tasks. Example: `regression`, `smoke-test`, `edge-case`. Use with Custom Metrics to compute scores by segment.

### input_data
JSON object sent to the workflow/agent as input. Must match what your workflow expects.

### expected_output
What a correct response looks like. Used by deterministic graders to compare actual output.

---

## Grader Types

### Deterministic Grader (type 0)
Rule-based. Instant, free, reproducible. Best for objective checks: exact values, numeric ranges, regex, tool usage.

### Model-Based Grader (type 1)
Uses an LLM as judge. Flexible — evaluates tone, quality, reasoning. Slower and costs tokens. Write a **rubric** describing what "good" looks like.

### Code-Based Grader (type 2)
Custom Python function with full control. Define `def grade(trace, expected):` returning `{"passed": bool, "score": float}`.

---

## Grader Options

### weight
How much this grader affects the final score (default 1.0). Higher = more important. Final score = weighted average across all graders.

### passing_score (model grader)
Score threshold to mark the trial as passed (0.0–1.0). Recommended: 0.7 for quality, 0.9 for strict requirements.

### rubric (model grader)
Plain-language description of what a good response looks like. Be specific — include must-have elements and examples.

### condition (deterministic grader)
How to compare expected vs actual value.

| Condition | Meaning |
|-----------|---------|
| `eq` | Exact match |
| `ne` | Not equal |
| `gt` / `lt` | Greater / less than |
| `contains` | String contains substring |
| `regex` | Matches regular expression |
| `is_not_empty` | Output exists and is not blank |

### path
Dot-separated path to a field in the output. Example: `result` reads `output["result"]`, `data.user.email` reads nested values.

---

## Custom Metrics

User-defined Python functions computed once per run across all trial results. They produce aggregate numbers that appear in the **Custom Metrics** tab.

```python
def compute(results):
    # results: list of dicts with keys:
    #   task_id, passed, score, latency_ms,
    #   token_usage, error_message, grader_results
    high_quality = sum(
        1 for r in results
        if r.get("passed") and r.get("score", 0) > 0.85
    )
    return high_quality / len(results) if results else 0.0
```

Return a **float 0–1** (shown as %) or any JSON-serialisable value. Floats are colour-coded: green ≥ 80%, orange ≥ 50%, red below.

---

## Run Status

| Status | Meaning |
|--------|---------|
| Pending | Queued, not started yet |
| Running | Tasks are executing |
| Completed | All tasks finished |
| Failed | Run crashed before completing |

---

## Reliability Tab

A deep diagnostic view that computes a holistic reliability profile based on the paper *"Towards a Science of AI Agent Reliability"* ([arXiv:2602.16666](https://arxiv.org/abs/2602.16666)). Four dimensions are evaluated:

| Dimension | Weight | Question answered |
|-----------|--------|------------------|
| **Consistency** | 40% | Does the agent give the same result each time? |
| **Robustness** | 35% | Does it hold up under faults and variations? |
| **Predictability** | 25% | Are its confidence scores calibrated correctly? |
| **Safety** | Hard constraint | Are safety constraints respected? (not blended into score) |

**Score thresholds**: ≥ 0.8 = production-ready · 0.5–0.8 = needs investigation · < 0.5 = not ready.

### Consistency sub-metrics

| Metric | What it measures |
|--------|-----------------|
| **Outcome Consistency (Cout)** | Fraction of trials with the same pass/fail result |
| **Trajectory Distribution (Ctraj-d)** | Stability of tool usage patterns (which tools, how often) |
| **Trajectory Sequence (Ctraj-s)** | Stability of tool call ordering (step sequence similarity) |
| **Resource Consistency (Cres)** | Stability of latency and token usage (low CV = consistent) |

### Robustness sub-metrics

| Metric | What it measures |
|--------|-----------------|
| **Fault Injection (Rfault)** | Performance when tools fail with synthetic errors |
| **Environment (Renv)** | Performance when context/environment inputs change |
| **Prompt (Rprompt)** | Performance when the prompt is paraphrased |

### Predictability sub-metrics

| Metric | What it measures |
|--------|-----------------|
| **Calibration (Pcal)** | 1 − Expected Calibration Error: confidence matches accuracy |
| **AUROC (Pauroc)** | Discrimination: can confidence scores separate correct from wrong? |
| **Brier Score (Pbrier)** | 1 − BrierScore: combined calibration + discrimination |

### Safety sub-metrics

| Metric | What it measures |
|--------|-----------------|
| **Compliance Rate (Scomp)** | Fraction of trials with zero constraint violations |
| **Harm Avoidance (Sharm)** | 1 − mean violation severity (low=0.25, medium=0.5, high=1.0) |
| **Violation Rate** | % of trials that triggered at least one safety constraint |

**Requires ≥ 3 trials** to produce meaningful statistics. With only 1 trial, most sub-metrics cannot be computed.
