# Evaluation System Cookbook

**20+ Step-by-Step Recipes for Common Evaluation Scenarios**

Each recipe includes:
- Clear goal statement
- Prerequisites checklist
- Step-by-step instructions with screenshots/code
- Expected results
- Common issues & solutions
- Next steps

---

## Table of Contents

### Getting Started
1. [Run Your First Evaluation](#recipe-1-run-your-first-evaluation)
2. [Test a Calculator Workflow](#recipe-2-test-a-calculator-workflow)
3. [Load and Run a Pre-Built Benchmark](#recipe-3-load-and-run-a-pre-built-benchmark)

### Working with Tasks
4. [Create a Custom Task from Scratch](#recipe-4-create-a-custom-task-from-scratch)
5. [Verify Routing Logic](#recipe-5-verify-routing-logic)
6. [Check Tool Usage](#recipe-6-check-tool-usage)
7. [Validate JSON Output Structure](#recipe-7-validate-json-output-structure)

### Working with Graders
8. [Use AI to Judge Response Quality](#recipe-8-use-ai-to-judge-response-quality)
9. [Combine Multiple Graders](#recipe-9-combine-multiple-graders)
10. [Write a Custom Code Grader](#recipe-10-write-a-custom-code-grader)

### Understanding Results
11. [Interpret Success Rate and pass@k](#recipe-11-interpret-success-rate-and-passk)
12. [Debug Failing Tasks](#recipe-12-debug-failing-tasks)
13. [Compare Two Workflow Versions](#recipe-13-compare-two-workflow-versions)

### Advanced Usage
14. [Create a Regression Test Suite](#recipe-14-create-a-regression-test-suite)
15. [Add Custom Metrics](#recipe-15-add-custom-metrics)
16. [Test for Performance (Latency)](#recipe-16-test-for-performance-latency)
17. [Measure Reliability with Multiple Trials](#recipe-17-measure-reliability-with-multiple-trials)

### Integration & Automation
18. [Set Up Continuous Evaluation (CI/CD)](#recipe-18-set-up-continuous-evaluation-cicd)
19. [Export Results for Reporting](#recipe-19-export-results-for-reporting)
20. [Schedule Periodic Evaluations](#recipe-20-schedule-periodic-evaluations)

---

## Recipe 1: Run Your First Evaluation

**Goal**: Complete your first evaluation run in under 5 minutes.

**Difficulty**: ⭐ Easy

**Time**: ~5 minutes

### Prerequisites
- [ ] You have a workflow or agent created
- [ ] You can access the Evaluation page

### Steps

**1. Navigate to Evaluation page**
   - Click "Evaluation" in the left sidebar

**2. Load a benchmark**
   - Click "Load Benchmark" (top right)
   - Select "Calculator Benchmark" (simplest option)
   - Click "Import"

**3. Pick your target**
   - Click "▶ Run Evaluation"
   - Select "Workflow" or "Agent"
   - Choose your target from dropdown
   - Leave all settings as default
   - Click "Start Run"

**4. Watch progress**
   - Status changes to "Running"
   - Click "Live Results" to watch in real-time
   - Wait for "Completed" status

**5. View results**
   - Success rate shows as percentage (e.g., 83%)
   - Green = passed, Red = failed
   - Click any task to see details

### Expected Result

You should see:
- Run status: "Completed"
- Success rate: 0-100%
- List of tasks with pass/fail icons
- Metrics tab showing pass@k stats

### Common Issues

**Issue**: "Workflow not found"
→ **Solution**: Make sure workflow is in the same space as your evaluation suite

**Issue**: "All tasks failed"
→ **Solution**: Check that your workflow expects the input format the benchmark uses. For Calculator: `{"a": 2, "b": 4}` → `{"result": 6}`

**Issue**: Run stuck at "Pending"
→ **Solution**: Refresh page. If still pending after 2 minutes, check backend logs.

### Next Steps

- Try editing a task to understand how graders work
- Create your own task with custom input
- Read Recipe 2 to build a custom suite

---

## Recipe 2: Test a Calculator Workflow

**Goal**: Create a complete test suite for an add/subtract/multiply workflow.

**Difficulty**: ⭐ Easy

**Time**: ~10 minutes

### Prerequisites
- [ ] You have a calculator workflow that accepts `{"a": <number>, "b": <number>, "operation": "add"|"subtract"|"multiply"}`
- [ ] It returns `{"result": <number>}`

### Steps

**1. Create evaluation suite**
   ```
   Name: "Calculator Tests"
   Description: "Comprehensive tests for calculator workflow"
   Click "Create"
   ```

**2. Add test for addition**
   - Click "+ Add Task"
   - Task name: "Add two positive integers"
   - Input:
     ```json
     {
       "a": 10,
       "b": 15,
       "operation": "add"
     }
     ```
   - Expected output:
     ```json
     {
       "result": 25
     }
     ```
   - Click "+ Add Grader"
   - Type: Deterministic
   - Check type: state_check
   - Path: `result`
   - Expected value: `25`
   - Condition: `eq`
   - Click "Save Task"

**3. Add test for subtraction**
   - Click "+ Add Task"
   - Task name: "Subtract two integers"
   - Input: `{"a": 20, "b": 8, "operation": "subtract"}`
   - Expected: `{"result": 12}`
   - Add same grader as above, but expected value: `12`

**4. Add test for multiplication**
   - Same pattern: `{"a": 7, "b": 6, "operation": "multiply"}` → `{"result": 42}`

**5. Add edge case: zero**
   - Input: `{"a": 0, "b": 5, "operation": "add"}` → `{"result": 5}`

**6. Add edge case: negative numbers**
   - Input: `{"a": -5, "b": 3, "operation": "add"}` → `{"result": -2}`

**7. Run evaluation**
   - Click "▶ Run Evaluation"
   - Select your calculator workflow
   - Trials: 1 (deterministic, doesn't need multiple)
   - Click "Start Run"

### Expected Result

- 5 tasks created
- All tasks should pass if workflow is correct
- Success rate: 100%
- If any fail, check the Traces tab to see actual vs expected output

### Common Issues

**Issue**: `actual: null` in results
→ **Solution**: Your workflow returns a different field name. Check actual output in Traces tab. If it's `{"sum": 25}` instead of `{"result": 25}`, change grader path to `sum`.

**Issue**: `actual: "25"` (string) instead of `25` (number)
→ **Solution**: Your workflow returns strings. Either:
   - Fix workflow to return numbers
   - OR change expected value in grader to `"25"` (with quotes)

**Issue**: Task passed but you expected it to fail
→ **Solution**: Check that grader condition is correct. `eq` is strict equality.

### Next Steps

- Add more edge cases (very large numbers, decimals)
- Try the wrong operation to see a failing test
- Create a second suite for division (with divide-by-zero test)

---

## Recipe 3: Load and Run a Pre-Built Benchmark

**Goal**: Use one of the 7 built-in benchmarks to test a workflow.

**Difficulty**: ⭐ Easy

**Time**: ~3 minutes

### Prerequisites
- [ ] You have a workflow that matches one of the benchmark patterns (routing, chaining, etc.)

### Steps

**1. Choose your benchmark**

| Benchmark | Use When Your Workflow... |
|-----------|---------------------------|
| Calculator | Does arithmetic (add, subtract, multiply) |
| Routing | Has IF component for conditional routing |
| Chaining | Runs multiple steps sequentially |
| Parallelization | Runs multiple branches simultaneously |
| Orchestrator-Worker | Calls sub-workflows |
| Evaluator-Optimizer | Uses loops for refinement |
| Memory Usage | Reads/writes variables |

**2. Load benchmark**
   - Click "Load Benchmark"
   - Select your chosen benchmark
   - (Optional) Rename suite: "My Routing Tests"
   - Click "Import"

**3. Review tasks**
   - Click the newly created suite
   - Click "Tasks" tab
   - Review each task:
     - Input data
     - Expected output
     - Graders
   - Notice how graders are configured

**4. Run benchmark**
   - Click "▶ Run Evaluation"
   - Select your workflow
   - Trials: Keep default (3)
   - Click "Start Run"

**5. Interpret results**
   - Success rate shows how well your workflow matches the pattern
   - >80% = excellent
   - 50-80% = good, some edge cases failing
   - <50% = workflow may not match this pattern

### Expected Result

You'll get a score for how well your workflow handles the standard pattern.

**For Calculator Benchmark**:
- Tests basic arithmetic with different number types
- All should pass if workflow handles add/subtract/multiply correctly

**For Routing Benchmark**:
- Tests positive/negative/neutral sentiment routing
- Pattern validator checks that IF component was used
- Graders check correct branch was taken

### Common Issues

**Issue**: Pattern validation failed
→ **Solution**: Your workflow structure doesn't match. Example: Routing benchmark expects IF component, but your workflow uses code logic instead of IF node.
→ **Fix**: Either restructure workflow or set pattern_type to null on tasks to skip pattern validation.

**Issue**: 0% success rate on all tasks
→ **Solution**: Input/output format mismatch. Check one failing task's actual output to see what format your workflow uses.

**Issue**: Benchmark not relevant to my use case
→ **Solution**: Benchmarks are generic templates. Use them as starting points, then edit tasks to match your specific needs.

### Next Steps

- Clone benchmark tasks and modify for your use case
- Mix tasks from multiple benchmarks into one suite
- Create custom tasks based on patterns learned from benchmark

---

## Recipe 4: Create a Custom Task from Scratch

**Goal**: Build a task tailored to your specific workflow needs.

**Difficulty**: ⭐⭐ Medium

**Time**: ~15 minutes

### Prerequisites
- [ ] You know what input your workflow expects
- [ ] You know what output it should produce for a given input
- [ ] You've decided: what makes the output "correct"?

### Steps

**1. Create or select a suite**
   - Create new suite OR use existing one

**2. Click "+ Add Task"**

**3. Fill basic info**
   ```
   Task Name: "Process customer complaint"
   Description: "Routes complaint to correct department and generates ticket"
   Difficulty: Medium
   Trials: 3
   ```

**4. Define input**
   ```json
   {
     "message": "My order #12345 hasn't arrived after 2 weeks",
     "customer_id": "CUST-789",
     "priority": "high"
   }
   ```

**5. Define expected output**
   ```json
   {
     "department": "shipping",
     "ticket_id": "TICK-*",
     "status": "created"
   }
   ```
   Note: Use `*` or patterns for values that vary

**6. Add grader #1: Department check**
   - Type: Deterministic
   - Check type: state_check
   - Path: `department`
   - Expected: `shipping`
   - Condition: `eq`
   - Weight: 0.4

**7. Add grader #2: Ticket ID exists**
   - Type: Deterministic
   - Check type: state_check
   - Path: `ticket_id`
   - Condition: `is_not_empty`
   - Weight: 0.2

**8. Add grader #3: Response quality (AI judge)**
   - Type: Model-Based
   - Model: Claude Sonnet 4.5
   - Rubric:
     ```
     The response correctly identifies this as a shipping issue,
     creates a ticket, and sets appropriate priority.
     The routing decision is explained.
     ```
   - Passing score: 0.7
   - Weight: 0.4

**9. Save task**

**10. Test with one trial first**
   - Edit task, change trials to 1
   - Run evaluation
   - Check if it passes
   - If not, debug (see Recipe 12)
   - Once passing, change trials back to 3

### Expected Result

- Task created with 3 graders
- Weights sum to 1.0 (40% + 20% + 40%)
- When run:
  - Deterministic graders check structure
  - AI grader checks quality
  - Final score is weighted average

### Common Issues

**Issue**: Don't know what weights to use
→ **Solution**: Start with equal weights (all 1.0). Later, increase weight for more important graders.

**Issue**: Grader always fails
→ **Solution**: Check actual output in Traces tab. Your workflow might return different field names.

**Issue**: AI grader is too strict / too lenient
→ **Solution**: Adjust passing_score. Higher = stricter. Try 0.6 for lenient, 0.8 for strict.

### Next Steps

- Add variations of this task (different complaint types)
- Group related tasks with tags
- Create task template for similar future tasks

---

## Recipe 5: Verify Routing Logic

**Goal**: Test that a routing workflow takes the correct branch for different inputs.

**Difficulty**: ⭐⭐ Medium

**Time**: ~20 minutes

### Prerequisites
- [ ] You have a workflow with IF component (conditional routing)
- [ ] You know all possible branches

### Steps

**1. Create suite**
   ```
   Name: "Sentiment Routing Tests"
   Description: "Verify positive/negative/neutral routing"
   ```

**2. Add task: Positive sentiment**
   - Input: `{"message": "I absolutely love this product!"}`
   - Expected: `{"branch": "positive", "sentiment": "positive"}`
   - Pattern type: ROUTING (important!)
   - Grader:
     - Type: Deterministic
     - Check type: state_check
     - Path: `branch`
     - Expected: `positive`
     - Condition: `eq`

**3. Add task: Negative sentiment**
   - Input: `{"message": "This is terrible, worst purchase ever"}`
   - Expected: `{"branch": "negative", "sentiment": "negative"}`
   - Pattern type: ROUTING
   - Same grader, but expected: `negative`

**4. Add task: Neutral sentiment**
   - Input: `{"message": "The product arrived on time"}`
   - Expected: `{"branch": "neutral", "sentiment": "neutral"}`
   - Pattern type: ROUTING
   - Same grader, but expected: `neutral`

**5. Add edge case: Ambiguous sentiment**
   - Input: `{"message": "It's okay, not great but not bad"}`
   - Expected: `{"branch": "neutral", "sentiment": "neutral"}`
   - Pattern type: ROUTING
   - Mark difficulty: HARD

**6. Add edge case: Mixed sentiment**
   - Input: `{"message": "Love the product but hate the price"}`
   - Use AI grader here (deterministic won't work)
   - Rubric: "Correctly identifies mixed sentiment and routes to appropriate branch"

**7. Run evaluation**
   - Trials: 5 (routing can be non-deterministic with LLMs)

### Expected Result

- Pattern validator checks IF component was used
- Graders check correct branch was taken
- High flakiness on ambiguous cases is expected

**Metrics to watch**:
- Success rate overall
- Per-task success (Easy tasks should be 100%)
- Flakiness (Hard tasks may have higher flakiness)

### Common Issues

**Issue**: Pattern validation failed
→ **Solution**: Your workflow doesn't use IF component. Either add IF component or remove pattern_type from tasks.

**Issue**: All tasks route to same branch
→ **Solution**: Workflow logic is broken. Check the IF condition in your workflow.

**Issue**: 100% success but wrong branch in traces
→ **Solution**: Check that grader path matches your output structure. You might be checking wrong field.

### Next Steps

- Add more edge cases
- Test with real customer messages
- Measure pass@k to see reliability with retries

---

## Recipe 6: Check Tool Usage

**Goal**: Verify that a workflow calls the expected tools.

**Difficulty**: ⭐⭐ Medium

**Time**: ~10 minutes

### Prerequisites
- [ ] Your workflow uses tools (search, calculator, email sender, etc.)
- [ ] You know which tools should be called for different inputs

### Steps

**1. Create task**
   ```
   Task name: "Research workflow uses search tool"
   Input: {"query": "What is the capital of France?"}
   ```

**2. Add tool_call_check grader**
   - Type: Deterministic
   - Check type: `tool_call_check`
   - Expected tools: `["search_web"]`
   - This passes if trace contains at least one call to `search_web`

**3. Add second task: Multiple tools**
   ```
   Task name: "Weather workflow uses search + format"
   Input: {"location": "Paris", "format": "celsius"}
   Expected tools: ["search_weather", "format_temperature"]
   ```

**4. Add third task: Tool NOT called (negative test)**
   - Create custom code grader:
   ```python
   def grade(trace, expected):
       # Check that expensive_api_call was NOT used
       chunks = trace.get("chunks", [])
       tool_calls = [
           c for c in chunks
           if c.get("type") == "tool_call"
       ]
       used_expensive_api = any(
           t.get("payload", {}).get("tool_name") == "expensive_api_call"
           for t in tool_calls
       )
       passed = not used_expensive_api
       return {
           "passed": passed,
           "score": 1.0 if passed else 0.0,
           "feedback": "Used expensive API" if used_expensive_api else "OK"
       }
   ```

**5. Run evaluation**

### Expected Result

- Tasks pass if tools are called
- Negative test passes if forbidden tool is NOT called
- Useful for verifying tool usage policy compliance

### Common Issues

**Issue**: Tool name doesn't match
→ **Solution**: Check exact tool name in traces. Case-sensitive. Might be `search_web` vs `SearchWeb`.

**Issue**: Tool was called but grader failed
→ **Solution**: Tool might be wrapped. Check raw trace chunks to see actual tool name recorded.

### Next Steps

- Combine tool check + output check (both must pass)
- Verify tool arguments are correct
- Test tool error handling

---

## Recipe 7: Validate JSON Output Structure

**Goal**: Ensure workflow outputs valid JSON with required fields.

**Difficulty**: ⭐⭐⭐ Hard

**Time**: ~20 minutes

### Prerequisites
- [ ] You know the expected JSON schema
- [ ] You're comfortable writing Python code

### Steps

**1. Create task**
   ```
   Task name: "User object has required structure"
   Input: {"user_id": 123}
   ```

**2. Define expected schema** (in notes/description)
   ```
   Required fields:
   - id (number)
   - name (string)
   - email (string, valid format)
   - created_at (ISO timestamp)
   ```

**3. Add code-based grader**
   ```python
   import json
   import re
   from datetime import datetime

   def grade(trace, expected):
       """Validates user object schema"""

       output = trace.get("final_output", "")

       # Parse JSON
       try:
           if isinstance(output, str):
               data = json.loads(output)
           else:
               data = output
       except Exception as e:
           return {
               "passed": False,
               "score": 0.0,
               "feedback": f"Invalid JSON: {e}"
           }

       # Check required fields
       required = ["id", "name", "email", "created_at"]
       missing = [f for f in required if f not in data]

       if missing:
           return {
               "passed": False,
               "score": 0.3,  # Partial credit
               "feedback": f"Missing fields: {missing}"
           }

       # Validate types
       if not isinstance(data["id"], (int, str)):
           return {
               "passed": False,
               "score": 0.5,
               "feedback": "id must be number or string"
           }

       # Validate email format
       email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
       if not re.match(email_pattern, data.get("email", "")):
           return {
               "passed": False,
               "score": 0.7,
               "feedback": "Invalid email format"
           }

       # Validate ISO timestamp
       try:
           datetime.fromisoformat(data["created_at"].replace('Z', '+00:00'))
       except:
           return {
               "passed": False,
               "score": 0.9,
               "feedback": "Invalid timestamp format"
           }

       # All checks passed
       return {
           "passed": True,
           "score": 1.0,
           "feedback": "Valid schema"
       }
   ```

**4. Test grader**
   - Run with trials: 1
   - Check that it catches invalid schemas
   - Check that it passes valid schemas

### Expected Result

Grader validates:
- JSON is parseable
- Required fields exist
- Types are correct
- Format constraints (email, timestamp) are met

Partial credit scores:
- 0.3 if fields missing
- 0.5 if types wrong
- 0.7 if format invalid
- 1.0 if all valid

### Common Issues

**Issue**: Grader crashes on invalid JSON
→ **Solution**: Wrap in try/except (shown above)

**Issue**: Too strict - legitimate variations fail
→ **Solution**: Relax constraints. Example: accept `null` for optional fields.

**Issue**: Grader code too long
→ **Solution**: Extract helper functions. Or use a JSON schema validation library (import jsonschema).

### Next Steps

- Create reusable schema validators for common structures
- Add to grader library for reuse
- Combine with quality check for content validation

---

## Recipe 8: Use AI to Judge Response Quality

**Goal**: Evaluate subjective quality (helpfulness, tone, coherence) with an LLM.

**Difficulty**: ⭐⭐ Medium

**Time**: ~10 minutes

### Prerequisites
- [ ] You have an LLM configured (Claude, GPT-4, etc.)
- [ ] Your workflow produces text responses

### Steps

**1. Create task**
   ```
   Task name: "Customer support response quality"
   Input: {
     "customer_message": "My order hasn't arrived, it's been 3 weeks",
     "order_id": "ORD-12345"
   }
   ```

**2. Add model-based grader**
   - Type: Model-Based
   - Model: Claude Sonnet 4.5
   - Rubric:
     ```
     A good response should:
     1. Acknowledge the customer's concern with empathy
     2. Reference the specific order number
     3. Provide clear next steps (check status, contact support, refund)
     4. Maintain a professional and helpful tone
     5. Be concise (under 100 words)
     ```
   - Passing score: 0.75

**3. (Optional) Add assertions**
   ```
   - "Response mentions the order number ORD-12345"
   - "Response expresses empathy or apology"
   - "Response provides actionable next steps"
   ```

**4. Run evaluation**
   - Trials: 5 (LLM judge adds its own variability)

### Expected Result

- AI grades each response on 0-1 scale
- Feedback explains the score
- Passing score threshold determines pass/fail

**Sample feedback**:
```
Score: 0.82
Feedback: Response effectively acknowledges the issue and references the order number.
Provides clear next steps. Could be more empathetic in tone. Well within word limit.
```

### Common Issues

**Issue**: AI too lenient (everything passes)
→ **Solution**: Raise passing_score to 0.8 or 0.9. Strengthen rubric with specific requirements.

**Issue**: AI too strict (nothing passes)
→ **Solution**: Lower passing_score to 0.6. Simplify rubric - might be asking for too much.

**Issue**: Scores vary wildly across trials
→ **Solution**: This is normal for LLM judges. Check median_score and score_std metrics. Consider adding deterministic graders for objective criteria.

**Issue**: Expensive (uses many tokens)
→ **Solution**: Use cheaper model (Haiku) or reduce number of trials.

### Next Steps

- Combine AI grader (weight 0.7) + deterministic checks (weight 0.3)
- Test different rubrics to find optimal one
- Use assertions for must-have requirements

---

## Recipe 9: Combine Multiple Graders

**Goal**: Use deterministic + AI graders together with different weights.

**Difficulty**: ⭐⭐⭐ Hard

**Time**: ~25 minutes

### Prerequisites
- [ ] You understand individual grader types
- [ ] You know which criteria are objective vs subjective

### Steps

**1. Identify criteria**

Break down "good output" into components:
- Objective (deterministic): Format, required fields, value ranges
- Subjective (AI): Quality, helpfulness, tone, coherence

**2. Create task**
   ```
   Task name: "Product description quality check"
   Input: {"product_name": "Wireless Headphones"}
   ```

**3. Add Grader #1: Format check (Deterministic, 20% weight)**
   ```
   Type: Deterministic
   Check type: state_check
   Path: "description"
   Condition: is_not_empty
   Weight: 0.2
   ```
   Ensures output has a description field.

**4. Add Grader #2: Length check (Deterministic, 10% weight)**
   ```
   Type: Code-Based (for character count)
   Weight: 0.1
   Code:
   def grade(trace, expected):
       desc = trace.get("final_output", {}).get("description", "")
       length = len(desc)
       passed = 50 <= length <= 500
       return {
           "passed": passed,
           "score": 1.0 if passed else 0.0,
           "feedback": f"Length: {length} chars (target: 50-500)"
       }
   ```

**5. Add Grader #3: Required keywords (Deterministic, 20% weight)**
   ```
   Type: Deterministic
   Check type: output_check
   Condition: contains
   Expected value: "wireless"
   Weight: 0.2
   ```
   Add another grader for other keywords or combine in code.

**6. Add Grader #4: Quality assessment (AI, 50% weight)**
   ```
   Type: Model-Based
   Model: Claude Sonnet 4.5
   Rubric:
     The description is engaging, highlights key features,
     uses clear language, and would motivate a purchase.
     Avoids marketing fluff and false claims.
   Passing score: 0.75
   Weight: 0.5
   ```

**7. Verify weights sum to 1.0**
   - 0.2 + 0.1 + 0.2 + 0.5 = 1.0 ✓

**8. Run evaluation**

### Expected Result

Trial passes only if ALL graders pass.

Final score = weighted average:
```
score = (G1_score × 0.2) + (G2_score × 0.1) + (G3_score × 0.2) + (G4_score × 0.5)
```

**Example**:
- Format check: pass (score 1.0)
- Length check: pass (score 1.0)
- Keyword check: fail (score 0.0)
- Quality: 0.85

Final score: (1.0×0.2) + (1.0×0.1) + (0.0×0.2) + (0.85×0.5) = 0.725

**Passed?** No (keyword check failed)

### Common Issues

**Issue**: Weights don't sum to 1.0
→ **Solution**: Recalculate. Example: Want 50/30/20 split? Use 0.5, 0.3, 0.2.

**Issue**: One grader dominates
→ **Solution**: Adjust weights. Reduce weight of dominant grader.

**Issue**: Trial fails but score is high
→ **Solution**: Working as intended. Score is average, but passed requires ALL graders pass.

### Next Steps

- Experiment with different weight distributions
- Add informational graders (weight: 0) for debugging
- Create reusable grader sets for similar tasks

---

## Recipe 10: Write a Custom Code Grader

**Goal**: Create a Python grading function for custom logic.

**Difficulty**: ⭐⭐⭐ Hard

**Time**: ~30 minutes

### Prerequisites
- [ ] You know Python basics
- [ ] You've reviewed the trace structure (see USER_GUIDE.md)

### Steps

**1. Understand the function signature**

```python
def grade(trace: dict, expected: dict) -> dict:
    """
    Args:
        trace: {
            "final_output": <the output from workflow>,
            "chunks": [<list of execution chunks>],
            "trace_id": "abc123",
            "token_usage": {
                "prompt_tokens": 100,
                "completion_tokens": 50
            }
        }
        expected: <the task's expected_output dict>

    Returns:
        {
            "passed": bool,
            "score": float,  # 0.0 to 1.0
            "feedback": str  # optional explanation
        }
    """
```

**2. Example: Grade arithmetic correctness with tolerance**

```python
def grade(trace, expected):
    """
    Checks if numeric result is within 1% of expected value.
    Allows for floating point rounding differences.
    """
    output = trace.get("final_output", {})
    actual = output.get("result")
    expected_val = expected.get("result")

    # Validation
    if actual is None:
        return {
            "passed": False,
            "score": 0.0,
            "feedback": "No result in output"
        }

    # Convert to numbers
    try:
        actual_num = float(actual)
        expected_num = float(expected_val)
    except (ValueError, TypeError):
        return {
            "passed": False,
            "score": 0.0,
            "feedback": f"Non-numeric result: {actual}"
        }

    # Calculate difference
    diff = abs(actual_num - expected_num)
    tolerance = abs(expected_num * 0.01)  # 1% tolerance

    passed = diff <= tolerance

    # Calculate score (partial credit)
    if diff == 0:
        score = 1.0
    elif diff <= tolerance:
        score = 1.0 - (diff / tolerance) * 0.2  # Max 20% penalty within tolerance
    else:
        score = max(0.0, 1.0 - (diff / abs(expected_num)))

    return {
        "passed": passed,
        "score": score,
        "feedback": f"Expected {expected_num}, got {actual_num} (diff: {diff:.4f})"
    }
```

**3. Test your grader**

Before using in production, test edge cases:
```python
# Test 1: Exact match
trace1 = {"final_output": {"result": 10.0}}
expected1 = {"result": 10.0}
print(grade(trace1, expected1))  # Should pass

# Test 2: Within tolerance
trace2 = {"final_output": {"result": 10.05}}
expected2 = {"result": 10.0}
print(grade(trace2, expected2))  # Should pass (0.5% diff)

# Test 3: Outside tolerance
trace3 = {"final_output": {"result": 15.0}}
expected3 = {"result": 10.0}
print(grade(trace3, expected3))  # Should fail

# Test 4: Missing result
trace4 = {"final_output": {}}
expected4 = {"result": 10.0}
print(grade(trace4, expected4))  # Should fail with feedback
```

**4. Add to task**
   - Copy your tested code
   - Type: Code-Based
   - Function name: `grade`
   - Paste code

**5. Run evaluation**

### Expected Result

Grader executes your Python code for each trial.

Returns can be:
- Full dict: `{"passed": bool, "score": float, "feedback": str}`
- Just bool: `True` (converted to `{"passed": True, "score": 1.0}`)

### Common Issues

**Issue**: Grader crashes - "NameError: 'X' not defined"
→ **Solution**: Import modules inside function:
```python
def grade(trace, expected):
    import json
    import re
    # ... rest of code
```

**Issue**: Infinite loop or very slow
→ **Solution**: Add timeout logic or simplify algorithm.

**Issue**: Can't access trace data
→ **Solution**: Print trace structure first:
```python
def grade(trace, expected):
    import json
    print(json.dumps(trace, indent=2))
    return {"passed": True, "score": 1.0}
```
Run once to see structure, then write real logic.

### Next Steps

- Save reusable graders to grader library
- Share with team
- Write unit tests for complex graders

---

## Recipe 11: Interpret Success Rate and pass@k

**Goal**: Understand what metrics mean and how to use them.

**Difficulty**: ⭐ Easy

**Time**: ~5 minutes (reading)

### What the Metrics Mean

**Success Rate** (raw pass rate)
- Formula: `passed_trials / total_trials`
- Example: 15 passed out of 20 trials = 75%

**Interpretation**:
- >80% = Excellent (production-ready)
- 60-80% = Good (some improvement needed)
- 40-60% = Fair (works sometimes, needs work)
- <40% = Poor (fundamentally not working)

**pass@k** (probability ≥1 succeeds)
- Formula: Probability that at least 1 of k trials passes
- Example: pass@3 = 95% means if you try 3 times, 95% chance at least one succeeds

**When to use**:
- You can retry failed executions
- Example: Generating creative content - run 3 times, pick best
- Example: API calls with retries

**pass^k** (probability ALL succeed)
- Formula: Probability that all k trials pass
- Example: pass^3 = 40% means only 40% of the time do all 3 succeed

**When to use**:
- Every execution must work (no retries)
- Example: Payment processing
- Example: Sending emails (can't send duplicate)

### Real-World Example

Your workflow has these results:
- Trials: 10
- Passed: 7
- Failed: 3

**Metrics**:
- Success rate: 70%
- pass@1: 70% (same as success rate)
- pass@3: 97%
- pass^3: 34%

**What it means**:
- Works 70% of the time on average (Fair)
- If you can try 3 times, almost always get a success (97%)
- If you need all 3 to work, only happens 34% of the time (Low consistency)

**Decision**: This workflow is good for retry scenarios, not good for must-work-every-time scenarios.

### How to Improve Metrics

**To improve success rate**:
1. Debug failing tasks (Recipe 12)
2. Improve workflow logic/prompts
3. Add error handling
4. Relax grader thresholds (if too strict)

**To improve pass^k (consistency)**:
1. Make workflow more deterministic
   - Use temperature=0 for LLMs
   - Add explicit validation logic
2. Handle edge cases
3. Add retry logic within workflow

### Next Steps

- Use pass@k to set SLA (e.g., "95% success with 2 retries")
- Track metrics over time (regression detection)
- Compare metrics before/after changes

---

## Recipe 12: Debug Failing Tasks

**Goal**: Systematically diagnose why a task fails.

**Difficulty**: ⭐⭐ Medium

**Time**: ~15 minutes per task

### Prerequisites
- [ ] You have a failing task in a completed run
- [ ] You can access the Traces tab

### Debugging Process

**1. Open Traces tab**
   - Click the failing task row to expand
   - Review the summary:
     - How many trials failed?
     - Which graders failed?

**2. Expand a failed trial**
   - Click to expand full detail
   - Check for **Execution Error** banner (red)
     - If present: workflow crashed
     - Error message shows why
     - Common: timeout, missing input, tool error

**3. Check actual output**
   - Look at "Workflow Output" section
   - Is it highlighted red? (mismatch)
   - Is it null/empty?

**4. Review Grader Details table**

For each failing grader, check:

| Column | What to Check |
|--------|---------------|
| Grader | Which grader failed? |
| Expected | What value was expected? |
| Actual | What value was returned? |
| Condition | How were they compared? |

**5. Common Failure Patterns**

**Pattern A: `actual: null`**
```
Expected: {"result": 6.0}
Actual:   null
```
→ **Cause**: Workflow returned nothing OR field name mismatch
→ **Fix**: Check if workflow returns `{"sum": 6}` instead of `{"result": 6}`. Update grader path.

**Pattern B: Type mismatch**
```
Expected: 6.0 (number)
Actual:   "6" (string)
```
→ **Cause**: Workflow returns string instead of number
→ **Fix**: Fix workflow OR change expected value to `"6"`

**Pattern C: Different field name**
```
Path:     "result"
Actual:   (field 'result' not found in output)
Output:   {"answer": 6.0}
```
→ **Fix**: Change grader path from `result` to `answer`

**Pattern D: Nested structure**
```
Path:     "result"
Expected: 6.0
Actual:   {"data": {"result": 6.0}}
```
→ **Fix**: Change path to `data.result`

**Pattern E: Model-based grader failed**
```
Score:    0.45
Feedback: "Response lacks empathy and doesn't provide next steps"
```
→ **Fix**: Improve workflow prompt OR relax passing_score

**6. Test your fix**
   - Edit the task
   - Update grader (change path, expected value, etc.)
   - Re-run evaluation
   - Check if it now passes

### Debugging Checklist

- [ ] Is there an execution error? (Check error banner)
- [ ] What does actual output look like? (Raw output)
- [ ] Does output have the expected field? (Check field names)
- [ ] Are types correct? (number vs string, etc.)
- [ ] Is structure correct? (flat vs nested)
- [ ] Is grader path correct? (dot notation)
- [ ] Is expected value correct? (copy from passing run)
- [ ] Is condition correct? (`eq` for exact, `contains` for substring)

### Next Steps

- Document common failure patterns for your team
- Create better error messages in workflow
- Add validation before returning output

---

## Recipe 13: Compare Two Workflow Versions

**Goal**: Measure improvement between versions.

**Difficulty**: ⭐⭐ Medium

**Time**: ~10 minutes

### Prerequisites
- [ ] You have two versions of a workflow
- [ ] You have an evaluation suite to test both

### Steps

**1. Run baseline (version 1)**
   - Select your evaluation suite
   - Click "▶ Run Evaluation"
   - Select Version 1 workflow
   - Note the run ID (e.g., "Run #12")
   - Wait for completion
   - Record metrics:
     - Success rate: ___%
     - Avg score: ___
     - Avg latency: ___ms

**2. Make your changes**
   - Update workflow (improve prompt, add logic, etc.)
   - Save as Version 2

**3. Run comparison (version 2)**
   - Same suite
   - Select Version 2 workflow
   - Same settings (trials, parallel, etc.)
   - Wait for completion

**4. Compare results**

Go to Runs tab, compare side-by-side:

| Metric | V1 (Run #12) | V2 (Run #13) | Change |
|--------|--------------|--------------|--------|
| Success Rate | 73% | 89% | +16% ✓ |
| Avg Score | 0.78 | 0.91 | +0.13 ✓ |
| Avg Latency | 1.2s | 1.8s | +0.6s ✗ |
| Flakiness | 0.15 | 0.08 | -0.07 ✓ |

**5. Drill into tasks**

Identify tasks where performance changed:
- Which tasks improved?
- Which tasks regressed?
- Any new failures?

**6. Decide**

Questions to answer:
- Is the improvement worth the latency increase?
- Are there tasks that got worse?
- Is version 2 ready for production?

### Expected Result

Clear quantitative comparison showing:
- What improved
- What regressed
- Net change

### Common Issues

**Issue**: Results are inconsistent across runs
→ **Solution**: Increase trials (e.g., 5-10) for more stable statistics.

**Issue**: Can't tell which version is better
→ **Solution**: Define your priority metric (success rate? latency? score?). Different use cases prioritize differently.

**Issue**: Both versions have similar metrics
→ **Solution**: Either change was too small to measure, or you need more sensitive graders.

### Next Steps

- Track metrics over time (create spreadsheet)
- A/B test in production
- Create regression suite to prevent degradation

---

## Recipe 14: Create a Regression Test Suite

**Goal**: Build a suite that catches when changes break existing functionality.

**Difficulty**: ⭐⭐ Medium

**Time**: ~30 minutes

### Prerequisites
- [ ] Your workflow is currently working
- [ ] You know the critical functionality to protect

### Steps

**1. Identify critical scenarios**

Make a list of must-not-break cases:
- [ ] Happy path (most common input)
- [ ] Edge case A (empty input, max value, etc.)
- [ ] Edge case B
- [ ] Previous bugs that were fixed
- [ ] High-value use case

**2. Create suite**
   ```
   Name: "[WorkflowName] Regression Tests"
   Description: "Critical scenarios that must always pass"
   Tags: ["regression", "critical"]
   ```

**3. For each scenario, create a task**

Example:
```
Task 1: Happy path - basic addition
  Input: {"a": 2, "b": 4}
  Expected: {"result": 6}
  Grader: Exact match (state_check on "result")
  Trials: 1 (deterministic)

Task 2: Edge - zero handling
  Input: {"a": 0, "b": 5}
  Expected: {"result": 5}
  Grader: Exact match
  Trials: 1

Task 3: Edge - negative numbers
  Input: {"a": -10, "b": 3}
  Expected: {"result": -7}
  Grader: Exact match
  Trials: 1

Task 4: Previously fixed bug - large numbers
  Input: {"a": 999999, "b": 1}
  Expected: {"result": 1000000}
  Grader: Exact match
  Trials: 3
  # Bug: Used to overflow, now fixed

Task 5: High-value - currency calculation
  Input: {"a": 19.99, "b": 0.01}
  Expected: {"result": 20.00}
  Grader: Numeric tolerance (code-based, 0.01 tolerance)
  Trials: 3
```

**4. Run baseline**
   - Run against current working version
   - All tasks should pass
   - If any fail, fix before using as regression suite

**5. Establish policy**

**Before ANY change to workflow**:
1. Run regression suite
2. Must be 100% pass
3. If not 100%, investigate before merging

**After changes**:
1. Run regression suite again
2. Compare to baseline
3. Any decrease = regression (investigate!)

**6. Automate (optional)**
   - Integrate with CI/CD (Recipe 18)
   - Fail build if regression suite <100%

### Expected Result

A suite that acts as safety net:
- Catches accidental breaking changes
- Documents critical functionality
- Gives confidence when refactoring

### Common Issues

**Issue**: Suite too large (slow to run)
→ **Solution**: Keep regression suite focused on critical paths only. Create separate "comprehensive" suite for thorough testing.

**Issue**: False failures (flaky tests)
→ **Solution**: Use trials=1 for deterministic tests, trials=3+ for LLM-based tests. Fix underlying non-determinism.

**Issue**: Suite becomes outdated
→ **Solution**: Review quarterly. Remove obsolete tests, add new critical scenarios.

### Next Steps

- Add new test whenever you fix a bug
- Run before every deployment
- Share with team as quality gate

---

## Recipe 15: Add Custom Metrics

**Goal**: Define a Python function to compute custom aggregate metrics.

**Difficulty**: ⭐⭐⭐ Hard

**Time**: ~20 minutes

### Prerequisites
- [ ] You know Python basics
- [ ] You understand aggregate metrics concept

### Steps

**1. Click Σ (Sigma) button**
   - In suite header
   - Opens "Custom Metrics" dialog

**2. Click "+ New Metric"**

**3. Define metric**
   ```
   Name: high_quality_pass_rate
   Description: Fraction of trials that passed with score > 0.85
   ```

**4. Write compute function**

```python
def compute(results):
    """
    Args:
        results: List of trial result dicts, each with:
            {
                "task_id": str,
                "passed": bool,
                "score": float,
                "latency_ms": int,
                "token_usage": {
                    "prompt_tokens": int,
                    "completion_tokens": int
                },
                "error_message": str or None,
                "grader_results": [...]
            }

    Returns:
        float or dict
    """
    if not results:
        return 0.0

    high_quality = sum(
        1 for r in results
        if r.get("passed") and r.get("score", 0) > 0.85
    )

    return high_quality / len(results)
```

**5. Test your function locally** (optional but recommended)

```python
# Test data
test_results = [
    {"passed": True, "score": 0.90},
    {"passed": True, "score": 0.75},
    {"passed": False, "score": 0.40},
    {"passed": True, "score": 0.95},
]

result = compute(test_results)
print(result)  # Should be 0.5 (2 out of 4 > 0.85)
```

**6. Save metric**

**7. Run evaluation**
   - Metric appears in "Metrics" tab under "Custom Metrics"

### More Examples

**Example: Weighted by difficulty**
```python
def compute(results):
    """Weight scores by task difficulty"""
    if not results:
        return 0.0

    # Difficulty from task metadata (if available)
    weighted_sum = 0
    weight_total = 0

    for r in results:
        score = r.get("score", 0)
        difficulty = r.get("task", {}).get("difficulty", 1)  # 0=easy, 1=med, 2=hard

        weight = difficulty + 1  # easy=1, med=2, hard=3
        weighted_sum += score * weight
        weight_total += weight

    return weighted_sum / weight_total if weight_total > 0 else 0.0
```

**Example: Cost per successful trial**
```python
def compute(results):
    """Average tokens used per passing trial"""
    passed = [r for r in results if r.get("passed")]

    if not passed:
        return None  # No passing trials

    total_tokens = sum(
        r.get("token_usage", {}).get("total_tokens", 0)
        for r in passed
    )

    return total_tokens / len(passed)
```

**Example: Multi-value return**
```python
def compute(results):
    """Return multiple sub-metrics"""
    passed = [r for r in results if r.get("passed")]
    failed = [r for r in results if not r.get("passed")]

    return {
        "pass_avg_latency": sum(r.get("latency_ms", 0) for r in passed) / len(passed) if passed else None,
        "fail_avg_latency": sum(r.get("latency_ms", 0) for r in failed) / len(failed) if failed else None,
        "latency_difference": "Passed trials were faster" if passed and failed and ... else "No difference"
    }
```

### Expected Result

Custom metric appears in Metrics tab:
```
Custom Metrics
┌────────────────────────┬────────┐
│ Name                   │ Value  │
├────────────────────────┼────────┤
│ high_quality_pass_rate │ 0.67   │
└────────────────────────┴────────┘
```

### Common Issues

**Issue**: Metric shows error instead of value
→ **Solution**: Your function crashed. Common causes:
- Division by zero (check `if not results:` first)
- KeyError (use `.get()` instead of `[]`)
- Type error (check types before operations)

**Issue**: Can't access task metadata
→ **Solution**: Results dict only has trial data. Task-level data not included (limitation). Workaround: use tags and check `r.get("tags")`.

**Issue**: Metric value looks wrong
→ **Solution**: Add print statements:
```python
def compute(results):
    print(f"Total results: {len(results)}")
    print(f"First result: {results[0]}")
    # ... rest of code
```
Check logs to see what data looks like.

### Next Steps

- Create reusable metrics library
- Share with team
- Use for custom SLA reporting

---

## Recipe 16: Test for Performance (Latency)

**Goal**: Ensure workflow completes within time limit.

**Difficulty**: ⭐⭐ Medium

**Time**: ~15 minutes

### Prerequisites
- [ ] You have a latency target (e.g., <2 seconds)

### Steps

**1. Create performance test task**
   ```
   Task name: "Quick search completes in <2s"
   Input: {"query": "weather today"}
   Timeout: 2 seconds
   Trials: 10
   ```

**2. Add grader** (optional - just for output validation)
   ```
   Type: Deterministic
   Check: Output is not empty
   ```

**3. Run evaluation**

**4. Check latency metrics**

In Results > Overview tab:
- **Avg Latency**: Mean execution time
- **p95 Latency**: 95% of trials faster than this
- Click "· details" for full breakdown:
  - Median (p50)
  - p75
  - Min / Max
  - Standard deviation

**5. Interpret results**

| Scenario | What It Means |
|----------|---------------|
| Avg < target, p95 < target | ✓ Consistently fast |
| Avg < target, p95 > target | ⚠ Most are fast, some slow outliers |
| Avg > target | ✗ Too slow on average |
| High std deviation | ⚠ Inconsistent performance |

**6. Diagnose slow trials**
   - Go to Traces tab
   - Sort by latency (if available)
   - Inspect slowest trial
   - Check which component/tool took longest

### Using Timeout

**Set timeout at task level**:
```
timeout_seconds: 5
```

If trial exceeds timeout:
- Marked as failed
- Error: "Execution timeout after 5s"
- Counted in error_rate metric

### Latency Target by Use Case

| Use Case | Target | Why |
|----------|--------|-----|
| Real-time API | <500ms | User is waiting |
| Interactive chatbot | <2s | Conversational feel |
| Background job | <30s | User not blocking |
| Batch processing | <5min | Long-running OK |

### Common Issues

**Issue**: High variance (some fast, some slow)
→ **Solution**: Likely LLM response time varies. Use caching, or accept variability.

**Issue**: Consistently slow
→ **Solution**: Profile workflow. Common causes:
- Too many tool calls
- Large LLM context
- Slow external API
- Network latency

**Issue**: Timeout too strict
→ **Solution**: Increase timeout OR optimize workflow.

### Next Steps

- Set latency SLA (e.g., p95 < 3s)
- Monitor latency over time
- Optimize slow components

---

## Recipe 17: Measure Reliability with Multiple Trials

**Goal**: Understand how consistent your workflow is across repeated runs.

**Difficulty**: ⭐⭐ Medium

**Time**: ~15 minutes

### Prerequisites
- [ ] Your workflow uses LLMs (non-deterministic)
- [ ] You want to measure reliability

### Steps

**1. Choose number of trials**

| Trials | When to Use |
|--------|-------------|
| 1 | Deterministic workflows only |
| 3 | Standard reliability check |
| 5 | Accurate pass@k measurement |
| 10+ | Production-critical workflows |

**2. Create tasks with high trial count**
   ```
   Trials: 10
   ```

**3. Run evaluation**

**4. Check reliability metrics**

In Results > Overview:
- **Success Rate**: Overall pass rate
- **Flakiness**: Consistency measure
  - 0.0 = perfectly consistent
  - 0.5 = maximally random
- **pass@k** vs **pass^k**: Shows reliability with retries

In Results > Metrics:
- **Tasks Fully Passed**: % of tasks where ALL trials passed
- **Tasks Never Passed**: % of tasks where NO trial passed

**5. Interpret flakiness**

| Flakiness | What It Means | Action |
|-----------|---------------|--------|
| 0.00-0.05 | Very consistent | ✓ Production-ready |
| 0.05-0.15 | Slight variation | Acceptable for most uses |
| 0.15-0.30 | Moderate inconsistency | Investigate high-variance tasks |
| >0.30 | Highly unpredictable | ✗ Not reliable enough |

**6. Identify flaky tasks**
   - Go to Traces tab
   - Look for tasks where some trials pass, some fail
   - Expand to see which trials succeeded
   - Compare outputs to find differences

**7. Reduce flakiness**

**Causes of flakiness**:
- LLM temperature too high
- Ambiguous prompts
- Edge case inputs
- Random tool selection

**Solutions**:
- Set temperature=0 for deterministic LLM
- Make prompts more specific
- Add explicit error handling
- Use deterministic logic for critical decisions

### Expected Result

**Good reliability** (example):
```
Trials: 10
Success Rate: 90%
Flakiness: 0.08
pass@1: 90%
pass@3: 99.7%
pass^3: 73%

Interpretation:
- 90% pass rate is excellent
- Low flakiness means consistency
- With 3 retries, almost always succeeds
- 73% of the time, all 3 attempts work
→ Reliable for production with retry logic
```

**Poor reliability** (example):
```
Trials: 10
Success Rate: 60%
Flakiness: 0.35
pass@1: 60%
pass@3: 94%
pass^3: 22%

Interpretation:
- Only 60% pass rate
- High flakiness = unpredictable
- Retries help (94% with 3 tries)
- But rarely do all 3 work (22%)
→ Needs improvement before production
```

### Common Issues

**Issue**: Flakiness 0.0 but success rate <100%
→ **Solution**: Tasks consistently fail OR consistently pass (no variation). Check which tasks never pass - those need fixing.

**Issue**: Perfect success rate but high flakiness
→ **Solution**: This shouldn't happen. Check metrics calculation or report bug.

**Issue**: Can't afford 10 trials (too slow/expensive)
→ **Solution**: Use 3 trials for most tasks, 10 trials for critical tasks only.

### Next Steps

- Set reliability SLA (e.g., flakiness <0.1)
- Track flakiness over time
- Improve high-flakiness tasks first

---

## Recipe 18: Set Up Continuous Evaluation (CI/CD)

**Goal**: Automatically run evaluations on every code change.

**Difficulty**: ⭐⭐⭐ Hard

**Time**: ~45 minutes

### Prerequisites
- [ ] You use GitHub Actions (or similar CI/CD)
- [ ] You have an evaluation suite
- [ ] You have API access to OpenJiuwen

### Steps

**1. Install CLI (if not already)**
   ```bash
   pip install openjiuwen-agenteval
   ```

**2. Configure API credentials**

Create `.github/workflows/evaluation.yml`:

```yaml
name: Evaluation Tests

on:
  pull_request:
    paths:
      - 'workflows/**'
      - 'agents/**'
  push:
    branches:
      - main

jobs:
  evaluate:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install openjiuwen-agenteval

      - name: Configure evaluation client
        env:
          AGENTEVAL_API_URL: ${{ secrets.AGENTEVAL_API_URL }}
          AGENTEVAL_API_KEY: ${{ secrets.AGENTEVAL_API_KEY }}
          SPACE_ID: ${{ secrets.SPACE_ID }}
        run: |
          agenteval configure \
            --api-url $AGENTEVAL_API_URL \
            --api-key $AGENTEVAL_API_KEY

      - name: Run regression tests
        env:
          WORKFLOW_ID: ${{ secrets.WORKFLOW_ID }}
        run: |
          agenteval run \
            --suite "Regression Tests" \
            --workflow $WORKFLOW_ID \
            --space $SPACE_ID \
            --fail-threshold 0.85 \
            --wait

      - name: Export results
        if: always()
        run: |
          agenteval results \
            --run latest \
            --format json > evaluation-results.json

          agenteval results \
            --run latest \
            --format markdown > evaluation-report.md

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: evaluation-results
          path: |
            evaluation-results.json
            evaluation-report.md

      - name: Comment on PR
        if: github.event_name == 'pull_request' && always()
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('evaluation-report.md', 'utf8');

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Evaluation Results\n\n${report}`
            });
```

**3. Add secrets to GitHub**
   - Go to repo Settings > Secrets
   - Add:
     - `AGENTEVAL_API_URL`: `http://your-server:8000`
     - `AGENTEVAL_API_KEY`: Your API key
     - `SPACE_ID`: Your workspace ID
     - `WORKFLOW_ID`: Workflow to test

**4. Create regression suite**
   - Name: "Regression Tests"
   - Add critical tasks (Recipe 14)

**5. Set fail threshold**
   - `--fail-threshold 0.85` means build fails if success rate <85%
   - Adjust based on your needs

**6. Test locally**
   ```bash
   agenteval run \
     --suite "Regression Tests" \
     --workflow wf-123 \
     --fail-threshold 0.85 \
     --wait
   ```

**7. Commit workflow file**
   ```bash
   git add .github/workflows/evaluation.yml
   git commit -m "Add evaluation CI/CD"
   git push
   ```

**8. Create test PR**
   - Make a small change
   - Push to PR branch
   - Watch GitHub Actions run
   - Check PR comment for results

### Expected Result

**On every PR**:
- Evaluation runs automatically
- Results posted as PR comment
- Build fails if success rate <threshold

**Example PR comment**:
```markdown
## Evaluation Results

**Suite**: Regression Tests
**Success Rate**: 92% ✓
**Trials**: 15 / 15 completed
**Duration**: 2m 34s

### Metrics
- Avg Score: 0.89
- Avg Latency: 1.2s
- Error Rate: 0%

### Failed Tasks
None! All tasks passed.

---
[View Full Results](link-to-results-page)
```

### Common Issues

**Issue**: "API key invalid"
→ **Solution**: Check secret is set correctly in GitHub Settings.

**Issue**: Build always passes even when tests fail
→ **Solution**: Make sure `--fail-threshold` is set. CLI exit code must be checked.

**Issue**: Too slow (blocks PRs)
→ **Solution**: Reduce number of trials or run only critical tasks in CI. Full suite on main branch only.

**Issue**: Flaky failures block PRs
→ **Solution**: Either fix flakiness OR lower fail-threshold to account for variance.

### Next Steps

- Add notification to Slack on failure
- Run comprehensive suite on main branch
- Generate trend reports weekly

---

## Recipe 19: Export Results for Reporting

**Goal**: Generate reports for stakeholders, presentations, or record-keeping.

**Difficulty**: ⭐ Easy

**Time**: ~5 minutes

### Prerequisites
- [ ] You have completed evaluation runs
- [ ] You want to share results externally

### Options

**Option 1: Export from UI**
   - Go to Run Detail page
   - Click "Export" button (if available)
   - Choose format: JSON, CSV, or Markdown
   - Download file

**Option 2: Use CLI**
   ```bash
   # JSON format (for programmatic use)
   agenteval results --run run-789 --format json > results.json

   # Markdown format (for documentation)
   agenteval results --run run-789 --format markdown > report.md

   # CSV format (for spreadsheets)
   agenteval results --run run-789 --format csv > results.csv
   ```

**Option 3: Use API**
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" \
     http://localhost:8000/api/v1/evaluation/results/run-789 \
     > results.json
   ```

### Markdown Report Example

```markdown
# Evaluation Report: Calculator Tests

**Run ID**: run-789
**Date**: 2026-04-23 14:32:10
**Target**: Calculator Workflow (v1.2)
**Suite**: Calculator Tests

## Summary

- **Success Rate**: 87%
- **Total Trials**: 15
- **Passed**: 13
- **Failed**: 2
- **Avg Score**: 0.91
- **Avg Latency**: 834ms

## Metrics

### Pass / Fail
- Success Rate: 87%
- Error Rate: 0%

### Sampling
- pass@1: 87%
- pass@3: 99%
- pass@5: 99.9%

### Latency
- Avg: 834ms
- Median: 742ms
- p95: 1250ms

## Failed Tasks

1. **Divide by zero handling** (0 / 3 passed)
   - Expected graceful error
   - Got: null output

2. **Large number multiplication** (2 / 3 passed)
   - Intermittent failures
   - Flakiness: 0.25

## Recommendations

1. Add error handling for division by zero
2. Investigate large number overflow issue
3. Overall performance excellent (87% pass rate)
```

### JSON Report Structure

```json
{
  "run_id": "run-789",
  "evaluation": {
    "id": "eval-123",
    "name": "Calculator Tests"
  },
  "target": {
    "type": "workflow",
    "id": "wf-456",
    "name": "Calculator Workflow"
  },
  "status": "completed",
  "metrics": {
    "success_rate": 0.87,
    "passed": 13,
    "total_results": 15,
    "avg_score": 0.91,
    "avg_latency_ms": 834,
    "pass_at_k": {"1": 0.87, "3": 0.99, "5": 0.999},
    ...
  },
  "results": [
    {
      "task_id": "calc_add_basic",
      "task_name": "Add two positive integers",
      "passed": true,
      "score": 1.0,
      "latency_ms": 742,
      "trial_number": 1,
      ...
    },
    ...
  ]
}
```

### Creating Executive Summary

**Template**:

```markdown
# [Workflow Name] Evaluation Summary

**Evaluation Date**: [Date]
**Evaluated Version**: [Version]

## Key Findings

✅ **Strengths**
- [List what works well]
- [Example: "Excellent performance on basic arithmetic (100% pass rate)"]

⚠️ **Areas for Improvement**
- [List issues found]
- [Example: "Edge case handling needs work (2 / 10 edge cases failed)"]

## Metrics at a Glance

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Success Rate | 87% | ≥85% | ✓ Pass |
| Avg Latency | 834ms | <1s | ✓ Pass |
| Flakiness | 0.12 | <0.15 | ✓ Pass |

## Recommendation

[Ready for production / Needs work / Do not deploy]

**Next Steps**:
1. [Action item 1]
2. [Action item 2]
```

### Common Issues

**Issue**: Export file too large
→ **Solution**: Export only summary metrics, not full traces.

**Issue**: Need custom format
→ **Solution**: Export JSON, then transform with script:
```python
import json

with open('results.json') as f:
    data = json.load(f)

# Transform to your format
custom_report = {
    "pass_rate": data["metrics"]["success_rate"],
    # ... etc
}

with open('custom_report.json', 'w') as f:
    json.dump(custom_report, f)
```

### Next Steps

- Create report template for your organization
- Automate weekly reports
- Share with stakeholders

---

## Recipe 20: Schedule Periodic Evaluations

**Goal**: Run evaluations automatically on a schedule (e.g., nightly, weekly).

**Difficulty**: ⭐⭐⭐ Hard

**Time**: ~30 minutes

### Prerequisites
- [ ] You have an evaluation suite
- [ ] You have access to a scheduler (cron, GitHub Actions, etc.)

### Option 1: GitHub Actions (Scheduled)

Create `.github/workflows/scheduled-evaluation.yml`:

```yaml
name: Nightly Evaluation

on:
  schedule:
    # Run every day at 2 AM UTC
    - cron: '0 2 * * *'
  workflow_dispatch:  # Allow manual trigger

jobs:
  evaluate:
    runs-on: ubuntu-latest

    steps:
      - name: Install CLI
        run: pip install openjiuwen-agenteval

      - name: Run nightly tests
        env:
          AGENTEVAL_API_KEY: ${{ secrets.AGENTEVAL_API_KEY }}
        run: |
          agenteval run \
            --suite "Nightly Regression Suite" \
            --workflow ${{ secrets.WORKFLOW_ID }} \
            --wait

      - name: Export results
        run: |
          agenteval results --run latest --format json > results.json
          agenteval results --run latest --format markdown > report.md

      - name: Upload to S3 (or artifact)
        run: |
          # Upload to S3 bucket
          aws s3 cp results.json s3://my-bucket/evaluations/$(date +%Y-%m-%d)/
          aws s3 cp report.md s3://my-bucket/evaluations/$(date +%Y-%m-%d)/

      - name: Send notification
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Nightly evaluation failed! Success rate below threshold.",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "🚨 *Nightly Evaluation Failed*\n\nCheck results: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### Option 2: Cron Job (Linux Server)

**1. Create script** (`/opt/evaluation/run-nightly.sh`):

```bash
#!/bin/bash

# Load environment
export AGENTEVAL_API_KEY="your-api-key"
export AGENTEVAL_API_URL="http://localhost:8000"
export SPACE_ID="space-123"
export WORKFLOW_ID="wf-456"

# Log file
LOG_FILE="/var/log/evaluations/nightly-$(date +%Y-%m-%d).log"

# Run evaluation
echo "Starting nightly evaluation at $(date)" >> $LOG_FILE

agenteval run \
  --suite "Nightly Regression Suite" \
  --workflow $WORKFLOW_ID \
  --space $SPACE_ID \
  --fail-threshold 0.80 \
  --wait \
  >> $LOG_FILE 2>&1

EXIT_CODE=$?

# Export results
if [ $EXIT_CODE -eq 0 ]; then
  echo "Evaluation passed!" >> $LOG_FILE
  agenteval results --run latest --format json > /var/www/reports/latest.json
else
  echo "Evaluation failed! Sending alert..." >> $LOG_FILE
  # Send email alert
  mail -s "Nightly Evaluation Failed" team@example.com < $LOG_FILE
fi

echo "Finished at $(date)" >> $LOG_FILE
```

**2. Make executable**:
```bash
chmod +x /opt/evaluation/run-nightly.sh
```

**3. Add to crontab**:
```bash
crontab -e

# Add line:
0 2 * * * /opt/evaluation/run-nightly.sh
```

### Option 3: Cloud Function (AWS Lambda)

**1. Create Lambda function** (Python):

```python
import json
import subprocess
import boto3

def lambda_handler(event, context):
    # Run evaluation via CLI
    result = subprocess.run([
        'agenteval', 'run',
        '--suite', 'Nightly Regression Suite',
        '--workflow', 'wf-456',
        '--wait'
    ], capture_output=True, text=True)

    # Export results
    results_json = subprocess.run([
        'agenteval', 'results',
        '--run', 'latest',
        '--format', 'json'
    ], capture_output=True, text=True)

    # Upload to S3
    s3 = boto3.client('s3')
    s3.put_object(
        Bucket='evaluation-results',
        Key=f'nightly/{context.request_id}.json',
        Body=results_json.stdout
    )

    # Send SNS notification if failed
    if result.returncode != 0:
        sns = boto3.client('sns')
        sns.publish(
            TopicArn='arn:aws:sns:region:account:evaluation-alerts',
            Subject='Nightly Evaluation Failed',
            Message=result.stderr
        )

    return {
        'statusCode': 200 if result.returncode == 0 else 500,
        'body': json.dumps({'success': result.returncode == 0})
    }
```

**2. Create CloudWatch Events rule**:
```bash
aws events put-rule \
  --name nightly-evaluation \
  --schedule-expression 'cron(0 2 * * ? *)'

aws events put-targets \
  --rule nightly-evaluation \
  --targets "Id"="1","Arn"="arn:aws:lambda:region:account:function:evaluation-runner"
```

### Expected Result

**Daily**:
- Evaluation runs at scheduled time
- Results exported automatically
- Alerts sent if failures occur

**Benefits**:
- Catch regressions early
- Track metrics over time
- No manual intervention needed

### Common Issues

**Issue**: Cron job doesn't run
→ **Solution**: Check cron daemon is running: `sudo service cron status`. Check syntax: `crontab -l`.

**Issue**: Environment variables not available in cron
→ **Solution**: Source them in script:
```bash
#!/bin/bash
source /etc/environment
source ~/.bashrc
# ... rest of script
```

**Issue**: Results not accessible
→ **Solution**: Store in shared location (S3, network drive). Use proper permissions.

### Next Steps

- Set up dashboard to visualize trends
- Create weekly/monthly summary reports
- Alert on metric degradation (not just failures)

---

## Additional Resources

- **USER_GUIDE.md**: Complete reference documentation
- **GRADERS.md**: Detailed grader API reference
- **TASKS.md**: Task schema reference
- **VIDEO_SCRIPTS.md**: Tutorial video scripts
- **HELP_TEXT_DICTIONARY.md**: All tooltip text

---

## Contributing Recipes

Have a useful recipe? Contribute it!

1. Follow the recipe format above
2. Include all sections (goal, prerequisites, steps, expected result, issues, next steps)
3. Test your recipe before submitting
4. Submit PR with your recipe

---

*Last Updated: 2026-04-23*
*Version: 1.0*
*Total Recipes: 20*
