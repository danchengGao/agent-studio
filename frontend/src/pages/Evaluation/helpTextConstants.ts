/**
 * Centralised tooltip / help-text strings for the Evaluation UI.
 * Import individual keys where needed, or spread the whole object.
 */

export const HELP_TEXT = {
  // ── Suite-level ─────────────────────────────────────────────────────────────

  SUITE_NAME:
    'A descriptive name for this group of related test tasks. ' +
    'Example: "Customer Support — Q3 2024".',

  SUITE_DESCRIPTION:
    'Optional context about what this suite tests and why. ' +
    'Shown in the suite list and in exported reports.',

  // ── Task-level ───────────────────────────────────────────────────────────────

  TASK_NAME:
    'Short label for this test case. Be specific — "Handles out-of-stock item" ' +
    'is better than "Test 1".',

  TASK_DESCRIPTION:
    'What this task is testing and why it matters. ' +
    'Shown in reports and helps team members understand intent.',

  TRIALS:
    'How many independent times to run this task. ' +
    'More trials → more reliable statistics.\n\n' +
    '• 1 trial: fast feedback, no reliability data\n' +
    '• 3 trials: balanced (recommended for development)\n' +
    '• 5+ trials: statistically meaningful pass@k and flakiness scores\n\n' +
    'Rule of thumb: use at least 3 for any task you care about.',

  PATTERN_TYPE:
    'Validates that the agent\'s execution trace matches a structural pattern — ' +
    'not just that the output is correct, but that it used the right architecture.\n\n' +
    '• Routing — agent chose the right branch\n' +
    '• Chaining — steps executed in sequence\n' +
    '• Parallelization — multiple branches ran simultaneously\n' +
    '• Orchestrator-Worker — main agent delegated to sub-agents\n' +
    '• Evaluator-Optimizer — agent refined its own output\n' +
    '• Memory Usage — agent read/wrote persistent memory\n\n' +
    'Leave blank to skip pattern validation and check only the final output.',

  INPUT_DATA:
    'JSON object sent to the agent as its test input. ' +
    'The agent receives this as the input to its workflow or chat.\n\n' +
    'Example: { "query": "What is your return policy?" }\n\n' +
    'Keys depend on your agent\'s input schema.',

  EXPECTED_OUTPUT:
    'JSON object describing the correct answer. ' +
    'Graders compare the agent\'s actual output against this.\n\n' +
    'You can leave this as {} if your graders don\'t need a reference answer ' +
    '(e.g., a code-based grader that checks the output independently).',

  GRADERS_CONFIG:
    'Array of grader objects that check the agent\'s output.\n\n' +
    'Each grader has:\n' +
    '  • type — 0 = Deterministic, 1 = Model-based, 2 = Code\n' +
    '  • weight — importance relative to other graders (default 1)\n' +
    '  • check_type — for deterministic: contains / equals / regex / range / json_schema\n' +
    '  • rubric — for model-based: free-text instructions for the LLM judge\n' +
    '  • code — for code-based: Python def grade(output, expected, context)\n\n' +
    'Final score = Σ(score × weight) / Σ(weight).\n\n' +
    'Tip: use the Grader Presets in the docs to copy ready-made configurations.',

  TAGS:
    'Comma-separated labels for this task. ' +
    'Used in custom metrics to filter tasks by category.\n\n' +
    'Example: "critical, safety, edge-case"',

  // ── Grader-level ─────────────────────────────────────────────────────────────

  GRADER_TYPE_DETERMINISTIC:
    'Rule-based check — always gives the same result for the same input. ' +
    'Use for objective requirements: exact answers, required keywords, JSON format, numeric ranges.',

  GRADER_TYPE_MODEL:
    'LLM judge — uses an AI model to evaluate quality. ' +
    'Use for subjective requirements: tone, helpfulness, empathy, reasoning quality. ' +
    'Write a rubric that tells the judge what to look for.',

  GRADER_TYPE_CODE:
    'Python function — write a def grade(output, expected, context) function. ' +
    'Return { "passed": bool, "score": float 0-1, "reason": str }. ' +
    'Use for custom business logic that rule-based checks can\'t express.',

  GRADER_WEIGHT:
    'Relative importance of this grader in the overall score. ' +
    'Higher weight = bigger impact on the final score.\n\n' +
    'Example: if grader A has weight 3 and grader B has weight 1, ' +
    'grader A counts 3× more. Both passing → score 1.0. Only A passing → score 0.75.',

  GRADER_PASSING_SCORE:
    'Minimum score (0.0–1.0) for the model-based grader to count as "passed". ' +
    'Default: 0.7. Raise to 0.9+ for strict quality gates.',

  GRADER_PATTERN:
    'Regex pattern or string to match against the output.\n\n' +
    'For check_type "contains": plain substring match.\n' +
    'For check_type "regex": Python-compatible regular expression.\n' +
    'For check_type "equals": exact string comparison.',

  GRADER_RUBRIC:
    'Instructions for the LLM judge. Describe:\n' +
    '  1. What a good response looks like\n' +
    '  2. What to penalise\n' +
    '  3. How to assign the 0.0–1.0 score\n\n' +
    'End with: Return: {"score": float, "passed": bool, "reasoning": string}',

  // ── Metrics ──────────────────────────────────────────────────────────────────

  METRIC_SUCCESS_RATE:
    '% of tasks that passed in at least one trial.\n\n' +
    'A task "passes" when its weighted grader score meets the passing threshold. ' +
    'Target: > 80% for most production agents.',

  METRIC_PASS_AT_K:
    'Probability that at least one out of k independent trials succeeds.\n\n' +
    'Formula: 1 − (fail_rate)^k\n\n' +
    'Answers: "Can the agent do this at all?" ' +
    'High pass@k + low pass^k = agent can do it but inconsistently.',

  METRIC_PASS_ALL_K:
    'Probability that ALL k trials succeed (reliability).\n\n' +
    'Formula: (success_rate)^k\n\n' +
    'Answers: "Does the agent always get this right?" ' +
    'Low pass^k = agent is unreliable even if it sometimes succeeds.',

  METRIC_FLAKINESS:
    'How inconsistent the agent is across trials for the same task.\n\n' +
    '0.0 = perfectly stable (always passes or always fails)\n' +
    '0.5 = random (50/50 every run)\n\n' +
    'High flakiness (> 0.3) usually means temperature too high, ' +
    'ambiguous prompt, or unstable tool calls.',

  METRIC_AVG_SCORE:
    'Average weighted grader score across all tasks and trials.\n\n' +
    'Calculated as: Σ(score × weight) / Σ(weight) per trial, then averaged.',

  METRIC_AVG_LATENCY:
    'Average time in milliseconds to complete one trial.\n\n' +
    'Includes agent processing + any tool calls. ' +
    'High latency may indicate inefficient tool use or slow external APIs.',

  METRIC_TOKEN_EFFICIENCY:
    'Average quality score per 1000 tokens used.\n\n' +
    'Higher is better — shows the agent achieves good results without ' +
    'excessive token usage.',

  // ── Custom metrics ───────────────────────────────────────────────────────────

  CUSTOM_METRIC_NAME:
    'Short name shown in the metrics dashboard. Example: "Safety Pass Rate".',

  CUSTOM_METRIC_DESCRIPTION:
    'Optional description of what this metric measures and why it matters.',

  CUSTOM_METRIC_CODE:
    'Python function: def compute(results)\n\n' +
    'results is a list of dicts, one per task result, with keys:\n' +
    '  • task_id (str)\n' +
    '  • passed (0 or 1)\n' +
    '  • score (float 0–1)\n' +
    '  • latency_ms (int)\n' +
    '  • token_usage (int)\n' +
    '  • error_message (str or None)\n' +
    '  • grader_results (list)\n' +
    '  • tags (list of str)\n\n' +
    'Return a single float. Example: return sum(r["passed"] for r in results) / len(results)',

  // ── Run ──────────────────────────────────────────────────────────────────────

  RUN_WORKFLOW_OR_AGENT:
    'Select the workflow or agent to evaluate. ' +
    'The evaluation runner will call this target once per trial per task.',

  RUN_STATUS_PENDING:   'Run is queued and will start shortly.',
  RUN_STATUS_RUNNING:   'Run is in progress. Results update automatically.',
  RUN_STATUS_COMPLETED: 'All trials finished. View results in the Results tab.',
  RUN_STATUS_FAILED:    'Run encountered an error. Check the agent logs and retry.',

  // ── Pattern validation ────────────────────────────────────────────────────────

  PATTERN_ROUTING:
    'Agent examines the input and routes to one of several specialised sub-paths. ' +
    'Validation checks that a branching decision was made in the trace.',

  PATTERN_CHAINING:
    'Output of one step feeds into the next step as input. ' +
    'Validation checks that steps ran in the expected sequence.',

  PATTERN_PARALLELIZATION:
    'Multiple independent branches run simultaneously. ' +
    'Validation checks that at least two branches executed in parallel.',

  PATTERN_ORCHESTRATOR:
    'A coordinator agent delegates tasks to worker agents. ' +
    'Validation checks that delegation occurred in the trace.',

  PATTERN_EVALUATOR:
    'Agent generates output, evaluates it, and refines if needed. ' +
    'Validation checks that the evaluate-and-refine loop ran.',

  PATTERN_MEMORY:
    'Agent reads from or writes to persistent memory. ' +
    'Validation checks that memory operations occurred in the trace.',

  // ── Benchmarks ───────────────────────────────────────────────────────────────

  BENCHMARK:
    'A pre-built evaluation suite testing a standard workflow pattern. ' +
    'Import a benchmark to get started quickly — then customise the tasks ' +
    'to match your agent\'s actual inputs and outputs.',
} as const

export type HelpTextKey = keyof typeof HELP_TEXT
