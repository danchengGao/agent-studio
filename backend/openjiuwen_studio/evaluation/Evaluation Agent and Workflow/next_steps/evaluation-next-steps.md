# Evaluation Module — Next Steps & Feature Roadmap

> 30 proposed features, grouped by theme.
> Each entry includes a short description and the key value it delivers.

---

## 1. Run Management & History

### 1. Run History List
Show a paginated table of all past runs for a suite — date, status, success rate, token cost.
Lets users track progress over time without leaving the app.

### 2. Metrics Trend Charts
Plot success rate, avg score, and avg latency across consecutive runs as line charts.
Immediately surfaces regressions and improvements over iterations.

### 3. Regression Detection
Auto-compare each new run against the previous run for the same suite.
Flag any metric that drops by more than a configurable threshold (e.g. >5% drop in success rate) with a prominent warning badge.

### 4. Run Comparison View
Side-by-side diff of two selected runs: metric delta cards, task-level pass/fail change, and a heatmap overlay showing which tasks flipped from pass→fail or fail→pass.

### 5. Pinned / Baseline Run
Mark any run as a "baseline". Future runs automatically show delta vs baseline on the Overview tab (e.g. `+3.2% success rate vs baseline`).

---

## 2. Suite & Task Authoring

### 6. Bulk Task Import (CSV / JSONL)
Upload a `.csv` or `.jsonl` file to create many tasks at once.
Each row maps to one task with columns for `task_name`, `input_data` (JSON string), `expected_output`, `trials`, and `description`.

### 7. Task Clone / Duplicate
One-click duplicate of an existing task within the same suite, or copy it to a different suite.
Speeds up creating task variations.

### 8. Suite Export & Import
Export an entire suite (tasks + grader configs) as a single JSON file, and import it into any other workspace or project.
Enables sharing evaluation packs between teams.

### 9. Suite Versioning
Track the edit history of a suite's task list.
Show a changelog (task added / removed / modified) and allow rolling back to any previous version.

### 10. Task Search & Filter
Add a search bar and filter controls to the task list: filter by name, pass/fail status, grader type, or trial count.
Essential once suites grow beyond ~20 tasks.

---

## 3. Grader Improvements

### 11. Grader Sandbox / Preview
Test a single grader config against a sample input/output pair without running the full suite.
Immediately shows the score and reasoning, making prompt tuning much faster.

### 12. Visual Grader Weight Editor
Drag sliders to adjust relative weights of graders within a task, with a live preview of how the composite score would change.

### 13. Grader Template Library
A catalogue of reusable grader configs (e.g. "JSON schema validation", "Semantic similarity ≥ 0.85", "Regex match") that can be drag-dropped onto any task.

### 14. Human-in-the-Loop Grader
A special grader type that pauses the run and presents the output to a human reviewer in the UI.
The reviewer scores it 0–1 with an optional comment; the run resumes automatically.

### 15. Grader Calibration
Upload a small gold-standard set of (input, output, human-score) triples.
The system runs the configured model-based grader against them and reports correlation, helping users tune rubrics and models.

---

## 4. Results Analysis

### 16. Failure Clustering
Automatically group failed task results by similarity of their error message or output.
Surfaces the most common failure modes as labeled clusters, making root-cause analysis much faster.

### 17. Per-Task Drill-Down Modal
Click any row in the Traces tab or any heatmap cell to open a full detail modal: raw input, raw output, expected output, per-grader scores with reasoning, and full execution trace.

### 18. Score Distribution Histogram (inline)
Show a mini inline histogram on the Analysis tab instead of hiding it behind a "details" dialog.
Gives an immediate visual sense of score spread without extra clicks.

### 19. Token Cost Breakdown
Expand token usage data to show cost in USD (configurable pricing per model).
Display cost per trial, per task, and total for the run — useful for budget-conscious teams.

### 20. Latency Outlier Flagging
Automatically highlight trials whose latency exceeds `p95 + 2×IQR`.
Show them as orange cells in the heatmap so slow outliers are immediately visible.

---

## 5. Automation & Integration

### 21. Scheduled Runs
Configure a suite to run automatically on a cron schedule (e.g. every night at 02:00).
No manual triggering required — ensures continuous evaluation with zero effort.

### 22. CI/CD Webhook Trigger
Expose a REST endpoint `POST /evaluations/suites/{id}/trigger` with an API key.
Teams can call it from GitHub Actions, GitLab CI, or any CD pipeline after a deployment.

### 23. Pass/Fail Gate
Define a minimum success-rate threshold for a suite.
When triggered via CI, the run returns a non-200 exit code (or a `passed: false` payload) if the threshold is not met, blocking the deployment.

### 24. Completion Notifications
Send a notification (email, Slack, webhook) when a run finishes.
Payload includes run ID, success rate, and a direct link to the results page.

### 25. Auto-Rerun on Failure
Optionally retry only the failed trials (not the whole suite) after a run completes.
Useful for ruling out transient failures without wasting tokens on already-passing tasks.

---

## 6. Collaboration & Sharing

### 26. Run Comments & Annotations
Add a text comment to any run ("deployed new prompt v3", "hotfix for tool bug").
Comments appear in the run history list and on the Analysis tab header.

### 27. Run Tags & Labels
Tag runs with freeform labels (e.g. `prod`, `staging`, `experiment-A`).
Filter the history list by tag to quickly compare runs of the same category.

### 28. Shareable Report Link
Generate a time-limited public URL for an HTML report.
Recipients can view the report in-browser without needing an account — useful for stakeholder reviews.

### 29. Team Dashboard
A top-level evaluation dashboard showing all suites, their latest run status, success rate trend sparklines, and last-run timestamps.
Gives the whole team a single-page health overview.

---

## 7. Ecosystem & Extensibility

### 30. Community Benchmark Library
A curated catalogue of published evaluation suites (e.g. "RAG Faithfulness", "Tool-Use Accuracy", "SQL Generation").
Users can browse, preview, and one-click import any benchmark into their workspace, similar to the existing template dialog but community-driven and versioned.

---

*Generated 2026-03-15. Priority and effort estimates to be added during sprint planning.*
