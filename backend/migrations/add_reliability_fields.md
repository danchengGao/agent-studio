# Migration: Add Reliability Fields to EvaluationTaskResultDB

## Overview
This migration adds new fields to the `evaluation_task_result` table to support reliability evaluation metrics.

## New Fields Added

### 1. perturbation_type (String, nullable, default="nominal")
- Values: "nominal", "prompt_perturbed", "env_perturbed", "fault_injected"
- Tracks which perturbation type was applied to this trial

### 2. confidence (Float, nullable)
- Range: 0.0-1.0
- Agent's confidence score in its output

### 3. action_sequence (JSON, nullable)
- List of action identifiers (e.g., ["tool:search", "component:processor"])
- Used for trajectory consistency metrics

### 4. safety_violations (JSON, nullable)
- List of violated constraint names
- Empty list or null if no violations

### 5. safety_severity (Float, nullable)
- Max severity weight among violations
- Values: 0.25 (low), 0.5 (medium), 1.0 (high)

## Unique Constraint Change

The existing `unique_run_task_trial` constraint on `(run_id, task_id, trial_number)` has been
renamed and expanded to `unique_run_task_trial_pert` on `(run_id, task_id, trial_number, perturbation_type)`.
This allows storing the same trial number for different perturbation types.

Also a new index `idx_result_perturbation` is added on `perturbation_type`.

## SQL Migration (for PostgreSQL/MySQL)

```sql
ALTER TABLE evaluation_task_result
ADD COLUMN perturbation_type VARCHAR(50) DEFAULT 'nominal',
ADD COLUMN confidence FLOAT,
ADD COLUMN action_sequence JSON,
ADD COLUMN safety_violations JSON,
ADD COLUMN safety_severity FLOAT;

CREATE INDEX idx_result_perturbation ON evaluation_task_result (perturbation_type);

-- Drop old unique constraint and create new one including perturbation_type
ALTER TABLE evaluation_task_result DROP CONSTRAINT unique_run_task_trial;
ALTER TABLE evaluation_task_result ADD CONSTRAINT unique_run_task_trial_pert
    UNIQUE (run_id, task_id, trial_number, perturbation_type);
```

## SQL Migration (for SQLite)

SQLite does not support adding multiple columns with a single ALTER TABLE statement.
Use the following:

```sql
ALTER TABLE evaluation_task_result ADD COLUMN perturbation_type VARCHAR(50) DEFAULT 'nominal';
ALTER TABLE evaluation_task_result ADD COLUMN confidence FLOAT;
ALTER TABLE evaluation_task_result ADD COLUMN action_sequence JSON;
ALTER TABLE evaluation_task_result ADD COLUMN safety_violations JSON;
ALTER TABLE evaluation_task_result ADD COLUMN safety_severity FLOAT;
```

## Alembic Migration

If using Alembic for migrations, generate the migration with:

```bash
alembic revision --autogenerate -m "add reliability fields to evaluation task result"
```

Then edit the generated migration file to include the above columns.

## Backwards Compatibility

All new fields are nullable, so existing records will have NULL values for these fields.
The application handles NULL values gracefully:
- perturbation_type defaults to "nominal" if NULL
- confidence, action_sequence, safety_violations, safety_severity default to None if NULL

## Testing

After applying the migration:
1. Run an evaluation with perturbations enabled
2. Verify new fields are populated in the database
3. Check that reliability metrics are computed correctly
4. Verify the Reliability tab displays in the frontend
