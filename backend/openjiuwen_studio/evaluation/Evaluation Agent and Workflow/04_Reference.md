# Evaluation Reference — Tasks, Graders & Presets

Complete reference for defining evaluation tasks, configuring graders, and using ready-made presets.

---

## Part 1: Task Schema

Tasks are the individual test cases within an evaluation suite. They can be defined inline via the API or as YAML files.

### Task Definition Schema

```yaml
task_id: "unique_task_identifier"         # Required, unique within suite
task_name: "Human-readable name"          # Required
description: "What this task tests"       # Optional

# Pattern type: 0=ROUTING, 1=CHAINING, 2=PARALLELIZATION,
#               3=ORCHESTRATOR_WORKER, 4=EVALUATOR_OPTIMIZER, 5=MEMORY_USAGE
pattern_type: 0

tags: ["routing", "sentiment"]            # Optional labels

trials: 3                                 # How many times to run (for pass@k)

input_data:                               # Dict passed to workflow/agent as input
  message: "I love this product!"
  context: "customer feedback"

expected_output:                          # Used by deterministic graders
  branch: "positive"
  sentiment: "positive"

graders_config:                           # List of grader configurations
  - name: "output_contains_positive"
    grader_type: 0                        # 0=DETERMINISTIC, 1=MODEL_BASED, 2=CODE_BASED
    config:
      check_type: "output_check"
      condition: "contains"
      expected_value: "positive"
      weight: 1.0
```

### `input_data`

Arbitrary JSON/dict that gets passed to the workflow or agent as its input. The exact keys depend on what your workflow expects.

### `expected_output`

Used by `output_check` and `state_check` graders as the comparison target.

### `trials`

Number of independent executions. Each trial gets a unique `conversation_id`. Used to compute:
- `pass@k`: probability ≥1 of k trials passes
- `pass^k`: probability all k trials pass

A value of `1` means pass@k = pass^1 = plain pass/fail.

### `tags`

Optional string labels (e.g., `["math", "regression"]`). Tags are stored and displayed with the task. Use them to organise and filter tasks within a suite.

---

## Part 2: Custom Aggregate Metrics

Custom metrics are defined at the **suite** level. They are Python functions that run *after* all trials complete and receive the full list of trial results as input.

Manage custom metrics via **Results → Custom Metrics tab** in the UI, or via API:

```json
{
  "evaluation_id": "...",
  "space_id": "...",
  "config": {
    "custom_metrics": [
      {
        "name": "weighted_pass_rate",
        "description": "Pass rate weighted by trial score",
        "code": "def compute(results):\n    if not results:\n        return 0.0\n    return sum(r.get('score', 0) for r in results if r.get('passed')) / len(results)"
      }
    ]
  }
}
```

The `compute(results)` function receives a list of dicts with fields: `task_id`, `passed`, `score`, `latency_ms`, `token_usage`, `error_message`, `grader_results`.

Return a `float` for a single value, or a `dict` for multiple sub-values. Results appear in the **Results → Custom Metrics** tab.

---

## Part 3: Grader Configuration

Graders evaluate the output of a single trial and return `{passed: bool, score: 0.0-1.0}`.

### Grader Types

| Type | Value | Description |
|------|-------|-------------|
| DETERMINISTIC | 0 | Rule-based checks — no LLM call |
| MODEL_BASED | 1 | LLM judge with rubric |
| CODE_BASED | 2 | Custom Python function |

---

### Deterministic Graders (`grader_type: 0`)

#### `output_check` — Compare final output

```yaml
- name: "output_contains_success"
  grader_type: 0
  config:
    check_type: "output_check"
    condition: "contains"          # see Conditions below
    expected_value: "success"
    path: "result.status"          # optional: dot-separated path into output
    weight: 1.0
```

#### `state_check` — Check a nested value in output

```yaml
- name: "score_above_threshold"
  grader_type: 0
  config:
    check_type: "state_check"
    path: "metrics.accuracy"
    condition: "ge"
    expected_value: 0.8
```

#### `tool_call_check` — Verify tools were called

```yaml
- name: "search_tool_was_called"
  grader_type: 0
  config:
    check_type: "tool_call_check"
    expected_tools: ["search_web", "calculator"]
```

#### `pattern_check` — Regex on full trace JSON

```yaml
- name: "trace_has_routing"
  grader_type: 0
  config:
    check_type: "pattern_check"
    pattern: "IF|condition|branch"
```

#### `transcript_check` — Count tool calls or components

```yaml
- name: "at_least_two_tools"
  grader_type: 0
  config:
    check_type: "transcript_check"
    metric: "tool_call_count"      # or "component_count"
    condition: "ge"
    expected_value: 2
```

#### Conditions

| Condition | Meaning |
|-----------|---------|
| `eq` | equal |
| `ne` | not equal |
| `gt` | greater than |
| `lt` | less than |
| `ge` | greater or equal |
| `le` | less or equal |
| `contains` | string contains |
| `not_contains` | string does not contain |
| `regex` | regex search match |
| `is_not_empty` | not None/empty string/list/dict |

---

### Model-Based Graders (`grader_type: 1`)

Uses an LLM judge to evaluate output quality.

```yaml
- name: "response_quality"
  grader_type: 1
  config:
    model_id: "your-model-id"
    rubric: >
      The response correctly identifies the topic as 'routing', provides
      a clear routing decision, and explains the reasoning.
    passing_score: 0.7             # score threshold to set passed=True
    assertions:                    # optional assertion list
      - "Response mentions the IF condition"
      - "Response routes to positive branch"
```

The LLM responds with JSON: `{"passed": true/false, "score": 0.0-1.0, "feedback": "..."}`.

---

### Code-Based Graders (`grader_type: 2`)

Define a custom Python grading function for arbitrary logic.

```yaml
- name: "custom_json_structure"
  grader_type: 2
  config:
    function_name: "grade"         # default: "grade"
    code: |
      import json
      def grade(trace, expected):
          output = trace.get("final_output", "")
          try:
              parsed = json.loads(output) if isinstance(output, str) else output
              has_name = "name" in parsed
              has_price = "price" in parsed
              passed = has_name and has_price
              return {"passed": passed, "score": 1.0 if passed else 0.0}
          except Exception:
              return {"passed": False, "score": 0.0}
```

#### Function Signature

```python
def grade(trace: dict, expected: dict) -> dict:
    """
    Args:
        trace: {
            "final_output": any,          # workflow/agent final output
            "chunks": list[dict],         # raw execution chunks
            "trace_id": str,
            "token_usage": dict | None,
        }
        expected: the task's expected_output dict

    Returns:
        {"passed": bool, "score": float}  # score in [0.0, 1.0]
    """
```

The function can also return a plain `bool` — it will be converted to `{"passed": bool, "score": 1.0/0.0}`.

---

### Multiple Graders & Scoring

When a task has multiple graders:

- The trial is considered **`passed`** only if every grader with a non-zero `weight` passes.
- The aggregate **`score`** is computed as a **weighted average**: `Σ(score_i × weight_i) / Σ(weight_i)`.
- Graders with `weight: 0` are run and recorded, but excluded from the pass/fail decision — useful for informational or diagnostic graders.

Each grader's name, pass rate, avg score, and trial count are visible in the **Graders** tab of the results view.

Example combining deterministic + model-based with explicit weights:

```yaml
graders_config:
  - name: "has_json_structure"
    grader_type: 0
    config:
      check_type: "output_check"
      condition: "contains"
      expected_value: "{"
    weight: 0.3
  - name: "content_quality"
    grader_type: 1
    config:
      model_id: "gpt-4"
      rubric: "The output is a valid, complete JSON with all required fields."
      passing_score: 0.7
    weight: 0.7
```

> **Note on weight placement:** `weight` is a top-level field on the grader config object, not nested inside `config`.

---

## Part 4: Grader Presets — Quick-Pick Configurations

Ready-to-use grader configurations for common evaluation scenarios. Copy any preset directly into your task's `graders_config` array.

### How to Use Presets

In the task editor, switch to JSON mode and paste the grader config:

```json
{
  "task_name": "My Task",
  "input_data": {"query": "..."},
  "expected_output": "...",
  "graders_config": [
    // ← Paste any preset here
  ]
}
```

Or use the visual grader editor and select "Load Preset" from the dropdown.

---

### Preset 1: Exact Answer Check

**Use when**: The output must be exactly one specific string.
**Best for**: Yes/No questions, specific codes, specific dates, classification labels.

```yaml
- name: "Exact Answer Check"
  type: 0                     # Deterministic
  weight: 10
  check_type: "equals"
  path: ""                    # Check the full output
  expected_value: "yes"       # ← Change this
  case_sensitive: false
```

```json
{
  "name": "Exact Answer Check",
  "type": 0,
  "weight": 10,
  "check_type": "equals",
  "path": "",
  "expected_value": "yes",
  "case_sensitive": false
}
```

**Variations**:

```json
// Case-sensitive exact match
{ "check_type": "equals", "expected_value": "ERROR_CODE_404", "case_sensitive": true }

// JSON field exact match
{ "check_type": "equals", "path": "status", "expected_value": "success" }

// Nested JSON field
{ "check_type": "equals", "path": "data.user.role", "expected_value": "admin" }
```

---

### Preset 2: Keyword Presence Check

**Use when**: The output must mention a specific topic or include required text.
**Best for**: Summaries, reports, responses that must reference certain terms.

```yaml
- name: "Contains Paris"
  type: 0
  weight: 10
  check_type: "contains"
  path: ""
  expected_value: "Paris"
  case_sensitive: false
```

**Multi-keyword variant** (use multiple graders, one per keyword):

```json
[
  { "name": "Mentions climate",     "type": 0, "weight": 3, "check_type": "contains", "expected_value": "climate" },
  { "name": "Mentions temperature", "type": 0, "weight": 3, "check_type": "contains", "expected_value": "temperature" },
  { "name": "Mentions emissions",   "type": 0, "weight": 4, "check_type": "contains", "expected_value": "emissions" }
]
```

---

### Preset 3: Format Validation (Regex)

**Use when**: Output must match a specific format like email, phone, date, or code pattern.
**Best for**: Structured data extraction, form validation, API response formatting.

```yaml
- name: "Valid Email Format"
  type: 0
  weight: 10
  check_type: "regex"
  path: ""
  pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
```

**Common regex patterns**:

```json
{ "name": "US Phone",        "check_type": "regex", "pattern": "^\\+?1?[-.\\s]?\\(?[2-9]\\d{2}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}$" }
{ "name": "Date YYYY-MM-DD", "check_type": "regex", "pattern": "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$" }
{ "name": "UUID v4",         "check_type": "regex", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$" }
{ "name": "Valid URL",       "check_type": "regex", "pattern": "^https?://[\\w\\-]+(\\.[\\w\\-]+)+[/#?]?.*$" }
{ "name": "JSON-like",       "check_type": "regex", "pattern": "^[\\s]*[{\\[][\\s\\S]*[}\\]][\\s]*$" }
{ "name": "Numeric Output",  "check_type": "regex", "pattern": "^-?\\d+(\\.\\d+)?$" }
```

---

### Preset 4: JSON Schema Validation

**Use when**: Output must be valid JSON with specific fields and types.
**Best for**: Structured data extraction, API response evaluation, tool output checking.

```yaml
- name: "Valid User JSON"
  type: 0
  weight: 10
  check_type: "json_schema"
  schema:
    type: "object"
    required: ["name", "email", "age"]
    properties:
      name:  { type: "string", minLength: 1 }
      email: { type: "string", format: "email" }
      age:   { type: "integer", minimum: 0, maximum: 150 }
```

```json
{
  "name": "Valid User JSON",
  "type": 0,
  "weight": 10,
  "check_type": "json_schema",
  "schema": {
    "type": "object",
    "required": ["name", "email", "age"],
    "properties": {
      "name":  { "type": "string", "minLength": 1 },
      "email": { "type": "string", "format": "email" },
      "age":   { "type": "integer", "minimum": 0, "maximum": 150 }
    }
  }
}
```

---

### Preset 5: Quality Assessment (Model Judge)

**Use when**: Quality is subjective — you need an AI to judge correctness, clarity, tone, or helpfulness.
**Best for**: Creative writing, customer service responses, explanations, summaries.

```yaml
- name: "Response Quality"
  type: 1                        # Model-Based
  weight: 10
  model: "claude-sonnet-4-6"
  passing_score: 0.7
  rubric: |
    Rate this response on a scale of 0.0 to 1.0 based on:
    1. Accuracy (40%): Is the information correct?
    2. Completeness (30%): Does it fully address the question?
    3. Clarity (20%): Is it easy to understand?
    4. Conciseness (10%): Does it avoid unnecessary content?
    Return ONLY: {"score": <float 0.0-1.0>, "passed": <bool>, "reasoning": "<brief>"}
```

**Specialized rubrics**:

```json
// Customer service tone
{
  "name": "Customer Service Quality", "type": 1, "passing_score": 0.8,
  "rubric": "Score 0.0-1.0: Professional tone 25%, Problem acknowledgment 25%, Clear solution 25%, Empathy 25%. Return: {\"score\": float, \"passed\": bool, \"reasoning\": string}"
}

// Safety check
{
  "name": "Safety Check", "type": 1, "passing_score": 1.0,
  "rubric": "Check for harmful/offensive content. Return: {\"score\": 1.0 if safe, 0.0 if harmful, \"passed\": bool, \"reasoning\": string}"
}
```

---

### Preset 6: Numeric Tolerance Check (Code-Based)

**Use when**: Output is a number that should be close to but not exactly a target value.
**Best for**: Mathematical computations, estimations, measurements, predictions.

```yaml
- name: "Within 10% Tolerance"
  type: 2
  weight: 10
  code: |
    def grade(output, expected, context):
        try:
            actual = float(str(output).strip().replace(',', ''))
            target = float(str(expected).strip().replace(',', ''))
        except (ValueError, AttributeError):
            return {"passed": False, "score": 0.0, "reason": "Could not parse numbers"}
        if target == 0:
            passed = abs(actual) < 0.001
            return {"passed": passed, "score": 1.0 if passed else 0.0}
        relative_error = abs(actual - target) / abs(target)
        tolerance = 0.10  # ← change this (0.05=strict, 0.20=lenient)
        if relative_error <= tolerance:
            score = 1.0 - (relative_error / tolerance) * 0.5
            return {"passed": True, "score": round(score, 3), "reason": f"Within {relative_error:.1%} error"}
        return {"passed": False, "score": 0.0, "reason": f"{relative_error:.1%} error exceeds {tolerance:.0%} tolerance"}
```

---

### Preset 7: Multi-Grader Quality Gate

**Use when**: You need to check multiple aspects and need all to pass.
**Best for**: Production quality gates, safety-critical applications, comprehensive evaluation.

```json
[
  {
    "name": "Format Check",
    "type": 0, "weight": 2,
    "check_type": "json_schema",
    "schema": { "type": "object", "required": ["answer", "confidence"] }
  },
  {
    "name": "Contains Answer",
    "type": 0, "weight": 3,
    "check_type": "contains", "path": "answer", "expected_value": "42"
  },
  {
    "name": "Quality Score",
    "type": 1, "weight": 5,
    "passing_score": 0.8,
    "rubric": "Is this a helpful, accurate response? Score 0.0-1.0.\nReturn: {\"score\": float, \"passed\": bool, \"reasoning\": string}"
  }
]
```

---

### Preset 8: Not Empty / Non-Null Check

**Use when**: You just need to verify the agent responded with something.
**Best for**: Baseline sanity checks, smoke tests, API availability checks.

```yaml
- name: "Response Not Empty"
  type: 2
  weight: 10
  code: |
    def grade(output, expected, context):
        if output is None:
            return {"passed": False, "score": 0.0, "reason": "Output is None"}
        cleaned = str(output).strip()
        if not cleaned or cleaned.lower() in ["null", "none", "undefined", "n/a"]:
            return {"passed": False, "score": 0.0, "reason": f"Empty or null-like: '{cleaned}'"}
        return {"passed": True, "score": 1.0, "reason": f"Output has {len(cleaned)} characters"}
```

---

### Preset 9: Latency Check

**Use when**: Response time is a critical quality requirement.
**Best for**: Real-time applications, SLA monitoring, performance regression testing.

```yaml
- name: "Response Under 2 Seconds"
  type: 2
  weight: 10
  code: |
    def grade(output, expected, context):
        latency_ms = context.get("latency_ms", 0)
        max_ms = 2000  # ← change this
        if latency_ms <= max_ms:
            score = 1.0 - (latency_ms / max_ms) * 0.5
            return {"passed": True, "score": round(score, 3), "reason": f"{latency_ms}ms ≤ {max_ms}ms"}
        over_ratio = (latency_ms - max_ms) / max_ms
        score = max(0.0, 0.5 - over_ratio)
        return {"passed": False, "score": round(score, 3), "reason": f"{latency_ms}ms exceeds {max_ms}ms"}
```

---

### Preset 10: Comparison to Baseline

**Use when**: You want to compare the current agent output to a known-good baseline.
**Best for**: Regression testing, A/B testing between models, before/after prompt changes.

```yaml
- name: "No Regression from Baseline"
  type: 2
  weight: 10
  code: |
    def grade(output, expected, context):
        if not expected or not output:
            return {"passed": False, "score": 0.0, "reason": "Missing output or baseline"}
        output_words = set(str(output).lower().split())
        baseline_words = set(str(expected).lower().split())
        if not baseline_words:
            return {"passed": True, "score": 1.0, "reason": "Empty baseline"}
        intersection = output_words & baseline_words
        union = output_words | baseline_words
        similarity = len(intersection) / len(union) if union else 0
        passed = similarity >= 0.5
        return {"passed": passed, "score": round(similarity, 3), "reason": f"Similarity: {similarity:.1%}"}
```

---

## Quick Reference Tables

### Choosing the Right Preset

| Situation | Recommended Preset |
|-----------|-------------------|
| Answer must be exact (yes/no, specific code) | Preset 1: Exact Answer |
| Answer must mention something | Preset 2: Keyword Presence |
| Answer must follow a format | Preset 3: Regex / Preset 4: JSON Schema |
| Quality matters (writing, explanations) | Preset 5: Model Judge |
| Output is a number with tolerance | Preset 6: Numeric Tolerance |
| Multiple requirements must all pass | Preset 7: Multi-Grader Gate |
| Just check the agent responded | Preset 8: Not Empty |
| Speed is a requirement | Preset 9: Latency Check |
| Checking for regressions | Preset 10: Baseline Comparison |

### Grader Type Reference

| Type | Value | Description | Cost | Reproducibility |
|------|-------|-------------|------|-----------------|
| Deterministic | 0 | Rule-based checks | Free | 100% |
| Model-Based | 1 | LLM judge | Token cost | ~90% |
| Code-Based | 2 | Python function | Free | 100% |

### Check Type Reference (Deterministic Only)

| check_type | Description | expected_value |
|------------|-------------|----------------|
| `contains` | Output contains string | Required |
| `equals` | Output equals string exactly | Required |
| `regex` | Output matches pattern | Use `pattern` field |
| `range` | Output is number in range | Use `min`/`max` fields |
| `json_schema` | Output matches JSON schema | Use `schema` field |
