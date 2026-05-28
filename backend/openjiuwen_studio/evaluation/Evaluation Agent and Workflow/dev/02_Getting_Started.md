# Onboarding Flow Specification — Evaluation System

**Component Name**: `FirstRunWizard`
**File Location**: `frontend/src/components/evaluation/FirstRunWizard.tsx`
**Trigger**: Shown when user visits Evaluation tab for the first time (or resets onboarding)
**Total Steps**: 5
**Estimated Completion Time**: 4–6 minutes

---

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1      Step 2      Step 3      Step 4      Step 5     │
│  Welcome   Create Suite  Add Task    Run It     Read Results │
│   ●────────────○────────────○────────────○────────────○     │
└─────────────────────────────────────────────────────────────┘
```

The wizard guides new users through creating a complete, working evaluation from scratch. By the end, they have:
- 1 evaluation suite
- 1 task with a grader
- 1 completed run
- An understanding of how to read results

---

## Global Wizard Rules

- **Progress**: Show step progress bar at top (e.g., "Step 2 of 5")
- **Skip**: Allow skipping from any step ("Skip Setup" → goes to empty state)
- **Back**: Allow going back to previous step without losing data
- **Persistence**: Save wizard state to `localStorage` so refresh doesn't reset progress
- **Completion**: Mark onboarding complete in user preferences (`user.onboarding.evaluation_complete = true`)
- **Re-trigger**: Add "Restart Onboarding" option in suite list empty state and help menu

---

## Step 1: Welcome

**Screen Title**: "Evaluate Your AI Agent"

### Layout

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   [Animated illustration: agent → test → results chart]   │
│                                                            │
│         Welcome to Evaluation                              │
│                                                            │
│   Find out if your agent actually works — consistently,   │
│   reliably, and exactly the way you designed it.          │
│                                                            │
│   In the next 5 minutes, you'll:                          │
│   ✓ Create your first test suite                          │
│   ✓ Add a test task with automatic grading                │
│   ✓ Run the evaluation and see your results               │
│                                                            │
│   ──────────────────────────────────────────────          │
│                                                            │
│   [Skip Setup]                    [Get Started →]         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Content Details

**Headline**: "Evaluate Your AI Agent"

**Subheading**: "Find out if your agent actually works — consistently, reliably, and exactly the way you designed it."

**Bullet points** (each with checkmark icon):
- Create your first test suite
- Add a test task with automatic grading
- Run the evaluation and see your results

**Illustration**: Animated loop showing:
1. Robot icon → sends query
2. Checkmark/X verdict appears
3. Chart shows results over time

### Interactions
- **[Get Started]**: Advance to Step 2
- **[Skip Setup]**: Show confirmation "Are you sure? You can always restart from the Help menu." → Yes: close wizard, No: stay on Step 1
- **[Watch 3-minute video]** (optional link): Opens video modal inline

---

## Step 2: Create Your First Suite

**Screen Title**: "Create a Test Suite"

### Layout

```
┌────────────────────────────────────────────────────────────┐
│  Step 2 of 5                                        [Skip] │
│  ●─────●──────○──────○──────○                              │
│                                                            │
│  Create a Test Suite                                       │
│  A suite is a collection of tests. Think of it as a       │
│  folder that groups related tests together.                │
│                                                            │
│  Suite Name *                                              │
│  ┌────────────────────────────────────────────────────┐   │
│  │  My First Evaluation                               │   │
│  └────────────────────────────────────────────────────┘   │
│  e.g. "Smoke Tests", "Customer Support Quality"            │
│                                                            │
│  Description (optional)                                    │
│  ┌────────────────────────────────────────────────────┐   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ╔════════════════════════════════════════════════════╗   │
│  ║  💡 Tip: Name suites after what you're testing,   ║   │
│  ║     not after your agent. You'll have multiple    ║   │
│  ║     suites for the same agent over time.          ║   │
│  ╚════════════════════════════════════════════════════╝   │
│                                                            │
│  [← Back]                       [Create Suite →]          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Field Specifications

**Suite Name**:
- Required field
- Placeholder: "My First Evaluation"
- Max length: 100 characters
- Auto-populated with "My First Evaluation" as default
- Validation: non-empty, no special characters except spaces, hyphens, underscores

**Description**:
- Optional
- Placeholder: "What does this suite test? (optional)"
- Max length: 500 characters
- Multi-line textarea, 3 rows

### Interactions
- **[Create Suite →]**: Validate name → call `POST /api/evaluation/suites` → on success, advance to Step 3
- **[← Back]**: Return to Step 1 (no API call, data preserved in form state)
- On API error: show inline error below the button: "Failed to create suite. Try again."

### API Call
```
POST /api/evaluation/suites
Body: { "name": "...", "description": "..." }
Response: { "id": "uuid", "name": "...", ... }
```

---

## Step 3: Add Your First Task

**Screen Title**: "Add a Test Task"

### Layout

```
┌────────────────────────────────────────────────────────────┐
│  Step 3 of 5                                        [Skip] │
│  ●─────●──────●──────○──────○                              │
│                                                            │
│  Add a Test Task                                           │
│  A task is one test case. Let's start with a template     │
│  to keep things simple.                                    │
│                                                            │
│  Choose a starting point:                                  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  ● Use a Template  (recommended for beginners)       │ │
│  │  ○ Start from Scratch                                │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Template:    [Simple Output Check        ▼]              │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  📋 Simple Output Check                             │ │
│  │  Tests that your agent's response contains          │ │
│  │  expected text. Great for factual Q&A.              │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Task Name *                                               │
│  ┌────────────────────────────────────────────────────┐   │
│  │  What does 2+2 equal?                              │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  What to ask your agent (Input) *                         │
│  ┌────────────────────────────────────────────────────┐   │
│  │  {"query": "What is 2 + 2?"}                       │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  Expected answer contains *                                │
│  ┌────────────────────────────────────────────────────┐   │
│  │  4                                                 │   │
│  └────────────────────────────────────────────────────┘   │
│  ⓘ Your agent's response must include this text           │
│                                                            │
│  Run this test   [3] times                                 │
│  ⓘ More runs = more reliable results                      │
│                                                            │
│  [← Back]                       [Save Task →]             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Mode: Use a Template

**Template Selector**: Dropdown with 5 beginner-friendly templates:
1. **Simple Output Check** — "Response contains expected text" (default)
2. **Yes/No Question** — "Response is exactly Yes or No"
3. **JSON Response** — "Response is valid JSON with required fields"
4. **Quality Assessment** — "AI judge rates response quality 0-10"
5. **Number in Range** — "Response is a number between X and Y"

When template is selected, auto-fill:
- Task Name (editable)
- Input Data (editable)
- Expected Output label (changes based on grader type)
- Grader config (hidden, pre-configured)

**Field labels adapt to template**:
- Contains: "Expected answer contains"
- Equals: "Expected exact answer"
- Quality: "What does a good answer look like?"
- Range: "Expected number range (min / max)"

### Mode: Start from Scratch

Show full task editor form with all fields visible. This is the standard TaskEditor component.

### Field Specifications

**Task Name**: Required, max 200 characters, pre-filled from template

**Input Data**:
- JSON editor with syntax highlighting
- Pre-filled from template
- Inline help: "This is sent to your agent as its input"
- JSON validation on blur

**Expected Answer**:
- Label varies by template
- Plain text input for Contains/Equals
- Separate min/max fields for Range
- Textarea for Quality rubric

**Trials (number of runs)**:
- Stepper input: − [3] +
- Range: 1–20
- Tooltip: "More runs give more reliable results. 3 is a good starting point."

### Interactions
- **[Save Task →]**: Validate all required fields → call `POST /api/evaluation/suites/{id}/tasks` → on success, advance to Step 4
- **[← Back]**: Return to Step 2 (suite is already created, task form state preserved)

### API Call
```
POST /api/evaluation/suites/{suite_id}/tasks
Body: {
  "task_name": "...",
  "input_data": {...},
  "expected_output": "...",
  "num_trials": 3,
  "graders_config": [...],  // pre-filled from template
  "difficulty": "easy"
}
```

---

## Step 4: Run the Evaluation

**Screen Title**: "Run Your Evaluation"

### Layout — Pre-Run State

```
┌────────────────────────────────────────────────────────────┐
│  Step 4 of 5                                        [Skip] │
│  ●─────●──────●──────●──────○                              │
│                                                            │
│  Run Your Evaluation                                       │
│                                                            │
│  Everything is set up. Here's what will happen:           │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  📋 Suite: My First Evaluation                      │ │
│  │  📝 Task: "What does 2+2 equal?"                    │ │
│  │  🔄 Trials: 3 runs                                  │ │
│  │  ⚡ Grader: Contains check ("4")                    │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Your agent will receive: {"query": "What is 2 + 2?"}     │
│  We'll check that the response contains "4"               │
│  This will run 3 times to check for consistency           │
│                                                            │
│  [← Back]                 [🚀 Run Evaluation]             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Layout — Running State

```
┌────────────────────────────────────────────────────────────┐
│  Step 4 of 5                                               │
│  ●─────●──────●──────●──────○                              │
│                                                            │
│  Running Your Evaluation...                                │
│                                                            │
│  ████████████████████░░░░░░░░  67%                        │
│                                                            │
│  ✅ Trial 1 — Passed (0.8s)                               │
│  ✅ Trial 2 — Passed (0.7s)                               │
│  ⏳ Trial 3 — Running...                                   │
│                                                            │
│  ╔════════════════════════════════════════════════════╗   │
│  ║  💡 While you wait: Each trial sends your input   ║   │
│  ║     to the agent and checks the response.         ║   │
│  ║     Multiple trials catch inconsistencies.        ║   │
│  ╚════════════════════════════════════════════════════╝   │
│                                                            │
│  This usually takes 10–30 seconds...                       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Layout — Complete State

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│               🎉                                          │
│         Evaluation Complete!                               │
│                                                            │
│   ✅  3/3 trials passed                                   │
│   ⚡  Avg latency: 0.75 seconds                           │
│   📊  Success rate: 100%                                  │
│                                                            │
│   Your agent correctly answered the question              │
│   every time.                                             │
│                                                            │
│   [← Run Again]           [View Full Results →]           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Interactions
- **[🚀 Run Evaluation]**: Call `POST /api/evaluation/suites/{id}/run` → transition to running state → poll for completion → show complete state
- **[View Full Results →]**: Advance to Step 5
- **[← Run Again]**: Reset to pre-run state and run again

### Polling
```javascript
// Poll every 2 seconds until status = 'completed' or 'failed'
GET /api/evaluation/runs/{run_id}/status
Response: { "status": "running", "progress": 0.67, "trials": [...] }
```

---

## Step 5: Understand Your Results

**Screen Title**: "Your Results"

### Layout

```
┌────────────────────────────────────────────────────────────┐
│  Step 5 of 5 — You're done! 🎉                             │
│  ●─────●──────●──────●──────●                              │
│                                                            │
│  Understanding Your Results                                │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │                                                    │   │
│  │  [Actual results panel embedded here]              │   │
│  │  (Real data from the run you just completed)       │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  Here's what each number means:                           │
│                                                            │
│  ✅ Success Rate: What % of tasks passed at least once    │
│  📊 Avg Score: Average quality score (0 = bad, 1 = best)  │
│  ⚡ Avg Latency: How long your agent took to respond      │
│  🔄 Trials: How many times each task was run              │
│                                                            │
│  Click any result to see the full trace — exactly what    │
│  your agent received, returned, and how it was graded.    │
│                                                            │
│  ──────────────────────────────────────────────────────   │
│                                                            │
│  What would you like to do next?                          │
│                                                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────┐  │
│  │ 📝 Add More     │  │ 🏃 Run a        │  │ 📖 Read  │  │
│  │    Tasks        │  │    Benchmark    │  │    Docs  │  │
│  └─────────────────┘  └─────────────────┘  └──────────┘  │
│                                                            │
│                              [Finish Setup ✓]             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Content

**Header**: "Understanding Your Results"

**Metric explanations** (each with an icon):
- ✅ **Success Rate**: "What % of tasks passed at least once"
- 📊 **Avg Score**: "Average quality score (0 = bad, 1 = best)"
- ⚡ **Avg Latency**: "How long your agent took to respond"
- 🔄 **Trials**: "How many times each task was run"

**Call to action block** — 3 cards:

1. **Add More Tasks**
   - Icon: 📝
   - Action: Close wizard → open "Add Task" dialog in the suite

2. **Run a Benchmark**
   - Icon: 🏃
   - Action: Close wizard → open benchmark gallery

3. **Read Docs**
   - Icon: 📖
   - Action: Open USER_GUIDE.md in a new tab

### Interactions
- **[Finish Setup ✓]**: Mark onboarding complete → close wizard → user is on the evaluation page with their completed run visible
- **[Add More Tasks]**: Same as Finish, but also opens "Add Task" dialog
- **[Run a Benchmark]**: Same as Finish, but also opens benchmark gallery
- **[Read Docs]**: Opens docs in new tab, wizard stays open

---

## State Management

```typescript
interface WizardState {
  currentStep: 1 | 2 | 3 | 4 | 5;
  completed: boolean;

  // Step 2
  suite: {
    id?: string;
    name: string;
    description: string;
  };

  // Step 3
  task: {
    id?: string;
    name: string;
    inputData: Record<string, unknown>;
    expectedOutput: string;
    numTrials: number;
    template: string;
    gradersConfig: GraderConfig[];
  };

  // Step 4
  run: {
    id?: string;
    status: 'idle' | 'running' | 'completed' | 'failed';
    progress: number;
    trials: TrialResult[];
  };
}
```

### Persistence
```typescript
// Save to localStorage on every state change
const WIZARD_KEY = 'evaluation_wizard_state';
localStorage.setItem(WIZARD_KEY, JSON.stringify(state));

// Load on component mount
const saved = localStorage.getItem(WIZARD_KEY);
if (saved) {
  const state = JSON.parse(saved);
  // Resume from where they left off
}

// Clear on completion
localStorage.removeItem(WIZARD_KEY);
```

---

## Error Handling

### Step 2 API Error
```
┌──────────────────────────────────────┐
│ ❌ Failed to create suite            │
│    Please check your connection      │
│    and try again.                    │
│    [Try Again]                       │
└──────────────────────────────────────┘
```

### Step 3 API Error
```
┌──────────────────────────────────────┐
│ ❌ Failed to save task               │
│    Error: [error message]            │
│    [Try Again]                       │
└──────────────────────────────────────┘
```

### Step 4 — Agent Unreachable
```
┌──────────────────────────────────────┐
│ ⚠️ Agent didn't respond              │
│    Make sure your agent is running   │
│    and try again.                    │
│    [← Back to Edit]  [Try Again]     │
└──────────────────────────────────────┘
```

### Step 4 — All Trials Failed
```
┌──────────────────────────────────────┐
│ ⚠️ All 3 trials failed               │
│    This is useful information!       │
│    Click "View Results" to see       │
│    what went wrong.                  │
│    [View Results →]                  │
└──────────────────────────────────────┘
```
Don't block progress — failed evaluations are valid results and useful data.

---

## Component Structure

```
FirstRunWizard/
├── FirstRunWizard.tsx          # Main wizard container, state management
├── WizardProgressBar.tsx       # Step indicator component
├── steps/
│   ├── Step1Welcome.tsx        # Welcome screen with illustration
│   ├── Step2CreateSuite.tsx    # Suite creation form
│   ├── Step3AddTask.tsx        # Task creation with template picker
│   ├── Step4RunEvaluation.tsx  # Run + progress + completion
│   └── Step5ViewResults.tsx    # Results with explanations
├── templates/
│   └── beginnerTemplates.ts    # 5 beginner task templates
└── hooks/
    ├── useWizardState.ts       # State management + localStorage
    └── useEvaluationRun.ts     # Polling for run completion
```

---

## Analytics Events

Track the following events for measuring wizard effectiveness:

```typescript
// Wizard started
analytics.track('evaluation_wizard_started');

// Step transitions
analytics.track('evaluation_wizard_step_completed', { step: 2 });

// Template selected
analytics.track('evaluation_wizard_template_selected', { template: 'simple_output_check' });

// Run completed
analytics.track('evaluation_wizard_run_completed', {
  passed: 3,
  failed: 0,
  latency_ms: 750
});

// Wizard completed
analytics.track('evaluation_wizard_completed');

// Wizard skipped
analytics.track('evaluation_wizard_skipped', { at_step: 3 });
```

---

## Accessibility

- All interactive elements keyboard-navigable
- Progress bar has `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Error messages use `role="alert"`
- Loading states announced via `aria-live="polite"`
- Wizard modal has `role="dialog"` and `aria-modal="true"`
- Focus trapped within wizard while open
- Escape key closes wizard (with confirmation if in progress)
