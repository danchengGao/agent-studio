# Importing a Benchmark from Another System

If you already have a benchmark, test dataset, or evaluation suite in another tool — LangSmith, Promptfoo, OpenAI Evals, HELM, an internal spreadsheet, or any custom system — you can migrate it into OpenJiuwen Evaluation without starting from scratch.

---

## What You Need to Map

Every evaluation system represents the same ideas differently. Here is how they translate:

| Your old system | OpenJiuwen |
|---|---|
| Test case / example | Task |
| Test group / category | Suite (or use tags) |
| Assertion / check | Grader |
| Expected exact answer | Rule-based grader (`check_type: exact`) |
| Regex or contains check | Rule-based grader (`check_type: contains` / `regex`) |
| LLM-as-judge rubric | LLM grader with `rubric:` |
| Custom scoring code | Code grader (Python function) |
| Number of repeat runs | `num_trials` per task |
| Dataset CSV / JSON file | Input to migration script |

---

## Option 1 — YAML File (easiest, self-hosted)

Write a `.yaml` file and drop it in `backend/openjiuwen_studio/marketplace/benchmarks/`. After restarting the backend it appears in **Load Pre-built Benchmark**.

```yaml
suite:
  name: "My Imported Benchmark"
  description: "Migrated from LangSmith / internal tool"

tasks:
  - task_name: "Capital city — France"
    input_data:
      query: "What is the capital of France?"
    expected_output: "Paris"
    num_trials: 3
    difficulty: "easy"
    graders_config:
      - name: "Contains Paris"
        type: 0           # 0 = rule-based
        weight: 5
        check_type: "contains"
        expected_value: "Paris"
        case_sensitive: false

  - task_name: "Summarise complaint"
    input_data:
      query: "Summarise: The product arrived broken and customer service ignored me."
    expected_output: "Short professional summary of the complaint"
    num_trials: 5
    graders_config:
      - name: "Quality judge"
        type: 1           # 1 = LLM grader
        weight: 5
        passing_score: 0.7
        rubric: |
          Score 0.0–1.0: Is the summary accurate and professional?
          Return: {"score": float, "passed": bool, "reasoning": string}
```

**Grader type values:** `0` = rule-based, `1` = LLM / model judge, `2` = custom Python code.

---

## Option 2 — Python SDK (recommended for large datasets)

Use the built-in SDK to write a one-time migration script. It works with any source format: CSV, JSON, a database, another vendor's export file.

```python
from openjiuwen_studio.evaluation.sdk import EvaluationClient

client = EvaluationClient(
    api_url="http://your-instance:8000",
    token="<your-jwt>",
    space_id="<space-id>",
)

# 1. Create the suite once
suite = client.create_suite(
    "My Imported Benchmark",
    description="Migrated from our internal test harness",
)

# 2. Loop over your existing test cases
#    (replace this with your real data source)
import csv
with open("my_benchmark.csv") as f:
    for row in csv.DictReader(f):
        task = (
            client.task_builder(row["name"])
            .input(query=row["input"])
            .expected_output(answer=row["expected"])
            .trials(5)
            # Rule-based check
            .grader_exact_match(path="answer", expected=row["expected"])
            # Optional: add an LLM quality judge as well
            # .grader_model(criteria="The answer is factually correct and concise")
            .build()
        )
        client.add_task(suite.evaluation_id, task)

print(f"Imported {suite.evaluation_id} — ready to run.")
```

Install the SDK from the backend package:

```bash
pip install openjiuwen-studio
```

---

## Option 3 — REST API (any language or CI pipeline)

Call the API directly — useful for non-Python environments or existing automation.

```bash
# Step 1: create the suite
SUITE_ID=$(curl -s -X POST https://host/api/v1/evaluation/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"suite_name":"My Benchmark","space_id":"<id>"}' \
  | jq -r '.data.evaluation_id')

# Step 2: add tasks (repeat for each test case)
curl -X POST https://host/api/v1/evaluation/task/add \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d "{
    \"evaluation_id\": \"$SUITE_ID\",
    \"task_name\": \"Test case 1\",
    \"input_data\": {\"query\": \"What is 2+2?\"},
    \"expected_output\": \"4\",
    \"num_trials\": 3,
    \"graders_config\": [{
      \"name\": \"Exact answer\",
      \"type\": 0,
      \"check_type\": \"exact\",
      \"expected_value\": \"4\",
      \"weight\": 5
    }]
  }"
```

---

## Mapping Grader Types from Other Systems

### Exact match / keyword check → Rule-based grader (type 0)

```yaml
graders_config:
  - type: 0
    check_type: "contains"      # or: exact, regex, json_path, not_empty, length_lte
    expected_value: "Paris"
    weight: 5
    case_sensitive: false
```

### LLM-as-judge → Model grader (type 1)

```yaml
graders_config:
  - type: 1
    passing_score: 0.7
    weight: 5
    rubric: |
      Evaluate the response on factual accuracy and completeness.
      Score 0.0–1.0. Return: {"score": float, "passed": bool, "reasoning": string}
```

### Custom scoring code → Code grader (type 2)

```yaml
graders_config:
  - type: 2
    weight: 5
    code: |
      def grade(output, expected):
          # output: actual agent response (string)
          # expected: expected_output from task definition
          score = 1.0 if expected.lower() in output.lower() else 0.0
          return {"score": score, "passed": score >= 0.5, "reasoning": ""}
```

---

## Tips for a Smooth Migration

- **Start small.** Import 5–10 representative tasks first, run them, check results make sense, then import the rest.
- **Use tags.** Add `tags: ["category-a", "difficulty-medium"]` to tasks so you can filter them in the Tasks tab.
- **Trials matter.** If your old system ran each test once, set `num_trials: 3` minimum to get reliable statistics.
- **Multiple graders per task.** Combine a rule-based check (fast, deterministic) with an LLM judge (for quality) to get the best of both worlds.
- **Custom Metrics.** After migrating, go to the **Custom Metrics** tab and add aggregate functions — for example, pass rate broken down by tag or difficulty — to replicate any aggregate reporting you had in your old system.
