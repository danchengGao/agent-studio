# Video Scripts — Evaluation System Tutorial Series

**Series Title**: Mastering AI Agent Evaluation
**Total Videos**: 8
**Total Runtime**: ~30 minutes
**Audience**: Product managers, ML engineers, developers
**Style**: Screen recording with voiceover + callout boxes

---

## Video 1: Getting Started in 3 Minutes

**Runtime**: 3:00
**Difficulty**: Beginner
**Goal**: User creates their first evaluation and sees results

---

### [0:00–0:15] Hook

> **SCREEN**: Animated title card — "You built an AI agent. But does it actually work?"

**VOICEOVER**:
"You spent weeks building your AI agent. It works great in demos. But how do you know if it's consistent? Reliable? Better than last week? In this video, you'll run your first evaluation in under 3 minutes."

---

### [0:15–0:30] What We'll Do

> **SCREEN**: Split screen — left: simple chat interface; right: evaluation dashboard showing pass rates

**VOICEOVER**:
"We're going to create a simple test, run it against your agent, and read the results — no PhD required."

---

### [0:30–1:00] Navigate to Evaluation

> **SCREEN**: Main app → click "Evaluation" in left sidebar

**VOICEOVER**:
"Open the Evaluation tab from the left sidebar. If you don't see it, make sure you're in an Agent or Workflow project."

> **CALLOUT BOX**: "Evaluation works with both Agents and Workflows"

> **SCREEN**: If first time, the Quick Setup wizard opens automatically. Otherwise the empty state shows an "Add Suite" button.

**VOICEOVER**:
"If this is your first time here, a 5-step setup wizard opens automatically — it'll walk you through creating your first suite, adding a task, and running it. If you've dismissed the wizard, click 'Add Suite' and choose 'Blank Suite'."

---

### [1:00–1:30] Create a Suite

> **SCREEN**: Wizard Step 2, or "Add Suite → Blank Suite" dialog. Fields: Suite Name, Description

**VOICEOVER**:
"Give your suite a name — think of it as a test folder. I'll call this 'Basic Smoke Tests'."

> **SCREEN**: Type "Basic Smoke Tests" in name field, "Quick sanity checks" in description

**VOICEOVER**:
"The description is optional but helps your team understand the purpose."

> **SCREEN**: Click "Create Suite" → suite appears in list

---

### [1:30–2:00] Add a Task from Template

> **SCREEN**: Inside the suite → click "Add Task" → template gallery opens

**VOICEOVER**:
"Now add a task. Instead of building from scratch, use a template. For our first test, let's use 'Simple Output Check'."

> **SCREEN**: Hover over "Simple Output Check" template — tooltip shows "Tests that output contains expected text"

> **SCREEN**: Click template → task editor opens pre-filled

**VOICEOVER**:
"The template pre-fills everything. Just customize the input and expected output."

> **SCREEN**: Change `input_data` to `{"query": "What is 2+2?"}` and `expected_output` to `"4"`

---

### [2:00–2:30] Run the Evaluation

> **SCREEN**: Click "Save" → click "Run Suite"

**VOICEOVER**:
"Save the task and run the suite. The evaluation sends your input to the agent and checks if the output matches."

> **SCREEN**: Progress bar appears — "Running 3 trials…" → completes

**VOICEOVER**:
"We're running 3 trials — that means the same question asked 3 times — to catch inconsistencies."

---

### [2:30–3:00] Read Your First Results

> **SCREEN**: Results page opens automatically. Large green "100%" success rate shown.

**VOICEOVER**:
"And there it is — your first evaluation result. 100% success rate means the agent answered correctly every time."

> **SCREEN**: Click into the task → shows 3 green checkmarks (Trial 1, 2, 3)

> **CALLOUT BOX**: "Green = Pass. Red = Fail. Click any trial to see exactly what happened."

**VOICEOVER**:
"Click any trial to see the actual input, output, and what the grader checked. That's it! You've run your first evaluation."

---

### [3:00] End Card

> **SCREEN**: "Next: Understanding Your Results →"

**VOICEOVER**:
"In the next video, we'll dig deeper into what all those numbers actually mean."

---

---

## Video 2: Understanding Your Results (5 Minutes)

**Runtime**: 5:00
**Difficulty**: Beginner–Intermediate
**Goal**: User understands every metric and number on the results page

---

### [0:00–0:20] Hook

> **SCREEN**: Results dashboard with multiple metrics visible — success_rate, pass@k, flakiness, etc.

**VOICEOVER**:
"Your evaluation ran. Now you're staring at a dashboard full of numbers. Pass at k? Flakiness? Aggregate score? Let's decode every single one."

---

### [0:20–0:50] The Overview Tab

> **SCREEN**: Overview tab — 4 stat cards at top

**VOICEOVER**:
"The Overview tab shows your headline numbers. Let's go through each card."

> **SCREEN**: Highlight "Success Rate" card — shows 87%

**VOICEOVER**:
"Success Rate: What percentage of your tasks passed at least once across all trials. 87% means 87 out of 100 tasks had at least one successful run."

> **SCREEN**: Highlight "Average Score" card — shows 0.73

**VOICEOVER**:
"Average Score: When graders give partial credit — like a 0 to 1 quality score — this is the average across all trials. Higher is better."

> **SCREEN**: Highlight "Avg Latency" card — shows 1.2s

**VOICEOVER**:
"Average Latency: How long your agent took per task. Fast is good, but don't sacrifice quality for speed."

> **SCREEN**: Highlight "Total Trials" card — shows 150

**VOICEOVER**:
"Total Trials: Total individual runs across all tasks. More trials = more reliable statistics."

---

### [0:50–1:40] Pass@k and Pass^k

> **SCREEN**: Metrics tab → Pass@k section. Show a bar chart with k=1,2,3 on X-axis

**VOICEOVER**:
"Now the Metrics tab. The two most important numbers here are pass-at-k and pass-to-the-k."

> **SCREEN**: Animate: Task runs 3 times → Trial 1: FAIL, Trial 2: PASS, Trial 3: FAIL → highlight the one PASS

**VOICEOVER**:
"Pass-at-k asks: 'If I run this k times, what's the probability at least ONE run succeeds?' This is about capability — can your agent do it at all?"

> **CALLOUT BOX**: "pass@3 = 1 − (failure_rate)³"

> **SCREEN**: Same task → highlight that 2 out of 3 failed

**VOICEOVER**:
"Pass-to-the-k asks: 'If I run this k times, do ALL of them succeed?' This is about reliability — will it work every single time in production?"

> **CALLOUT BOX**: "pass^3 = (success_rate)³"

> **SCREEN**: Example table:
> | Metric | Value | Meaning |
> |--------|-------|---------|
> | pass@1 | 67% | Works 2 of 3 times |
> | pass@3 | 96% | Almost certainly works if you try |
> | pass^3 | 30% | Rarely works every time |

**VOICEOVER**:
"A high pass-at-k but low pass-to-the-k means your agent is capable but inconsistent. Fix the inconsistency."

---

### [1:40–2:20] Flakiness

> **SCREEN**: Flakiness score displayed — highlight the gauge (0 to 0.5)

**VOICEOVER**:
"Flakiness tells you how inconsistent your agent is. Zero means rock solid — same answer every time. 0.5 means completely random — like flipping a coin."

> **SCREEN**: Show two tasks side by side:
> - Task A: ✅✅✅ → Flakiness: 0.0
> - Task B: ✅❌✅ → Flakiness: 0.47

**VOICEOVER**:
"Task B is passing half the time and failing half the time — that's a flakiness of 0.47. In production, that means 50% of your users get wrong answers."

> **CALLOUT BOX**: "Target flakiness < 0.1 for production agents"

---

### [2:20–3:10] Graders Tab

> **SCREEN**: Graders tab → table of grader results

**VOICEOVER**:
"The Graders tab breaks down results by each individual check. If you have multiple graders per task, you can see which one is causing failures."

> **SCREEN**: Click on "Keyword Check" row → expands to show per-task results

**VOICEOVER**:
"Click any grader to see which specific tasks failed. This helps you pinpoint whether it's a format problem, a content problem, or a logic problem."

> **SCREEN**: Highlight a task with high weight grader failing

**VOICEOVER**:
"Tasks with high-weight graders matter more to your overall score. A weight-10 grader failing drags the score down much more than a weight-1 grader."

---

### [3:10–4:00] Traces Tab

> **SCREEN**: Traces tab → list of trials, each with status badge

**VOICEOVER**:
"The Traces tab is where you debug. Every trial has a complete record of what happened — what the agent called, what it returned, how long each step took."

> **SCREEN**: Click a FAILED trial → trace viewer opens

**VOICEOVER**:
"Click a failed trial. You'll see the execution trace — every tool call, every LLM response, every step."

> **SCREEN**: Expand a tool call node → show inputs and outputs

> **CALLOUT BOX**: "Click any node to see inputs, outputs, and timing"

**VOICEOVER**:
"Find the step where things went wrong. Did the agent call the wrong tool? Get confused? Return the right answer in the wrong format?"

---

### [4:00–4:40] Comparing Runs Over Time

> **SCREEN**: Run history list — 5 previous runs with dates and scores

**VOICEOVER**:
"Every time you run an evaluation, the results are saved. You can compare runs over time to track improvement — or catch regressions."

> **SCREEN**: Click "Compare" between two runs → side-by-side diff

**VOICEOVER**:
"The comparison view highlights what changed. Green means improved. Red means regressed. Use this after every model update or prompt change."

---

### [4:40–5:00] Summary

> **SCREEN**: Annotated results page with all key terms labeled

**VOICEOVER**:
"To recap: Success Rate is headline pass/fail. Pass@k measures capability. Pass^k measures reliability. Flakiness measures consistency. And Traces let you debug individual failures. You now have everything you need to understand your results."

---

---

## Video 3: Creating Tasks the Right Way (4 Minutes)

**Runtime**: 4:00
**Difficulty**: Beginner–Intermediate
**Goal**: User creates a well-structured task with clear inputs, expected outputs, and appropriate graders

---

### [0:00–0:20] Hook

> **SCREEN**: Two tasks side by side — one vague, one well-structured

**VOICEOVER**:
"The quality of your evaluation is only as good as the quality of your tasks. A badly written task gives you meaningless results. Let's build tasks that actually tell you something."

---

### [0:20–0:50] The Anatomy of a Task

> **SCREEN**: Task editor with all fields visible — 2×2 grid in the lower half: Input Data (top-left), Expected Output (top-right), Graders (bottom-left), Pattern Checks (bottom-right)

**VOICEOVER**:
"A task has six key parts."

> **SCREEN**: Highlight each as mentioned:
1. **Task Name** — "What you're testing"
2. **Trials** — "How many times to run it"
3. **Input Data** — "What you send to the agent (top-left of the editor)"
4. **Expected Output** — "What a correct answer looks like (top-right)"
5. **Graders** — "How to check the answer (bottom-left)"
6. **Pattern Checks** — "Which structural patterns to validate (bottom-right)"

> **CALLOUT BOX**: "The editor uses a 2×2 layout: Input | Expected on top, Graders | Pattern Checks below"

---

### [0:50–1:30] Writing Good Input Data

> **SCREEN**: Task editor → Input Data field

**VOICEOVER**:
"Input data is a JSON object. The keys depend on your agent's interface. Most agents accept a 'query' field."

> **SCREEN**: Type example:
```json
{
  "query": "Summarize this article about climate change in 2 sentences",
  "context": "Scientists report record temperatures in 2024..."
}
```

**VOICEOVER**:
"Be specific. Vague inputs produce vague outputs that are hard to evaluate. Include all the context the agent needs."

> **CALLOUT BOX**: "Tip: Use real examples from production, not toy examples"

---

### [1:30–2:00] Writing Expected Output

> **SCREEN**: Expected output field

**VOICEOVER**:
"Expected output tells the grader what 'correct' looks like. But here's the key insight — it depends on your grader type."

> **SCREEN**: Three examples:
- For exact match: `"The answer is 42"`
- For contains check: `"climate"` (just a keyword)
- For model grader: `"A 2-sentence summary covering temperature and impact"` (description)

**VOICEOVER**:
"For exact matches, write the exact string. For keyword checks, just write the keyword. For quality graders, describe what a good answer looks like — the AI judge will interpret it."

---

### [2:00–2:50] Choosing the Right Number of Trials

> **SCREEN**: Trials field with a slider — 1 to 20

**VOICEOVER**:
"How many trials should you run? It depends on how variable your agent is."

> **SCREEN**: Decision tree:
```
Agent uses temperature 0 → 3 trials is enough
Agent uses temperature > 0 → 5-10 trials recommended
LLM judge (model grader) → 5+ trials for stable scores
Critical production feature → 10-20 trials
```

**VOICEOVER**:
"More trials = more reliable statistics but longer run time. Start with 3, increase if you see high flakiness."

> **CALLOUT BOX**: "Rule of thumb: flakiness > 0.2? Double your trials."

---

### [2:50–3:30] The One-Task-One-Thing Rule

> **SCREEN**: Bad example: one task testing format AND content AND latency

**VOICEOVER**:
"Common mistake: testing too many things in one task. If it fails, you don't know why."

> **SCREEN**: Good example: three separate tasks, each testing one thing

**VOICEOVER**:
"Instead, create separate tasks for each concern. One for format. One for content quality. One for latency. Now when something fails, you know exactly what to fix."

---

### [3:30–4:00] Saving and Organizing Tasks

> **SCREEN**: Tags field — type "smoke-test, production, v2"

**VOICEOVER**:
"Use tags to organize tasks. Tag by environment, version, feature area. You can filter results by tag to find patterns."

> **SCREEN**: Click Save → task appears in suite with green "Ready" badge

**VOICEOVER**:
"Save the task. It's ready to run. In the next video, we'll look at grader types in detail — because choosing the right grader is the difference between useful data and useless data."

---

---

## Video 4: Grader Types Explained (3 Minutes)

**Runtime**: 3:00
**Difficulty**: Intermediate
**Goal**: User understands all 3 grader types and when to use each

---

### [0:00–0:15] Hook

**VOICEOVER**:
"There are three ways to grade an AI answer: rules, another AI, or your own code. Each has strengths and weaknesses. Let's match the right grader to the right situation."

---

### [0:15–1:00] Type 1: Deterministic Graders

> **SCREEN**: Grader config → Type: Deterministic → check_type dropdown

**VOICEOVER**:
"Deterministic graders use rules. No AI, no ambiguity. The answer either matches or it doesn't."

> **SCREEN**: Tabs for each check type with visual example:

**Contains** (0:25):
> "Does the output contain this text?"
> ✅ Good for: keyword presence, required phrases

**Equals** (0:32):
> "Is the output exactly this?"
> ✅ Good for: yes/no questions, fixed format outputs

**Regex** (0:39):
> "Does output match this pattern?"
> ✅ Good for: email formats, phone numbers, structured data

**Range** (0:46):
> "Is the number between X and Y?"
> ✅ Good for: numeric outputs, scores, lengths

**JSON Schema** (0:53):
> "Does the JSON match this structure?"
> ✅ Good for: structured outputs, API responses

**VOICEOVER**:
"Use deterministic graders whenever you have an objective, unambiguous right answer. They're fast, free, and 100% reproducible."

---

### [1:00–1:45] Type 2: Model-Based Graders

> **SCREEN**: Grader config → Type: Model-Based → rubric text area

**VOICEOVER**:
"Model-based graders use an AI to judge the output. Perfect for subjective quality that's hard to capture in a rule."

> **SCREEN**: Example rubric:
```
Score the response on:
- Accuracy (0-10): Does it correctly answer the question?
- Clarity (0-10): Is it easy to understand?
- Conciseness (0-10): Does it avoid unnecessary words?
Return a JSON with scores for each dimension.
```

**VOICEOVER**:
"Write a rubric that describes what good looks like. The AI judge reads both the output and the rubric, then gives a score."

> **CALLOUT BOX**: "⚠️ Model graders cost tokens and have variability — always run 5+ trials"

**VOICEOVER**:
"Use model graders for: writing quality, helpfulness, tone, reasoning quality, or anything that requires judgment."

---

### [1:45–2:30] Type 3: Code-Based Graders

> **SCREEN**: Grader config → Type: Code-Based → Python code editor

**VOICEOVER**:
"Code-based graders let you write Python to evaluate the output. Full flexibility — any logic you can code, you can grade."

> **SCREEN**: Example code:
```python
def grade(output, expected, context):
    # Check if answer is within 10% of expected
    try:
        actual = float(output.strip())
        expected_val = float(expected)
        tolerance = abs(expected_val * 0.1)
        if abs(actual - expected_val) <= tolerance:
            return {"passed": True, "score": 1.0}
        else:
            error = abs(actual - expected_val) / abs(expected_val)
            return {"passed": False, "score": max(0, 1 - error)}
    except ValueError:
        return {"passed": False, "score": 0, "reason": "Not a number"}
```

**VOICEOVER**:
"Use code graders for: mathematical tolerance checking, custom business logic, database validation, or anything requiring computation."

---

### [2:30–3:00] Choosing and Combining

> **SCREEN**: Decision flowchart:
```
Is there a single right answer?
  YES → Deterministic grader
  NO → Is it about quality/style?
    YES → Model-based grader
    NO → Need custom logic?
      YES → Code-based grader
```

> **SCREEN**: Multi-grader example — 3 graders with weights

**VOICEOVER**:
"You can combine graders. Maybe 70% weight on quality (model grader) and 30% on format (deterministic). The final score is the weighted average."

**VOICEOVER**:
"That's the grader toolkit. Pick based on what 'correct' means for your use case."

---

---

## Video 5: Custom Metrics (4 Minutes)

**Runtime**: 4:00
**Difficulty**: Advanced
**Goal**: User creates a custom aggregate metric with Python

---

### [0:00–0:20] Hook

> **SCREEN**: Standard metrics panel → then Custom Metrics section below

**VOICEOVER**:
"The built-in metrics cover most cases. But what if you need something specific — like 'what's the pass rate on just the hard tasks?' or 'what's my cost per correct answer?' Custom metrics let you compute anything."

---

### [0:20–0:50] What Custom Metrics Are

> **SCREEN**: Diagram showing flow: All Trial Results → Custom Metric Function → New Number

**VOICEOVER**:
"Custom metrics are Python functions that run after all trials complete. They receive the full dataset — every trial result, score, latency, tags — and return a number."

> **CALLOUT BOX**: "Custom metrics run post-hoc — they don't affect the grading process"

---

### [0:50–1:30] Your First Custom Metric

> **SCREEN**: Open a completed run → click "Custom Metrics" tab → "Add Metric" button

**VOICEOVER**:
"Open any completed run, switch to the Custom Metrics tab, and add a new one. Custom metrics live in the run results view — not in the suite editor."

> **SCREEN**: Code editor opens with template:
```python
def compute(results):
    """
    results: list of trial results
    Each result has: task_name, passed, score, latency_ms, tags, trial_index

    Return: a single float
    """
    pass
```

**VOICEOVER**:
"The function receives a list of result objects. Your job is to return a single float — your metric value."

> **SCREEN**: Fill in a simple metric:
```python
def compute(results):
    # Pass rate on tasks tagged 'critical'
    critical = [r for r in results if 'critical' in r.get('tags', [])]
    if not critical:
        return 0.0
    passed = sum(1 for r in critical if r['passed'])
    return passed / len(critical)
```

**VOICEOVER**:
"This calculates the pass rate on tasks tagged 'critical'. After saving, this number appears in your metrics panel every time you run the suite."

---

### [1:30–2:20] Three Useful Patterns

> **SCREEN**: Three code snippets side by side

**Pattern 1 — Cost Per Correct Answer** (1:35):
```python
def compute(results):
    correct = [r for r in results if r['passed']]
    if not correct:
        return float('inf')
    total_tokens = sum(r.get('token_usage', {}).get('total', 0)
                      for r in correct)
    return total_tokens / len(correct)
```
> Label: "Lower is better — efficiency metric"

**Pattern 2 — Tag-Segment Pass Rate** (1:50):
```python
def compute(results):
    # Pass rate for tasks tagged 'regression' vs the overall rate
    regression = [r for r in results if 'regression' in r.get('tags', [])]
    if not regression:
        return 0.0
    passed = sum(1 for r in regression if r.get('passed'))
    return passed / len(regression)
```
> Label: "Regression suite health — are we breaking existing functionality?"

**Pattern 3 — Regression Rate** (2:05):
```python
def compute(results):
    # Proportion of tasks that regressed vs baseline
    regressions = [r for r in results
                   if r.get('baseline_passed') and not r['passed']]
    return len(regressions) / len(results) if results else 0
```
> Label: "How much did we break?"

---

### [2:20–3:10] Adding Display Options

> **SCREEN**: Metric config panel — Name, Unit, Description, Thresholds

**VOICEOVER**:
"After the function, configure how the metric displays."

> **SCREEN**: Fill in:
- **Name**: "Critical Task Pass Rate"
- **Unit**: "%"
- **Description**: "Pass rate on tasks tagged critical"
- **Warning threshold**: 0.8 (show yellow below 80%)
- **Failure threshold**: 0.6 (show red below 60%)

**VOICEOVER**:
"Set thresholds to turn your metric into a traffic light. Green means good. Yellow means warning. Red means action needed."

> **SCREEN**: Results panel showing the metric with a yellow warning indicator

---

### [3:10–3:40] Testing Your Metric

> **SCREEN**: "Test Metric" button → inline test runner

**VOICEOVER**:
"Before saving, test your metric against the last run. If there's a Python error, it'll show here so you can fix it."

> **SCREEN**: Test runs → shows computed value: 0.73

> **CALLOUT BOX**: "Common errors: KeyError (field doesn't exist), ZeroDivisionError (no results), TypeError (wrong type)"

---

### [3:40–4:00] Wrap-up

**VOICEOVER**:
"Custom metrics unlock the ability to track business-specific quality signals that standard metrics can't capture. What matters most for your use case? Build a metric for it."

---

---

## Video 6: Using Pre-Built Benchmarks (2 Minutes)

**Runtime**: 2:00
**Difficulty**: Beginner
**Goal**: User loads and runs a benchmark suite in 2 minutes

---

### [0:00–0:15] Hook

**VOICEOVER**:
"Want to know if your agent handles complex workflows? We've pre-built 17 benchmarks — 7 pattern-based and 10 domain-based. Load one in 30 seconds."

---

### [0:15–0:45] Browse Benchmarks

> **SCREEN**: Suite list → click "Add Suite" button → chooser dialog appears → click "Add from Library"

**VOICEOVER**:
"Click 'Add Suite' from the suite list, then choose 'Add from Library'. A dialog opens with four tabs."

> **SCREEN**: Library dialog — four tabs highlighted: Domain Benchmarks (selected by default), Pattern Benchmarks, Quick Start Templates, Debug & Testing

**VOICEOVER**:
"The Domain Benchmarks tab opens by default — 10 production-ready suites covering real-world use cases. Switch to Pattern Benchmarks for 7 structural workflow tests."

> **SCREEN**: Domain Benchmarks tab — cards: Customer Support, RAG System, Code Generation, Content Moderation, Data Extraction, Research Agent, Translation Agent, Email Assistant, SQL Agent, Conversational Agent

> **SCREEN**: Click "Pattern Benchmarks" tab — cards appear:
- 🧮 **Calculator** — Basic arithmetic accuracy
- 🔀 **Routing** — Decision routing to correct tools
- ⛓️ **Chaining** — Multi-step sequential tasks
- ⚡ **Parallelization** — Concurrent task execution
- 🎯 **Orchestrator-Worker** — Complex task delegation
- 🔄 **Evaluator-Optimizer** — Self-improvement loops
- 🧠 **Memory Usage** — Long-term context retention

> **CALLOUT BOX**: "Cards marked 'Needs AI model' require a model configured in Settings → Models"

---

### [0:45–1:15] Load and Run

> **SCREEN**: Click the "Routing" benchmark card — card highlights; Suite Name field at bottom pre-fills with "Routing Benchmark"

**VOICEOVER**:
"Click any card to select it. The Suite Name field at the bottom pre-fills — rename it if you want. If the suite uses AI judge graders, a warning banner appears above the name."

> **SCREEN**: Click "Add to My Suites" button → dialog closes → suite appears in the left panel, selected

> **SCREEN**: Click "▶ Run Evaluation" → run dialog → choose workflow/agent → click "Start Run" → progress bar

**VOICEOVER**:
"Click 'Add to My Suites' — the benchmark is created instantly with all tasks and graders pre-configured. Then click 'Run Evaluation' to start. Results appear in the Runs tab."

---

### [1:15–1:45] Read Benchmark Results

> **SCREEN**: Results page — specific to routing benchmark

**VOICEOVER**:
"Benchmark results work the same as your custom suites. But benchmarks also check for structural patterns in your agent's execution."

> **CALLOUT BOX**: "Pattern Validation checks HOW your agent works, not just WHAT it returns"

> **SCREEN**: Pattern validation section showing "ROUTING pattern ✅ detected"

**VOICEOVER**:
"The pattern validator inspects the execution trace to verify your agent actually uses routing logic — not just that it returns the right answer."

---

### [1:45–2:00] Wrap-up

**VOICEOVER**:
"Benchmarks are also great for checking if your agent still works after you change the underlying model or prompts. Run them after every major update."

---

---

## Video 7: Debugging Failures (5 Minutes)

**Runtime**: 5:00
**Difficulty**: Intermediate
**Goal**: User systematically identifies and fixes the root cause of evaluation failures

---

### [0:00–0:20] Hook

> **SCREEN**: Results page with 40% success rate and multiple red failures

**VOICEOVER**:
"Your evaluation ran and 60% of tasks failed. Don't panic. There's a systematic way to find root causes and fix them. Let's walk through the debugging workflow."

---

### [0:20–0:55] Step 1: Find the Pattern

> **SCREEN**: Overview tab → sort by status → failed tasks grouped

**VOICEOVER**:
"First, look for patterns in what's failing. Sort by status to group failures together."

> **SCREEN**: Filter by tag "format" → all format-tagged tasks show as failing

**VOICEOVER**:
"Filter by tags to see if failures cluster around a specific feature, task type, or difficulty level."

> **SCREEN**: Metrics tab → Graders section → "Format Check" grader has 100% failure rate

**VOICEOVER**:
"Check the Graders tab. If one specific grader is failing on all tasks, the problem is likely in that grader's expectations — not your agent."

> **CALLOUT BOX**: "If 1 grader fails 100% → check the grader config first. If all graders fail → check the agent."

---

### [0:55–1:40] Step 2: Inspect a Specific Failure

> **SCREEN**: Click failed task → Traces tab → click first failed trial

**VOICEOVER**:
"Pick one specific failure and dig into it. Open the Traces tab and click the failed trial."

> **SCREEN**: Trace viewer opens — node graph on left, details panel on right

**VOICEOVER**:
"The trace shows every step the agent took. Look for where things went wrong."

> **SCREEN**: Click a node labeled "Tool Call: search" — details show the query sent and result received

> **SCREEN**: Click next node "LLM Response" — shows the model's output

> **CALLOUT BOX**: "The red node is where the failure was detected, but the cause might be earlier"

**VOICEOVER**:
"Important: the red node is where the failure was detected, but the root cause is often earlier in the chain. Work backwards from the failure point."

---

### [1:40–2:20] Step 3: Check the Grader Output

> **SCREEN**: Trial detail → Grader Results section at bottom

**VOICEOVER**:
"Scroll down to the grader output. This shows exactly what the grader received and why it failed."

> **SCREEN**: Grader output panel:
```
Input to grader:
  Output: "The answer is forty-two"
  Expected: "42"

Grader result: FAILED
Reason: "Output does not contain '42'.
         Found 'forty-two' instead."
```

**VOICEOVER**:
"There it is. The agent returned 'forty-two' as words, but the grader expected the numeral '42'. Now we know exactly what to fix."

> **SCREEN**: Two fix options highlighted:
1. Update grader to accept word form
2. Update prompt to request numeral form

---

### [2:20–3:00] Step 4: Fix the Root Cause

> **SCREEN**: Two paths — Option A (fix agent), Option B (fix grader)

**VOICEOVER**:
"You have two choices: fix the agent's output, or fix the grader's expectations. Make sure you're fixing the right thing."

> **SCREEN**: Prompt editor — add instruction "Always return numbers as numerals, not words"

**VOICEOVER**:
"If the agent should be returning numerals, fix the prompt. Add explicit instructions about output format."

> **SCREEN**: Grader editor — change expected from "42" to a regex `\b(42|forty-two)\b`

**VOICEOVER**:
"Or if both formats are acceptable, update the grader to accept both. Use a regex or a Contains check instead of Equals."

---

### [3:00–3:40] Step 5: Verify the Fix

> **SCREEN**: Re-run just the failed tasks → select 3 failed tasks → "Run Selected"

**VOICEOVER**:
"Don't re-run the entire suite. Select just the failed tasks and run those. This is faster and focuses your debugging loop."

> **SCREEN**: Results update — 3 previously failed tasks now green

> **CALLOUT BOX**: "Run selected tasks → fix → run again → repeat until green"

---

### [3:40–4:20] Common Failure Patterns

> **SCREEN**: Reference table

**VOICEOVER**:
"Here are the most common failure patterns and their typical causes."

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| All tasks fail | Wrong agent endpoint | Check agent URL |
| One grader fails all | Grader misconfigured | Check expected value |
| High flakiness | Temp > 0 + vague prompt | Be more specific |
| Passes sometimes | Race condition or timeout | Increase timeout |
| Pattern not detected | Wrong workflow structure | Check agent design |

---

### [4:20–5:00] Build a Debugging Habit

> **SCREEN**: Suggested workflow diagram

**VOICEOVER**:
"Make evaluation part of your development loop: run evaluations after every significant change. When failures appear, use the 5-step process: find the pattern, inspect a failure, check grader output, fix root cause, verify. Over time, failures become rarer and you'll build confidence in your agent's reliability."

---

---

## Video 8: Advanced Patterns & Architecture Testing (4 Minutes)

**Runtime**: 4:00
**Difficulty**: Advanced
**Goal**: User understands how to evaluate complex multi-step workflows with pattern validation

---

### [0:00–0:20] Hook

> **SCREEN**: Complex workflow diagram with multiple agents and tools connected

**VOICEOVER**:
"Testing a simple question-answer agent is easy. But what about a workflow with 5 agents, 3 tools, parallel branches, and memory? That's where pattern testing comes in."

---

### [0:20–1:00] The 6 Workflow Patterns

> **SCREEN**: Pattern gallery — 6 animated diagrams

**VOICEOVER**:
"The evaluation system recognizes 6 structural patterns in your agent's execution trace."

> **SCREEN**: Each pattern with animated diagram:

1. **ROUTING** — "Agent picks between multiple paths. Like an IF statement."
2. **CHAINING** — "Output of step 1 becomes input of step 2."
3. **PARALLELIZATION** — "Multiple steps run at the same time."
4. **ORCHESTRATOR_WORKER** — "One agent delegates to specialized sub-agents."
5. **EVALUATOR_OPTIMIZER** — "Agent evaluates its own output and improves it."
6. **MEMORY_USAGE** — "Agent reads or writes to long-term memory."

---

### [1:00–1:40] Setting the Expected Pattern

> **SCREEN**: Task editor — bottom-right quadrant shows "Pattern Checks" section with a 2-column grid of checkboxes: Routing, Chaining, Parallelisation, Orchestrator–Worker, Evaluator–Optimizer, Memory Usage

**VOICEOVER**:
"When creating a task for a workflow, use the Pattern Checks section in the bottom-right of the editor. Tick any structural patterns you want to validate. You can select multiple simultaneously."

> **SCREEN**: Tick the "Orchestrator–Worker" checkbox — it checks with a blue fill

> **SCREEN**: Also tick "Chaining" — now two patterns are checked

**VOICEOVER**:
"For an orchestrator workflow that also chains steps, tick both Orchestrator–Worker and Chaining. Each checked pattern adds a separate pass/fail result in the grader output. Leave all boxes unchecked if you only care about the final answer — no pattern validation will run."

> **CALLOUT BOX**: "Multiple patterns can be selected — each adds its own grader result alongside your content graders"

---

### [1:40–2:20] Reading Pattern Validation Results

> **SCREEN**: Results → Traces tab → expand a trial → Grader Details table — pattern check graders appear as separate rows below content graders

**VOICEOVER**:
"After running, expand any trial in the Traces tab. Pattern checks appear as separate grader rows in the Grader Details table — one row per ticked pattern."

> **SCREEN**: Grader Details table showing:
```
✅  pattern_check_orchestrator_worker   100%   pattern   Detected: YES
✅  pattern_check_chaining              100%   pattern   Detected: YES
✅  result_quality (model grader)        85%   model_based  ...
```

> **SCREEN**: Failed example — a trial where parallelisation wasn't detected:
```
❌  pattern_check_parallelisation         0%   pattern   Detected: NO
                                                         Evidence: components ran sequentially
✅  content_check                        100%   deterministic  output matched
```

**VOICEOVER**:
"Even if your content grader passes — the agent gave the right answer — a pattern failure tells you the architectural implementation is wrong. Here the content check passed but the parallelisation check failed: the workflow ran steps sequentially instead of in parallel."

> **CALLOUT BOX**: "Content grader passing + pattern grader failing = right answer, wrong architecture"

---

### [2:20–3:00] Evaluating Multi-Agent Systems

> **SCREEN**: Complex trace viewer — multiple nested agents

**VOICEOVER**:
"For multi-agent systems, the trace viewer shows nested execution. The orchestrator agent is the root. Worker agents appear as children."

> **SCREEN**: Expand orchestrator node → 3 worker agents appear as children

> **SCREEN**: Click worker agent → shows its own sub-trace

**VOICEOVER**:
"Click any agent node to drill into its sub-trace. You can see exactly what each agent decided to do — and why it succeeded or failed."

> **CALLOUT BOX**: "Timing view: overlapping bars = parallel; sequential bars = chaining"

---

### [3:00–3:40] Best Practices for Complex Systems

> **SCREEN**: Recommendations panel

**VOICEOVER**:
"Three key principles for evaluating complex workflows."

> **SCREEN**: Principle 1 — **Test Each Agent Separately First**
"Create tasks that test individual agents in isolation before testing the full workflow. Isolate failure points."

> **SCREEN**: Principle 2 — **Use More Trials for Complex Flows**
"Complex workflows have more decision points and more opportunities for variability. Use 5-10 trials minimum."

> **SCREEN**: Principle 3 — **Set Pattern AND Content Graders**
"Always combine a pattern grader (checking architecture) with content graders (checking answers). Both dimensions matter."

---

### [3:40–4:00] Wrap-up

**VOICEOVER**:
"Pattern testing is what separates surface-level evaluation from deep architectural validation. You're not just checking if your agent gives right answers — you're verifying it works the right way. That's how you build AI systems you can actually trust in production."

---

---

## Production Notes

### Recording Checklist
- [ ] Use 1920×1080 resolution
- [ ] Record at 30fps
- [ ] Use dark theme in the app for better visibility
- [ ] Close all notifications before recording
- [ ] Use a microphone, not built-in laptop audio
- [ ] Record each video in one take per section (edit together)
- [ ] Add captions for accessibility

### Post-Production
- Add chapter markers matching timestamps above
- Add lower-third text when key terms are introduced
- Add callout boxes as described (yellow background, bold text)
- Animate diagrams in Figma or Keynote before screen recording

### Publishing
- YouTube: Full playlist "Mastering AI Agent Evaluation"
- Docs: Embed relevant videos inline in USER_GUIDE.md
- App: Link from help tooltips where applicable
- Each video standalone-watchable (no dependency on prior videos)

### Localization Priority
1. English (primary)
2. Chinese Simplified (large user base)
3. Japanese (enterprise customers)
