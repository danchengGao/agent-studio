# UI Component Specifications — Evaluation System

Technical specifications for frontend developers implementing the evaluation system UI improvements.

---

## Component 1: InfoTooltip

**File**: `frontend/src/components/evaluation/InfoTooltip.tsx`

**Purpose**: Contextual help tooltip for any evaluation term or UI element.

### Props Interface

```typescript
interface InfoTooltipProps {
  term: string;                    // Key into helpText constant (e.g., "pass_at_k")
  children?: React.ReactNode;      // Optional trigger element (defaults to ⓘ icon)
  placement?: 'top' | 'bottom' | 'left' | 'right';  // Default: 'top'
  size?: 'sm' | 'md' | 'lg';      // Tooltip width. Default: 'md'
  showLearnMore?: boolean;          // Show "Learn More" link. Default: true
}
```

### Behavior

- **Trigger**: Hover (desktop) or tap (mobile)
- **Delay**: 300ms before showing (prevents accidental triggers)
- **Dismiss**: Click outside or move mouse away
- **Content**: Loaded from `helpText[term]` constant
- **Animation**: Fade in 150ms
- **Z-index**: 1000 (above all content)

### Implementation

```typescript
// frontend/src/components/evaluation/InfoTooltip.tsx
import React, { useState, useRef } from 'react';
import { helpText } from '../../constants/helpText';

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  term,
  children,
  placement = 'top',
  size = 'md',
  showLearnMore = true,
}) => {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const content = helpText[term];
  if (!content) {
    console.warn(`InfoTooltip: No help text found for term: "${term}"`);
    return <>{children}</>;
  }

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => setVisible(true), 300);
  };

  const handleMouseLeave = () => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  const widths = { sm: '200px', md: '280px', lg: '360px' };

  return (
    <span className="info-tooltip-wrapper" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => setVisible(!visible)}
        aria-label={`Help: ${content.short}`}
        role="button"
        tabIndex={0}
        style={{ cursor: 'help', display: 'inline-flex', alignItems: 'center' }}
      >
        {children ?? <InfoIcon size={14} style={{ marginLeft: 4, color: '#8B8FA8', flexShrink: 0 }} />}
      </span>

      {visible && (
        <div
          className={`info-tooltip info-tooltip--${placement}`}
          style={{ width: widths[size] }}
          role="tooltip"
          aria-live="polite"
        >
          <div className="info-tooltip__short">{content.short}</div>
          {content.long && (
            <div className="info-tooltip__long">{content.long}</div>
          )}
          {content.example && (
            <div className="info-tooltip__example">
              <span className="info-tooltip__example-label">Example: </span>
              {content.example}
            </div>
          )}
          {showLearnMore && content.learnMoreUrl && (
            <a
              href={content.learnMoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="info-tooltip__learn-more"
            >
              Learn More →
            </a>
          )}
        </div>
      )}
    </span>
  );
};
```

### Usage Examples

```tsx
// Next to a metric label
<span>Success Rate <InfoTooltip term="success_rate" /></span>

// Wrapping a custom trigger
<InfoTooltip term="pass_at_k">
  <button className="help-button">What is pass@k?</button>
</InfoTooltip>

// In a form field label
<label>
  Number of Trials
  <InfoTooltip term="trials" size="lg" />
</label>
```

### Constants File

```typescript
// frontend/src/constants/helpText.ts
export interface HelpTextEntry {
  short: string;       // 1 sentence, shown in tooltip header
  long?: string;       // 2-3 sentences, shown in tooltip body
  example?: string;    // Concrete example
  learnMoreUrl?: string;
}

export const helpText: Record<string, HelpTextEntry> = {
  success_rate: {
    short: "Percentage of tasks that passed at least once across all trials.",
    long: "A task 'passes' if at least one of its trials meets all grader requirements. Success rate tells you how many of your tasks your agent can do at all.",
    example: "80% success rate = 8 out of 10 tasks succeeded at least once.",
    learnMoreUrl: "/docs/evaluation/metrics#success-rate"
  },
  pass_at_k: {
    short: "Probability that at least 1 of k runs succeeds.",
    long: "If you run the same task k times, what's the chance at least one succeeds? High pass@k with low pass^k means capable but inconsistent.",
    example: "pass@3 = 95% means: run it 3 times, very likely one will succeed.",
    learnMoreUrl: "/docs/evaluation/metrics#pass-at-k"
  },
  pass_pow_k: {
    short: "Probability that ALL k runs succeed.",
    long: "If you run the same task k times, does every single run succeed? This measures reliability — critical for production where you can't afford failures.",
    example: "pass^3 = 70% means: only 70% chance it works correctly every single time.",
    learnMoreUrl: "/docs/evaluation/metrics#pass-pow-k"
  },
  flakiness: {
    short: "How inconsistent the agent is. 0 = perfectly stable, 0.5 = random.",
    long: "Measured as the mean standard deviation of pass/fail across trials per task. High flakiness means users get different quality experiences unpredictably.",
    example: "Flakiness 0.45 = nearly coin-flip whether any given request succeeds.",
    learnMoreUrl: "/docs/evaluation/metrics#flakiness"
  },
  avg_score: {
    short: "Average quality score across all trials (0.0 = bad, 1.0 = perfect).",
    long: "When graders give partial credit, this averages all scores. A score of 0.73 means on average, responses are 73% of the way to ideal.",
    example: "avg_score 0.85 = responses are typically very good but not perfect.",
  },
  trials: {
    short: "How many times each task is run independently.",
    long: "More trials give more statistically reliable results but take longer. 3 trials is sufficient for simple checks; use 5-10 for important or variable tasks.",
    example: "3 trials = task runs 3 times with the same input to check consistency."
  },
  grader_weight: {
    short: "Importance of this grader relative to others.",
    long: "Final score = weighted average of all grader scores. A weight-10 grader has 10x the impact of a weight-1 grader. Use higher weights for more important checks.",
    example: "Weights [10, 5, 5] → first grader counts for 50% of the final score."
  },
  pattern_type: {
    short: "Expected structural pattern in the agent's execution.",
    long: "The evaluator inspects the execution trace to verify the agent uses the correct workflow architecture — not just that it returns the right answer.",
    example: "ROUTING verifies the agent actually makes conditional decisions, not just returns correct answers by luck."
  }
  // ... (100+ entries from HELP_TEXT_DICTIONARY.md)
};
```

---

## Component 2: TaskTemplateSelector

**File**: `frontend/src/components/evaluation/TaskTemplateSelector.tsx`

**Purpose**: Gallery of pre-built task templates with search and filtering.

### Props Interface

```typescript
interface TaskTemplateSelectorProps {
  onSelect: (template: TaskTemplate) => void;
  onClose: () => void;
  isOpen: boolean;
}

interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  difficulty: 'easy' | 'medium' | 'hard';
  use_case: string;
  default_config: {
    num_trials: number;
    difficulty: string;
    pattern_type?: string;
    graders_config: GraderConfig[];
  };
  example: {
    task_name: string;
    input_data: Record<string, unknown>;
    expected_output: string;
  };
}
```

### Layout

```
┌────────────────────────────────────────────────────────────────┐
│  Choose a Template                                    [×Close]  │
│                                                                 │
│  [🔍 Search templates...              ]  [All ▼] [Easy ▼]     │
│                                                                 │
│  ┌──────────────────┐ ┌──────────────────┐ ┌────────────────┐ │
│  │  ✅ Simple Check │ │  🏆 Quality Eval │ │  🔢 Number     │ │
│  │                  │ │                  │ │     Check      │ │
│  │ Tests exact text │ │ AI judge rates   │ │                │ │
│  │ or keyword match │ │ response quality │ │ Numeric range  │ │
│  │                  │ │                  │ │ validation     │ │
│  │ [● Easy]         │ │ [● Medium]       │ │ [● Easy]       │ │
│  │                  │ │                  │ │                │ │
│  │ [Use Template]   │ │ [Use Template]   │ │ [Use Template] │ │
│  └──────────────────┘ └──────────────────┘ └────────────────┘ │
│                                                                 │
│  ┌──────────────────┐ ┌──────────────────┐ ┌────────────────┐ │
│  │  📋 JSON Valid.  │ │  ⛓️ Multi-Step   │ │  🔀 Routing   │ │
│  │  ...             │ │  ...             │ │  ...           │ │
│  └──────────────────┘ └──────────────────┘ └────────────────┘ │
│                                                                 │
│  [Start from Scratch instead]                                   │
└────────────────────────────────────────────────────────────────┘
```

### Implementation Notes

```typescript
// Template data is loaded from TASK_TEMPLATES.yaml (converted to TS)
// import { taskTemplates } from '../../data/taskTemplates';

// On template selection:
// 1. Pre-fill the task editor form with template's default_config
// 2. Set graders_config from template
// 3. Show the task editor with pre-filled data
// 4. User can modify before saving

const handleTemplateSelect = (template: TaskTemplate) => {
  // Convert template to task form values
  const formValues: TaskFormValues = {
    task_name: template.example.task_name,
    input_data: JSON.stringify(template.example.input_data, null, 2),
    expected_output: template.example.expected_output,
    num_trials: template.default_config.num_trials,
    difficulty: template.default_config.difficulty,
    graders_config: template.default_config.graders_config,
    pattern_type: template.default_config.pattern_type,
  };

  props.onSelect(template);
  // Parent component handles switching to task editor with pre-filled values
};
```

---

## Component 3: GraderWizard

**File**: `frontend/src/components/evaluation/GraderWizard.tsx`

**Purpose**: Step-by-step guided grader configuration (replaces raw JSON editor for new users).

### Steps

```
Step 1: Choose Grader Type
  ○ Rule-Based Check    — "I know exactly what the answer should look like"
  ○ AI Quality Judge    — "I want an AI to rate the quality"
  ○ Custom Code         — "I'll write Python to evaluate it"

Step 2a (Rule-Based): Choose Check Type
  ○ Contains text       — "Output must include certain words/phrases"
  ○ Exactly equals      — "Output must be exactly this text"
  ○ Matches pattern     — "Output must match a regex pattern"
  ○ Number in range     — "Output must be a number between X and Y"
  ○ Valid JSON schema   — "Output must be valid JSON matching this schema"

Step 2b (AI Judge): Configure Rubric
  [Rubric text area with helpful template]
  Passing score threshold: [0.7]

Step 2c (Custom Code): Code Editor
  [Python function template pre-filled]

Step 3: Set Weight
  How important is this check?
  [slider: 1 ──●─────── 10]
  ⓘ Higher weight = more impact on final score

Step 4: Preview & Confirm
  [Shows rendered grader config as readable summary]
  [Test with sample input/output]
```

### Wizard State

```typescript
interface GraderWizardState {
  step: 1 | 2 | 3 | 4;
  graderType?: 0 | 1 | 2;
  checkType?: 'contains' | 'equals' | 'regex' | 'range' | 'json_schema';
  name: string;
  weight: number;
  // Type-specific fields
  expected_value?: string;
  pattern?: string;
  min?: number;
  max?: number;
  schema?: object;
  rubric?: string;
  passing_score?: number;
  code?: string;
}
```

---

## Component 4: ResultExplanationModal

**File**: `frontend/src/components/evaluation/ResultExplanationModal.tsx`

**Purpose**: Human-readable explanation of any result score or metric.

### Trigger

- Click the "?" button next to any metric value
- Click on a specific score in the results table

### Content Structure

```
┌─────────────────────────────────────────────────────┐
│  What does this score mean?               [×Close]  │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  pass@3 = 0.89                              │   │
│  │  ████████████████░░░  89%                   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  In plain English:                                  │
│  "If you run this task 3 times, there's an 89%     │
│   chance at least one run will succeed."            │
│                                                     │
│  ┌─── Is this good? ──────────────────────────┐   │
│  │  ✅ GOOD — 89% is above the 80% threshold  │   │
│  └────────────────────────────────────────────┘   │
│                                                     │
│  How it was calculated:                            │
│  • 12 total trials across 4 tasks                  │
│  • 10 trials succeeded, 2 failed                   │
│  • Failure rate per task: 16%                      │
│  • pass@3 = 1 − (0.16)³ ≈ 0.996 ≈ 89%            │
│                                                     │
│  What to do if this is low:                        │
│  • Check the 2 failed trials in Traces tab         │
│  • Look for patterns in what fails                 │
│  • Consider if flakiness is high                   │
│                                                     │
│  [View Traces]              [Learn More]           │
└─────────────────────────────────────────────────────┘
```

### API Endpoint Required

```
GET /api/evaluation/runs/{run_id}/explain/{metric_name}
Response: {
  "metric_name": "pass_at_k",
  "k": 3,
  "value": 0.89,
  "plain_english": "If you run this task 3 times, there's an 89% chance...",
  "verdict": "good",
  "verdict_reason": "89% is above the 80% recommended threshold",
  "calculation": { ... },
  "recommendations": [...]
}
```

---

## Component 5: BasicAdvancedToggle

**File**: `frontend/src/components/evaluation/BasicAdvancedToggle.tsx`

**Purpose**: Toggle between Basic mode (simplified UI) and Advanced mode (full feature set).

### Behavior

**Basic Mode hides**:
- `num_trials` (fixed at 3)
- `difficulty` field
- `tags` field
- `pattern_type` dropdown
- Custom metrics tab
- Raw JSON editors (shows form fields instead)
- Pattern validation results
- Individual grader weights (shows single weight slider)

**Advanced Mode shows everything**.

### Implementation

```typescript
// Global context
const EvaluationModeContext = createContext<{
  isAdvanced: boolean;
  setAdvanced: (v: boolean) => void;
}>({ isAdvanced: false, setAdvanced: () => {} });

// Toggle component
export const BasicAdvancedToggle = () => {
  const { isAdvanced, setAdvanced } = useContext(EvaluationModeContext);

  return (
    <div className="mode-toggle">
      <button
        className={`mode-toggle__btn ${!isAdvanced ? 'active' : ''}`}
        onClick={() => setAdvanced(false)}
      >
        Basic
      </button>
      <button
        className={`mode-toggle__btn ${isAdvanced ? 'active' : ''}`}
        onClick={() => setAdvanced(true)}
      >
        Advanced
      </button>
    </div>
  );
};

// Usage in any component:
const { isAdvanced } = useContext(EvaluationModeContext);

return (
  <>
    <TaskNameField />    {/* Always shown */}
    <InputDataField />   {/* Always shown */}
    {isAdvanced && <NumTrialsField />}   {/* Advanced only */}
    {isAdvanced && <DifficultyField />}  {/* Advanced only */}
  </>
);
```

### Persistence

Save mode preference to localStorage:
```typescript
const ADVANCED_MODE_KEY = 'evaluation_advanced_mode';
// Load on init: localStorage.getItem(ADVANCED_MODE_KEY) === 'true'
// Save on change: localStorage.setItem(ADVANCED_MODE_KEY, String(isAdvanced))
```

---

## Component 6: EmptyStateGuide

**File**: `frontend/src/components/evaluation/EmptyStateGuide.tsx`

**Purpose**: Friendly, action-oriented empty state when user has no suites.

### Design

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                [Animated illustration]                       │
│          (robot sending messages → results chart)            │
│                                                              │
│            Test Your AI Agent in Minutes                     │
│                                                              │
│   Find out if your agent works consistently and correctly.  │
│   No PhD required.                                           │
│                                                              │
│   ────────────────────────────────────────────────────      │
│                                                              │
│   Start with:                                                │
│                                                              │
│   ┌─────────────────────────┐  ┌───────────────────────┐   │
│   │  🚀 Guided Setup        │  │  ⚡ Load a Benchmark  │   │
│   │  Step-by-step wizard    │  │  7 ready-to-run       │   │
│   │  4–6 minutes            │  │  test suites          │   │
│   │  [Start Wizard]         │  │  [Browse Benchmarks]  │   │
│   └─────────────────────────┘  └───────────────────────┘   │
│                                                              │
│   or [Create Empty Suite] to start from scratch             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Props

```typescript
interface EmptyStateGuideProps {
  onStartWizard: () => void;
  onLoadBenchmark: () => void;
  onCreateEmpty: () => void;
}
```

---

## Styling Conventions

### CSS Classes

```css
/* All evaluation components use the `eval-` prefix */
.eval-tooltip { ... }
.eval-tooltip--visible { ... }
.eval-template-card { ... }
.eval-template-card--selected { ... }
.eval-mode-toggle { ... }
.eval-grader-wizard { ... }
.eval-empty-state { ... }

/* Status colors */
.eval-status--pass { color: #00B67A; }    /* Green */
.eval-status--fail { color: #FF4545; }    /* Red */
.eval-status--warn { color: #FF8A00; }    /* Orange */
.eval-status--neutral { color: #8B8FA8; } /* Gray */
```

### Design Tokens

```typescript
// Use these consistently across all evaluation UI
const EVAL_COLORS = {
  pass: '#00B67A',
  fail: '#FF4545',
  warn: '#FF8A00',
  info: '#3B82F6',
  neutral: '#8B8FA8',
  background: '#F7F8FA',
  border: '#E5E7EB',
} as const;
```

---

## State Management Integration

All evaluation components read from and write to `useEvaluationStore` (Zustand):

```typescript
// frontend/src/stores/useEvaluationStore.ts
interface EvaluationState {
  // Suites
  suites: EvaluationSuite[];
  selectedSuiteId: string | null;

  // Tasks
  tasks: EvaluationTask[];

  // Runs
  currentRun: EvaluationRun | null;
  runHistory: EvaluationRun[];

  // UI State
  isAdvancedMode: boolean;
  wizardState: WizardState | null;
  selectedTrialId: string | null;

  // Actions
  setSuites: (suites: EvaluationSuite[]) => void;
  selectSuite: (id: string) => void;
  setAdvancedMode: (v: boolean) => void;
  setWizardState: (state: WizardState | null) => void;
  // ...
}
```

---

## Testing Requirements

### Unit Tests (Required for each component)

```typescript
// InfoTooltip.test.tsx
describe('InfoTooltip', () => {
  it('shows tooltip content on hover after delay', async () => { ... });
  it('hides tooltip on mouse leave', async () => { ... });
  it('logs warning for unknown term', () => { ... });
  it('renders custom children as trigger', () => { ... });
  it('is keyboard accessible', async () => { ... });
});

// TaskTemplateSelector.test.tsx
describe('TaskTemplateSelector', () => {
  it('renders all templates', () => { ... });
  it('filters by search query', () => { ... });
  it('filters by difficulty', () => { ... });
  it('calls onSelect with template data', () => { ... });
});
```

### Accessibility Tests (Required)

```typescript
import { axe } from 'jest-axe';

it('has no accessibility violations', async () => {
  const { container } = render(<InfoTooltip term="success_rate" />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```
