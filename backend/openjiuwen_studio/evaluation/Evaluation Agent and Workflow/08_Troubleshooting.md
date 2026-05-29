# Troubleshooting Guide — Evaluation System

A systematic guide to diagnosing and fixing the most common issues. Each problem includes root cause, diagnostic steps, and concrete fixes.

---

## Quick Diagnosis

**Start here.** Match your symptom to the right section:

| What you're seeing | Jump to |
|-------------------|---------|
| Suite won't create / API error | [Suite Creation Issues](#suite-creation-issues) |
| Run is stuck / never completes | [Run Stuck or Hanging](#run-stuck-or-hanging) |
| All tasks failing | [All Tasks Fail](#all-tasks-fail) |
| Tasks fail sometimes but not always | [High Flakiness](#high-flakiness) |
| Grader gives wrong verdict | [Grader Issues](#grader-issues) |
| Metrics seem wrong | [Metrics Calculation Issues](#metrics-calculation-issues) |
| Pattern not detected | [Pattern Validation Fails](#pattern-validation-fails) |
| Custom metric throws error | [Custom Metric Errors](#custom-metric-errors) |
| Results page is empty / no data | [Results Display Issues](#results-display-issues) |
| Performance: evaluation is very slow | [Performance Issues](#performance-issues) |
| Benchmark suite not working | [Benchmark Issues](#benchmark-issues) |

---

## Suite Creation Issues

### Problem: "Failed to create suite" error

**Symptom**: Click "Create Suite" → error message appears.

**Diagnostic Steps**:
1. Open browser developer tools → Network tab
2. Find the `POST /api/evaluation/suites` request
3. Check the response body for the error message

**Common Causes and Fixes**:

**Cause A: Suite name has invalid characters**
```
Error: "Suite name contains invalid characters"
```
Fix: Use only letters, numbers, spaces, hyphens, and underscores.
Bad: `My Suite! (v2)` → Good: `My Suite v2`

**Cause B: Duplicate suite name**
```
Error: "A suite with this name already exists"
```
Fix: Choose a different name or add a version: `My Suite v2`

**Cause C: Not logged in / session expired**
```
Error: "401 Unauthorized"
```
Fix: Refresh the page and log in again.

**Cause D: Backend server not running**
```
Error: "Failed to fetch" or "Network Error"
```
Fix: Check that the backend is running on `http://localhost:8000`.
```bash
# Verify backend is running
curl http://localhost:8000/health
# Should return: {"status": "healthy"}
```

---

## Run Stuck or Hanging

### Problem: Evaluation runs but never completes

**Symptom**: Progress bar shows "Running..." but stays at the same percentage for more than 5 minutes.

**Diagnostic Steps**:
```bash
# Check backend logs for errors
tail -n 50 logs/backend.log

# Check if agent endpoint is responding
curl -X POST http://localhost:8000/api/agent/invoke \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'

# Check for stuck database operations
# Look for: "evaluation run {id} has been running for >5min"
```

**Common Causes and Fixes**:

**Cause A: Agent endpoint is down**
```
Symptom: Progress freezes at 0% immediately
```
Fix:
1. Verify the agent is running
2. Check the agent URL in your run configuration
3. Test the agent directly:
```bash
curl -X POST {your_agent_url} \
  -H "Content-Type: application/json" \
  -d '{"query": "Hello"}'
```

**Cause B: Agent is timing out (too slow)**
```
Symptom: Progress advances slowly then freezes
```
Fix: Increase the timeout setting in the run configuration:
```json
{
  "timeout_seconds": 120,  // Default is 30s, increase for slow agents
  "max_retries": 2
}
```

**Cause C: Agent input format mismatch**
```
Symptom: Run shows errors in backend log: "422 Unprocessable Entity"
```
Fix: Check that your `input_data` matches your agent's expected input format.
```python
# If your agent expects: {"message": "..."}
# But you're sending: {"query": "..."}
# The agent will return 422 and the run will hang

# Fix: update your task's input_data to match the agent's interface
```

**Cause D: Database connection issue**
```
Symptom: Backend log shows "database connection refused"
```
Fix:
```bash
# Restart the database service
docker-compose restart postgres

# Or check if database tables exist
# See: evaluation-tables.md for table creation workaround
```

**Force Stop a Stuck Run**:
```bash
# Via API
curl -X POST http://localhost:8000/api/evaluation/runs/{run_id}/cancel

# Via database (emergency)
UPDATE evaluation_runs SET status='cancelled' WHERE id='{run_id}' AND status='running';
```

---

## All Tasks Fail

### Problem: Every single task shows as failed

**Symptom**: Results page shows 0% success rate across all tasks.

**Diagnostic Steps**:
1. Click on one failed task → Traces tab → click a trial
2. Check the grader output panel at the bottom
3. Note the exact error message

**Common Causes and Fixes**:

**Cause A: Agent is returning an error (not a valid response)**
```
Grader output: "Output is None" or "Output: Error: Connection refused"
```
Fix: The agent is crashing or unreachable. Check agent logs.
```bash
# Check agent logs
docker logs {agent_container_name}

# Test agent directly
curl -X POST {agent_url} -d '{"query": "test"}'
```

**Cause B: Grader expected value is wrong**
```
Grader output: "Output does not contain 'CORRECT ANSWER'"
Actual output: "The answer is correct, it is: CORRECT ANSWER"
```
Fix: The expected value is too specific. Update the grader:
- If using `equals`: check for exact string (spaces, capitalization, punctuation matter)
- Switch to `contains` for more flexibility
- Use `regex` for pattern matching

**Cause C: Output format mismatch**
```
Grader: json_schema check
Error: "Output is not valid JSON"
Actual output: "Here is the JSON: {...}"
```
Fix: The agent is wrapping JSON in prose. Either:
1. Update the prompt to return raw JSON only
2. Use a code-based grader that extracts JSON from text:
```python
def grade(output, expected, context):
    import json, re
    # Try to extract JSON from wrapped text
    json_match = re.search(r'\{.*\}', output, re.DOTALL)
    if json_match:
        try:
            data = json.loads(json_match.group())
            # Continue validation...
        except:
            pass
    return {"passed": False, "score": 0.0, "reason": "No valid JSON found"}
```

**Cause D: Input data is malformed**
```
Backend log: "Error: input_data is not valid JSON"
```
Fix: Validate your task's `input_data` field:
```python
import json
input_data = '{"query": "test"}'  # Must be valid JSON
json.loads(input_data)  # Should not throw
```

---

## High Flakiness

### Problem: Tasks pass sometimes but fail other times

**Symptom**: Flakiness score > 0.2, inconsistent pass/fail pattern across trials.

**Diagnostic Steps**:
1. Open Metrics tab → check Flakiness score per task
2. Click highest-flakiness task → Traces tab
3. Compare a passing trial vs a failing trial side-by-side
4. Look for what's different in the LLM response

**Common Causes and Fixes**:

**Cause A: High temperature causing variable outputs**
```
Agent uses temperature: 0.9
Grader: exact match check
```
Fix Option 1: Lower the agent's temperature for deterministic outputs
Fix Option 2: Switch grader from `equals` to `contains` or model-based

**Cause B: Ambiguous prompt leading to different response formats**
```
Sometimes: "The answer is 42"
Sometimes: "42"
Sometimes: "forty-two"
```
Fix: Make the prompt more specific:
```
❌ "What is 6 × 7?"
✅ "What is 6 × 7? Respond with only the number, no other text."
```

**Cause C: Race condition in multi-step workflow**
```
Symptom: Parallelization tasks fail randomly
```
Fix: Add proper synchronization to your workflow. Check that all parallel branches complete before aggregation.

**Cause D: Model-based grader itself is inconsistent**
```
Symptom: Flakiness only on tasks with model graders
```
Fix: This is normal for LLM judges. Mitigate by:
1. Using more trials (5-10)
2. Making the rubric more specific
3. Lowering the model temperature via API config

---

## Grader Issues

### Problem: Grader gives wrong verdict (false pass or false fail)

**Symptom**: A task is marked passed but the output seems wrong, or fails but looks correct.

#### Case 1: False Pass (Task passes but output is wrong)

**Diagnostic**: Open the trial → Grader Results → See the grader output reasoning.

**Common Causes**:

**Grader is too lenient**:
```
Contains check: "Yes"
Output: "No, definitely not yes"
Result: PASS (because "yes" appears in "definitely not yes"!)
```
Fix: Use more specific matching:
```json
// Instead of:
{ "check_type": "contains", "expected_value": "yes" }

// Use word-boundary regex:
{ "check_type": "regex", "pattern": "\\byes\\b" }
// Or case-insensitive at start:
{ "check_type": "regex", "pattern": "^yes" }
```

**Model grader is too generous**:
```
Rubric says: "Score > 0.5 to pass"
The AI judge gave 0.6 to a clearly bad response
```
Fix: Raise the `passing_score` threshold, or make the rubric more strict:
```yaml
rubric: |
  Be STRICT. Only give a score above 0.7 if the response:
  1. Directly answers the question (not vague)
  2. Is factually accurate
  3. Uses professional language
```

#### Case 2: False Fail (Task fails but output is correct)

**Common Causes**:

**Exact match too strict**:
```
Expected: "The capital of France is Paris"
Actual:   "The capital of France is Paris."  (has period)
Result: FAIL
```
Fix: Switch from `equals` to `contains`:
```json
{ "check_type": "contains", "expected_value": "Paris" }
```

**Case sensitivity issue**:
```
Expected (case_sensitive: true): "yes"
Actual: "Yes"
Result: FAIL
```
Fix: Set `case_sensitive: false` or change expected to lowercase.

**Path is wrong for JSON field**:
```
Output: {"data": {"answer": "Paris"}}
Path:   "answer"         ← wrong
Fix path: "data.answer"  ← correct
```

---

## Metrics Calculation Issues

### Problem: Success rate seems wrong

**Symptom**: You see 5 tasks but success rate shows 40% when you think it should be higher.

**Understanding Pass/Fail Logic**:
- A task **passes** if ALL graders pass
- If any grader fails, the task fails
- Multiple graders are AND logic (all must pass)

**Example**:
```
Task: "Capital of France"
Grader 1 (weight:5): Contains "Paris" → PASS ✅
Grader 2 (weight:5): Contains "Europe" → FAIL ❌
Task result: FAIL (because grader 2 failed)
```

Fix: Review each grader independently. The failing grader is often the one requiring context you didn't provide.

### Problem: Pass@k seems higher than expected

**Formula reminder**:
```
pass@k = 1 - (1 - success_rate)^k

Example:
- success_rate = 0.50 (50% per trial)
- pass@3 = 1 - (1 - 0.50)^3 = 1 - 0.125 = 0.875 = 87.5%
```

So if your agent succeeds 50% of the time per trial, pass@3 is still 87.5%. This is correct — it's asking "does at least ONE of 3 runs succeed?"

---

## Pattern Validation Fails

### Problem: Pattern shows ❌ but tasks pass

**Symptom**: Task content graders pass but pattern validation fails (ROUTING not detected, etc.)

**How Pattern Detection Works**:
The system inspects the execution trace for structural evidence:
- **ROUTING**: Checks for conditional branching (IF-THEN structures, multiple decision paths)
- **PARALLELIZATION**: Checks for overlapping execution time windows
- **CHAINING**: Checks for output-to-input data flow between sequential steps
- **MEMORY_USAGE**: Checks for reads/writes to memory stores

**Common Causes and Fixes**:

**Cause A: Wrong pattern_type set for the workflow**
```
Your workflow is actually sequential (CHAINING)
but task has pattern_type: PARALLELIZATION
```
Fix: Update the task's `pattern_type` to match how your workflow actually works.

**Cause B: Agent doesn't implement the pattern**
```
Your "routing" agent actually just always calls the same tool
```
Fix: Redesign the agent to actually use the expected pattern. The evaluation is correctly catching a design issue.

**Cause C: Execution trace doesn't expose the pattern**
```
Your agent uses routing internally but the trace doesn't capture it
```
Fix: Make sure your agent emits trace events for routing decisions. Check the tracing documentation.

**Workaround**: If pattern validation isn't relevant for your use case, set `pattern_type: null` in the task configuration to skip this check.

---

## Custom Metric Errors

### Problem: Custom metric throws a Python error

**Symptom**: Custom metric shows "Error" instead of a value, or shows 0.0 unexpectedly.

**How to Debug**:
1. Open the suite → Custom Metrics tab
2. Click "Test Metric" to run against the last run's data
3. Check the error message

**Common Errors**:

**KeyError**: Accessing a field that doesn't exist
```python
# ERROR:
def compute(results):
    return results[0]['latency_ms']  # KeyError if results is empty!

# FIX:
def compute(results):
    if not results:
        return 0.0
    return results[0].get('latency_ms', 0)  # .get() with default
```

**ZeroDivisionError**: Dividing without checking for empty
```python
# ERROR:
def compute(results):
    return sum(r['score'] for r in results) / len(results)  # ZeroDivisionError if empty!

# FIX:
def compute(results):
    if not results:
        return 0.0
    return sum(r['score'] for r in results) / len(results)
```

**TypeError**: Wrong type assumption
```python
# ERROR: assuming 'tags' is always a list
def compute(results):
    return sum(1 for r in results if 'critical' in r['tags'])

# FIX: use .get() with default
def compute(results):
    return sum(1 for r in results if 'critical' in r.get('tags', []))
```

**AttributeError on `results` structure**:
The `results` list contains objects with these guaranteed fields:
```python
result = {
    'task_name': str,           # Task identifier
    'passed': bool,             # Did the task pass?
    'score': float,             # 0.0 to 1.0
    'latency_ms': int,          # Execution time
    'trial_index': int,         # Which trial (0-based)
    'tags': list,               # Task tags (may be empty list)
    'difficulty': str,          # 'easy', 'medium', 'hard'
    'grader_name': str,         # Name of the grader
    'token_usage': dict,        # {'input': int, 'output': int, 'total': int}
}
```

---

## Results Display Issues

### Problem: Results page shows no data

**Symptom**: Run completes but results page is empty.

**Diagnostic Steps**:
1. Check that the run status is `completed` (not `running` or `failed`)
2. Refresh the page
3. Check browser console for JavaScript errors

**Common Causes**:

**Cause A: Run failed silently**
```
Run status: "failed"
```
Fix: Check backend logs for the failure cause:
```bash
grep "evaluation run {run_id}" logs/backend.log
```

**Cause B: Database table missing (known issue)**

See `evaluation-tables.md` for the manual table creation workaround:
```bash
# If EvaluationMetricsDB table is missing, results metrics won't load
# Run the migration or create the table manually
```

**Cause C: Frontend state not refreshed**
Fix: Hard refresh the page (Ctrl+Shift+R / Cmd+Shift+R)

### Problem: Results show but trials tab is empty

**Symptom**: Overview and Metrics tabs have data, but Traces tab shows no trials.

**Cause**: Trial data is stored separately from result aggregates. Database query for trials may be failing.

**Fix**:
```bash
# Check if trial data exists
# Via API:
curl http://localhost:8000/api/evaluation/runs/{run_id}/trials
# Should return array of trial objects
```

---

## Performance Issues

### Problem: Evaluation is very slow

**Symptom**: Evaluation takes >5 minutes for a small suite (5 tasks, 3 trials).

**Diagnostic**: How long does your agent take to respond?
```bash
# Measure agent response time
time curl -X POST {agent_url} -d '{"query": "test"}'
```

**Optimization Options**:

**Option A: Reduce trials for fast iteration**
```yaml
# For development / iteration, use 1-2 trials
num_trials: 1  # Fastest, least reliable
# For production, use 5+
num_trials: 5
```

**Option B: Skip expensive model graders during development**
```yaml
# Comment out model-based graders during initial development
# - name: "Quality Check"
#   type: 1  # Model-based (expensive)
- name: "Quick Check"
  type: 0  # Deterministic (fast, free)
  check_type: contains
  expected_value: "Paris"
```

**Option C: Run only specific tasks**
- Select specific tasks in the UI and click "Run Selected" instead of "Run Suite"
- This skips tasks you're not actively working on

**Option D: Enable parallel trial execution**
Check if parallel execution is enabled in the backend config:
```python
# backend/openjiuwen_studio/core/manager/evaluation.py
# Look for: EVALUATION_MAX_PARALLEL_TRIALS setting
# Default: 1 (sequential)
# Set to: 3-5 for parallel execution (uses more resources)
```

---

## Benchmark Issues

### Problem: Benchmark suite loads but all tasks fail

**Symptom**: Load a benchmark → run it → 0% success rate.

**Most Common Cause**: The benchmark is designed for a specific agent interface but your agent has a different interface.

**Check what the benchmark sends**:
```yaml
# Example from routing benchmark task
input_data:
  query: "Route this task to the appropriate department: customer complaint"
  available_routes: ["support", "billing", "technical"]
```

**Fix**: Your agent must accept these exact fields. Either:
1. Adapt your agent to accept the benchmark's input format
2. Create a custom version of the benchmark with your agent's format (copy the benchmark suite and modify the `input_data` fields)

### Problem: Pattern validation fails on benchmark

**Symptom**: Benchmark shows ❌ for pattern validation even when it seems to work.

**This is intentional.** Benchmarks test both:
1. Whether your agent gives correct answers ✓
2. Whether your agent uses the correct architecture ✓

If your routing agent passes content graders but fails pattern validation, your agent is accidentally giving correct answers without using real routing logic. Fix the agent architecture.

---

## Error Reference

| Error Code | Message | Meaning | Fix |
|-----------|---------|---------|-----|
| `EVAL_001` | Suite not found | Suite ID doesn't exist | Refresh page, verify suite ID |
| `EVAL_002` | Task validation failed | Task JSON is invalid | Check JSON syntax in task editor |
| `EVAL_003` | Agent unreachable | Can't connect to agent | Verify agent is running and URL is correct |
| `EVAL_004` | Agent timeout | Agent took too long | Increase timeout or fix agent performance |
| `EVAL_005` | Grader compilation error | Code-based grader has Python error | Fix Python syntax in grade() function |
| `EVAL_006` | Metric compilation error | Custom metric has Python error | Fix Python syntax in compute() function |
| `EVAL_007` | Database error | DB write/read failed | Check DB connection and table existence |
| `EVAL_008` | Pattern validator error | Trace inspection failed | Check agent trace format |
| `EVAL_009` | Benchmark not found | Benchmark ID doesn't exist | Use a valid benchmark ID from the list |
| `EVAL_010` | Run already in progress | Suite is currently running | Wait for current run to finish |

---

## Getting More Help

**If none of the above fixes your issue**:

1. **Check backend logs**:
   ```bash
   tail -f logs/backend.log | grep -i "evaluation\|error\|exception"
   ```

2. **Enable debug mode** (development only):
   ```python
   # backend/.env
   EVALUATION_DEBUG=true
   EVALUATION_LOG_LEVEL=DEBUG
   ```

3. **Check the GitHub Issues**:
   Search for your error message at: [github.com/openjiuwen/issues](https://github.com/openjiuwen/issues)

4. **Collect diagnostic info** before reporting:
   ```bash
   # Run diagnostic command
   curl http://localhost:8000/api/evaluation/debug/{run_id}
   # This returns: run state, agent health, last error, grader outputs
   ```

5. **Open a new issue** with:
   - Backend logs snippet (last 50 lines)
   - Your task configuration (JSON)
   - Your grader configuration (JSON)
   - Expected vs actual behavior
   - Browser console errors (if any)
