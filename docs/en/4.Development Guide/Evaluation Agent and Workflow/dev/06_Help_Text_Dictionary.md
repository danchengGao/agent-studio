# Help Text Dictionary

This file contains all tooltip and help text for the Evaluation System UI.

**Usage**: Import into `frontend/src/constants/helpText.ts` and use with `<InfoTooltip term="key" />` component.

---

## Metrics & Results

### success_rate
**Short**: Percentage of all trials that passed all graders.
**Long**: This measures how often your workflow/agent produces correct results. >80% is good, 50-80% is fair, <50% needs work. A trial passes only if every grader returns "passed: true".
**Learn More**: USER_GUIDE.md#how-to-interpret-success-rate

### pass_at_k
**Short**: Probability that at least 1 of k runs succeeds.
**Long**: If you run a task 3 times, pass@3 tells you the chance that at least one of those 3 will succeed. Useful when you can retry failed executions. Higher is better.
**Example**: pass@3 = 90% means if you try 3 times, you'll get at least one success 90% of the time.
**Learn More**: USER_GUIDE.md#pass-at-k

### pass_pow_k
**Short**: Probability that ALL k runs succeed.
**Long**: Measures strictest reliability. pass^3 = 50% means only half the time will all 3 runs succeed. Use when every execution must work (e.g., payment processing).
**Example**: pass^5 = 10% means only 1 in 10 times will all 5 runs succeed - indicates low consistency.
**Learn More**: USER_GUIDE.md#pass-power-k

### flakiness
**Short**: How inconsistent results are (0 = stable, 0.5 = random).
**Long**: Measures whether the same input gets different pass/fail outcomes across trials. 0.0 = perfectly consistent (same input always passes or always fails). Higher values mean non-deterministic behavior.
**Good**: <0.1 (very stable)
**Fair**: 0.1-0.3 (some variance)
**Poor**: >0.3 (highly unpredictable)
**Learn More**: USER_GUIDE.md#flakiness

### avg_score
**Short**: Mean quality score (0-100%) across all trials.
**Long**: Different from success rate - shows average quality even for failures. A workflow with 60% success but 85% avg score has near-misses; 60% success with 40% avg score has total failures.
**Learn More**: USER_GUIDE.md#avg-score

### median_score
**Short**: 50th percentile score - less affected by outliers.
**Long**: Half of trials scored above this, half below. More robust than average when you have a few very high or very low outliers.

### perfect_score_rate
**Short**: Fraction of trials that scored exactly 1.0.
**Long**: A trial can pass (score ≥ threshold) without being perfect. This metric shows how often you achieve perfection. High pass rate + high perfect rate = excellence.

### score_std
**Short**: Standard deviation of scores - how much quality varies.
**Long**: Low std (<5%) = consistent results. High std (>15%) = quality swings wildly between runs. Consistency matters for production use.

### score_distribution
**Short**: Histogram showing where scores cluster.
**Long**: Five buckets (0-20%, 20-40%, 40-60%, 60-80%, 80-100%). Spike in 80-100% = mostly good. Spike in 0-20% = mostly failing. Spread out = unpredictable.

### avg_latency_ms
**Short**: Mean execution time per trial in milliseconds.
**Long**: How long your workflow/agent takes on average. Lower is faster. Compare to median to see if outliers are affecting the average.

### median_latency_ms
**Short**: 50th percentile latency - typical execution time.
**Long**: Half of runs finish faster than this. If much lower than average, you have some very slow outliers.

### p95_latency_ms
**Short**: 95% of trials finished faster than this.
**Long**: Useful for worst-case planning. 95% of your users will experience this latency or better. Plan capacity for this, not average.

### latency_cv
**Short**: Coefficient of variation (std ÷ mean) for latency.
**Long**: Measures predictability. Low (<0.2) = execution time is consistent. High (>0.5) = erratic - sometimes fast, sometimes slow.

### error_rate
**Short**: Fraction of trials that crashed with an execution error.
**Long**: Different from grader failures - these are exceptions, timeouts, or system errors. Should be near 0% in production.

### token_usage
**Short**: Total LLM tokens consumed (prompt + completion).
**Long**: Higher = more expensive. Multiply by your LLM pricing to estimate cost. Shown as total and per-trial average.

### tokens_efficiency
**Short**: Token usage split by pass/fail outcome.
**Long**: Shows if passing trials use more/fewer tokens than failing trials. Helps identify if failures are due to insufficient prompting or excessive token use.

### per_grader_breakdown
**Short**: Pass rate and avg score for each grader individually.
**Long**: When overall pass rate is low, this shows which specific grader is failing. Focus your debugging on the grader with the lowest pass rate.

---

## Task Configuration

### task_name
**Short**: Human-readable name for this test case.
**Long**: Shown in results table and traces. Be descriptive: "Add two positive integers" is better than "Test 1".

### task_id
**Short**: Unique identifier used internally.
**Long**: Auto-generated if left blank. Use descriptive IDs like "calc_add_basic" for easier debugging.

### trials
**Short**: How many times to run this task independently.
**Long**: More trials = more reliable statistics. Each trial is completely independent (new conversation ID, no shared state).
**Recommended**:
- 1 trial: Quick smoke test
- 3 trials: Standard reliability check (enables pass@k)
- 5-10 trials: Accurate statistical measurement
**Learn More**: USER_GUIDE.md#trials

### pattern_type
**Short**: Which workflow structure to validate (routing, chaining, etc.).
**Long**: Checks that execution used the expected structural pattern. Leave blank to skip pattern validation and only check output.
**Options**:
- ROUTING: IF component was used
- CHAINING: ≥2 sequential steps
- PARALLELIZATION: Concurrent execution
- ORCHESTRATOR_WORKER: Sub-workflow called
- EVALUATOR_OPTIMIZER: Loop component used
- MEMORY_USAGE: Variables read/written
**Learn More**: USER_GUIDE.md#pattern-checks

### difficulty
**Short**: Organizational label (Easy, Medium, Hard).
**Long**: Does NOT affect execution - purely for filtering and reporting. Use to categorize tasks by complexity.

### tags
**Short**: Custom labels for organizing tasks.
**Long**: Freeform tags like "regression", "smoke-test", "edge-case". Use to filter results or group related tasks.

### input_data
**Short**: JSON sent to the workflow/agent as input.
**Long**: Must match what your workflow expects. Example: `{"message": "Hello", "user_id": "123"}`. Use the same format as when invoking manually.

### expected_output
**Short**: What a correct response looks like.
**Long**: Used by deterministic graders to compare actual output. Example: `{"result": 6.0, "status": "success"}`. Only needed if using output_check or state_check graders.

---

## Graders

### grader_type
**Short**: How to evaluate the trial output.
**Long**:
- **Deterministic (0)**: Rule-based, instant, free. Use for exact matches, numeric comparisons, tool checks.
- **Model-Based (1)**: AI judge with rubric. Flexible but slower and costs tokens.
- **Code-Based (2)**: Custom Python function. Full control for complex logic.
**Learn More**: GRADERS.md

### grader_weight
**Short**: How much this grader affects the final score (default: 1.0).
**Long**: Higher weight = more important. Final score = weighted average. Set to 0 to run the grader for info only (won't affect pass/fail).
**Example**: Output format check (weight 0.3) + quality check (weight 0.7) = quality matters more.

### grader_name
**Short**: Descriptive name for this grader.
**Long**: Shown in results and per-grader breakdown. Use clear names like "result_equals_6" or "response_quality_check".

---

## Deterministic Graders

### check_type
**Short**: What kind of check to perform.
**Options**:
- **output_check**: Compare entire output or check a condition on it
- **state_check**: Check a specific field inside output
- **tool_call_check**: Verify specific tools were called
- **pattern_check**: Regex match on execution trace
- **transcript_check**: Count tool calls or components
**Learn More**: GRADERS.md#deterministic-graders

### path
**Short**: Dot-separated path to a field in the output.
**Long**: Example: `"result"` reads `output["result"]`, `"data.user.email"` reads `output["data"]["user"]["email"]`. Used with state_check.

### expected_value
**Short**: The value you expect to find.
**Long**: Can be string, number, boolean, or JSON object. Compared to actual output using the condition.

### condition
**Short**: How to compare expected vs actual.
**Options**:
- **eq**: Equals (exact match)
- **ne**: Not equals
- **gt**: Greater than (numbers only)
- **lt**: Less than
- **ge**: Greater or equal
- **le**: Less or equal
- **contains**: String contains substring
- **not_contains**: String does NOT contain
- **regex**: Matches regular expression
- **is_not_empty**: Output exists and is not empty
**Learn More**: GRADERS.md#conditions

---

## Model-Based Graders

### model_id
**Short**: Which LLM to use as judge.
**Long**: The model must be configured in your workspace. Recommended: Claude Sonnet 4.5 for quality, Haiku for speed.

### rubric
**Short**: Plain-language description of what a good response looks like.
**Long**: Be specific. Example: "The response identifies positive or negative sentiment, provides a routing decision, and explains the reasoning in 1-2 sentences."
**Tips**:
- Include must-have elements
- Give examples if possible
- Be objective, not subjective

### passing_score
**Short**: Score threshold to mark the trial as passed (0.0-1.0).
**Long**: The LLM returns a score 0-1. If score ≥ passing_score, the trial passes. Recommended: 0.7 for quality checks, 0.9 for strict requirements.

### assertions
**Short**: Optional list of specific criteria to check.
**Long**: Each assertion is a sentence the LLM verifies. Example: "Response mentions the IF component", "Response routes to positive branch". Strengthens the rubric.

---

## Code-Based Graders

### code
**Short**: Python function that grades the trial.
**Long**: Must define a function `def grade(trace, expected):` that returns `{"passed": bool, "score": float}` or just a bool.
**Example**:
```python
def grade(trace, expected):
    output = trace.get("final_output", {})
    result = output.get("result")
    passed = result == expected.get("result")
    return {"passed": passed, "score": 1.0 if passed else 0.0}
```
**Learn More**: GRADERS.md#code-based-graders

### function_name
**Short**: Name of the function to call (default: "grade").
**Long**: If your code defines `def my_grader(trace, expected):`, set this to "my_grader".

---

## Custom Metrics

### custom_metric
**Short**: User-defined aggregate metric computed after all trials.
**Long**: Write a Python function `def compute(results):` that takes the full list of trial results and returns a float or dict. Appears in the Metrics tab.
**Example**:
```python
def compute(results):
    # Fraction of trials that passed with score > 0.85
    high_quality = sum(
        1 for r in results
        if r.get("passed") and r.get("score", 0) > 0.85
    )
    return high_quality / len(results) if results else 0.0
```
**Learn More**: USER_GUIDE.md#custom-aggregate-metrics

---

## Run Configuration

### parallel
**Short**: Run tasks simultaneously instead of sequentially.
**Long**: Faster but uses more resources. Turn off if tasks have conflicts (e.g., shared database state).

### max_workers
**Short**: Max number of tasks to run at once (when parallel=true).
**Long**: Higher = faster but more load on target system. Recommended: 5-10.

---

## Result Status

### pending
**Short**: Run not started yet.
**Long**: Waiting in queue or scheduled to start.

### running
**Short**: Evaluation currently executing.
**Long**: Click "Live Results" to watch progress in real-time.

### completed
**Short**: All trials finished successfully.
**Long**: Click "View Results" to see metrics and traces.

### failed
**Short**: Run stopped due to an error.
**Long**: Check error_message for details. Common causes: connector unreachable, workflow not found, timeout.

### cancelled
**Short**: Run was manually stopped.
**Long**: User clicked Cancel or the system detected a cancellation flag.

---

## Benchmark Terms

### benchmark_suite
**Short**: Pre-built collection of standard test cases.
**Long**: Seven built-in benchmarks test common patterns (routing, chaining, etc.). Use to measure general capability or as starting templates.

### regression_suite
**Short**: Custom test collection for your specific workflow/agent.
**Long**: Capture important scenarios from production. Run on every change to detect regressions.

---

## General Terms

### evaluation_suite
**Short**: Named collection of related tasks.
**Long**: Top-level container. One suite per workflow/agent you want to test. Contains tasks, tracks run history.

### evaluation_run
**Short**: One complete execution of a suite against a workflow/agent.
**Long**: Runs all tasks, computes metrics, stores results. Can be compared to other runs.

### trial
**Short**: One single independent execution of a task.
**Long**: If trials=3, each task runs 3 times with separate conversation IDs. Results are aggregated.

### trace
**Short**: Detailed log of what happened during execution.
**Long**: Records components called, tools used, LLM responses, timing, tokens. Used by graders to evaluate correctness.

### span
**Short**: One step in the execution trace.
**Long**: Each component, tool call, or LLM interaction creates a span with start time, end time, inputs, outputs.

### conversation_id
**Short**: Unique ID for one trial execution.
**Long**: Prevents conflicts when running trials in parallel. Each trial gets its own conversation_id.

---

## UI Elements

### overview_tab
**Short**: High-level metric cards (success rate, score, latency).
**Long**: First tab in results view. Shows summary statistics with color-coded indicators (green/amber/red).

### metrics_tab
**Short**: pass@k tables and custom metrics.
**Long**: Second tab. Shows sampling statistics and user-defined aggregate metrics. Hidden if no data.

### graders_tab
**Short**: Per-grader pass rate and avg score breakdown.
**Long**: Third tab. Shows which specific grader is failing. Use to debug low pass rates.

### traces_tab
**Short**: Per-trial expandable detail with grader verdicts.
**Long**: Fourth tab. Inspect individual trial outputs, see exactly why each grader passed or failed.

---

## Error Messages

### actual_null
**Short**: Grader couldn't find the expected field.
**Long**: Common causes:
1. Workflow returned no output (check execution error)
2. Field name is different (grader checks "result", workflow returns "sum")
3. Output wrapped in extra object (grader checks "result", output is `{"data": {"result": 6}}` - use path "data.result")

### grader_execution_error
**Short**: The grading function crashed.
**Long**: For code-based graders, check the Python code for syntax errors or exceptions. For model-based graders, the LLM call may have failed (check API key, quota).

### timeout
**Short**: Trial didn't complete within timeout_seconds.
**Long**: Increase timeout in task config or optimize your workflow. Default: 300s (5 min).

### connector_error
**Short**: Failed to connect to target system.
**Long**: Check that workflow/agent ID is correct and the system is running. For openJiuwen: verify space_id, auth token.

---

## Tips & Best Practices

### when_to_use_trials
**Short**: Use multiple trials for non-deterministic workflows.
**Long**:
- Deterministic (pure functions, no LLM): trials=1 is fine
- LLM-based workflows: trials=3-5 reveals reliability
- Critical production workflows: trials=10+ for accurate statistics

### choosing_grader_type
**Short**: Match grader to your needs.
**Rules**:
- Need exact match? → Deterministic (state_check with eq)
- Need quality judgment? → Model-Based (with rubric)
- Need complex logic? → Code-Based (Python function)
**Learn More**: GRADERS.md

### improving_success_rate
**Short**: Strategies when success rate is low.
**Steps**:
1. Check per-grader breakdown - which grader is failing?
2. Inspect failed trials in Traces tab - what's the pattern?
3. Relax grader thresholds if partial credit is acceptable
4. Improve workflow prompt or logic
5. Add more training examples / context

### comparing_runs
**Short**: How to measure improvement over time.
**Steps**:
1. Run evaluation before making changes (baseline)
2. Make your changes
3. Run evaluation again
4. Compare success rates in Runs tab
5. Use "Compare" button for detailed diff

---

*Last Updated: 2026-04-23*
*For implementation: Import into `frontend/src/constants/helpText.ts`*
