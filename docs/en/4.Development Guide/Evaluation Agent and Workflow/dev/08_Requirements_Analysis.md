# Requirements Analysis — Evaluation System for Agents and Workflows

---

## Source of Demand

- **Proactive Planning** — New Features / DFX Improvement
- **Product Requirements** — OpenJiuwen Product / Quality & Reliability Engineering

---

## Demand Background

### WHY

OpenJiuwen provides a powerful platform for building and running AI agents and
workflows. Teams can compose multi-step automation, use LLMs as reasoning engines,
and deploy production-grade pipelines — all from a visual builder.

However, once an agent or workflow is built, there is currently no systematic way
to measure its quality. A team that makes a prompt change, adds a new tool, or
refactors a workflow has no structured mechanism to verify that the change improved
results, that it didn't break existing behaviour, or that the workflow performs
consistently across repeated runs.

The same gap affects the six structural patterns supported by the platform (Routing,
Chaining, Parallelisation, Orchestrator-Worker, Evaluator-Optimizer, Memory Usage).
Each pattern introduces specific correctness criteria — a Routing workflow must take
the right branch, a Parallelisation workflow must actually execute steps concurrently
— but there is no tooling today to verify these properties automatically.

Three distinct problems are currently unsolved:

**1. No regression detection.**
When a workflow is updated, there is no way to know whether previously correct
behaviour still holds. Teams rely on manual spot-checking, which does not scale.

**2. No comparative measurement.**
When comparing two versions of an agent (different prompt, different model, different
tool set), there is no shared metric to objectively say which version is better.

**3. No systematic sampling.**
LLM-based outputs are non-deterministic. A single test run may pass by chance. Teams
need a way to run the same task multiple times (trials) and compute reliable probability
estimates (pass@k, pass^k) rather than relying on a single result.

The goal of this feature is to give every team building on OpenJiuwen a first-class
evaluation capability: define what "correct" means for their workflow, run it
systematically, and get actionable metrics.

### WHEN

New feature, targeted for delivery with the upcoming OpenJiuwen platform release.

### WHAT

The feature is delivered as the **Evaluation** module and consists of five
user-facing components:

---

**Component 1 — Evaluation Suites**

An evaluation suite is a named, versioned collection of test tasks. It is the top-level
organising unit. A team creates one suite per workflow or agent they want to evaluate.
Each suite stores its tasks, run history, and (optionally) custom metric functions.

---

**Component 2 — Evaluation Tasks**

A task is a single test case. It defines:
- `input_data` — the input to send to the workflow or agent
- `expected_output` — the expected result (used by deterministic graders)
- `trials` — how many independent executions to run (for sampling metrics)
- `pattern_type` — which structural pattern this task validates
- `difficulty` — Easy / Medium / Hard (for benchmark organisation)
- `graders_config` — which graders to apply and how to combine their results

Tasks can be authored individually via the UI or loaded in bulk from pre-built YAML
benchmark files.

---

**Component 3 — Grader System**

Graders evaluate the output of a single trial and return a pass/fail verdict and a
score (0.0 – 1.0). Three grader types must be supported:

| Grader Type | Description | Use case |
|---|---|---|
| Deterministic | Rule-based checks — no LLM call | Structural checks, output contains value, field comparison, tool usage, regex |
| Model-Based | LLM judge with a rubric and pass threshold | Semantic quality, coherence, task completion |
| Code-Based | Custom Python grading function | Complex business logic, JSON schema validation, cross-field conditions |

Multiple graders can be attached to a single task. The trial passes only if every
grader (with non-zero weight) passes. The aggregate score is a weighted average.
Graders with `weight: 0` are informational and do not affect the pass/fail outcome.

---

**Component 4 — Metrics Engine**

After all trials complete, the system must compute a comprehensive set of aggregate
metrics:

- **Pass/Fail:** success rate, error rate, task-level pass rates
- **Sampling:** `pass@k` (probability ≥1 of k picks passes) and `pass^k`
  (probability all k picks pass), computed for k ∈ {1, 3, 5}
- **Score quality:** mean, median, std-dev, min/max, perfect-score rate,
  score distribution histogram (5 buckets)
- **Latency:** mean, median, p75, p95, min, max, std-dev, coefficient of variation
- **Token usage:** aggregate and per-trial averages, split by pass/fail outcome
- **Reliability:** flakiness score (mean std-dev of pass/fail per task across trials),
  tasks-never-passed rate, tasks-fully-passed rate
- **Per-grader breakdown:** pass rate, avg score, and trial count for each grader
- **Custom aggregate metrics:** user-defined Python functions (`compute(results)`)
  that run after all trials complete and can return any float or dict value

---

**Component 5 — Pre-Built Benchmark Suites**

Seven ready-to-use benchmark YAML files covering the six workflow patterns plus a
general arithmetic baseline. Teams can load these into any suite via the UI and
immediately run against their own workflows without authoring tasks from scratch.

| Benchmark | Pattern |
|---|---|
| Routing Benchmark | Routing |
| Chaining Benchmark | Chaining |
| Parallelization Benchmark | Parallelisation |
| Orchestrator-Worker Benchmark | Orchestrator-Worker |
| Evaluator-Optimizer Benchmark | Evaluator-Optimizer |
| Memory Usage Benchmark | Memory Usage |
| Calculator Benchmark | General / Baseline |

---

**Component 6 — Frontend UI**

A full frontend for managing evaluation suites and viewing results, integrated into
the existing OpenJiuwen web UI:

| Capability | Description |
|---|---|
| Create / edit / delete suites | Full CRUD for evaluation suites |
| Add / edit / delete tasks | Task authoring with grader configuration |
| Run evaluation | Select a target workflow or agent, configure trials, start run |
| Load benchmark | One-click import of pre-built benchmark YAML files |
| Custom metrics editor | Define suite-level Python aggregate functions via UI |
| Results view | 4-tab view: Overview (stat cards), Metrics (pass@k, custom), Graders (per-grader breakdown), Traces (per-trial detail with grader verdicts) |

---

### Requirement Type

☑ **Functionality** (excluding Trust)
☑ **Operation and Maintenance Methods** (benchmark suite management, metric export)

---

## Needs Assessment

### Constraints

**Model-based graders require an LLM API call per trial:**
Each trial evaluated by a model-based grader issues an additional LLM call (the
judge call). For suites with many tasks, many trials, and model-based graders,
this significantly increases cost and total evaluation time. Teams should be aware
that model-based evaluation is more expensive than deterministic or code-based
evaluation.

**Code-based graders execute arbitrary Python:**
The custom Python function in a code-based grader executes inside the evaluation
harness. There is no sandboxing beyond what the OS provides. Teams are responsible
for the correctness and safety of their grading code. Infinite loops, excessive
memory use, or exceptions in grading code will affect the evaluation run.

**Custom aggregate metric functions are also arbitrary Python:**
The same constraint applies to suite-level custom metrics. Functions that error
will have their result recorded as an error in the metrics output; they do not fail
the entire run.

**Non-deterministic outputs require multiple trials:**
For workflows that include LLM nodes, a single-trial evaluation may not be
representative. Teams evaluating such workflows should use `trials ≥ 3` to obtain
meaningful `pass@k` estimates. Single-trial runs (`trials = 1`) are sufficient for
deterministic workflows.

**Evaluation runs are not real-time streamed to the UI:**
Runs execute in the background. The UI polls for status. Results are available
after the full run completes, not trial by trial.

**Pattern detection is trace-based:**
The system detects which structural pattern a workflow uses by inspecting its
execution trace (IF components → Routing, overlapping time windows →
Parallelisation, etc.). Workflows that implement a pattern without the expected
trace signatures may not be detected correctly. Pattern type can be set explicitly
on the task to override detection.

### Impact of Requirement Implementation on Existing Systems

**OpenJiuwen backend:**
A new `evaluation` module will be added with its own database tables (5 new tables),
Pydantic schemas, business logic, and REST API router (14 new endpoints). No existing
tables, endpoints, or schemas are modified.

**Workflow and agent execution:**
The evaluation harness reuses the existing workflow and agent execution engine to
run each trial. No changes to the execution engine are required. The harness calls
existing execution endpoints using the same API contract already used by the web UI.

**Frontend:**
New Evaluation pages will be added to the existing frontend application under a
new `/evaluation` route. No existing pages or components are modified. Zustand store
is extended with a new `useEvaluationStore` slice.

**Existing users:**
No impact. The evaluation feature is purely additive. Users who do not use it are
unaffected.

### External Dependencies

| Dependency | Required for | Notes |
|---|---|---|
| Workflow / Agent execution engine | Running trials | Existing; no changes needed |
| Configured LLM models | Model-based graders | Model must be accessible via existing model registry; teams must have a model configured before using model-based graders |
| Python runtime (`exec()` sandbox) | Code-based graders and custom metrics | No additional package; standard Python runtime only |
| Database (existing) | 5 new evaluation tables | Uses existing DB connection; migration adds tables only |
| Frontend Zustand store | UI state management | Already used; new slice added |
