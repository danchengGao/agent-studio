# System Investigation — Scheduled Triggers

**Related document:** RAT.md — product requirements and business background.
This document covers architecture, module layout, sequence diagrams, technical
constraints, and system impact for the same feature.

---

## Feature Scope

The Scheduled Triggers feature adds three ways to fire an agent or workflow
automatically, without a human pressing a button in the UI:

1. **Cron** — fires at a UTC cron schedule via APScheduler.
2. **Webhook** — fires when an external system POSTs to a unique inbound URL.
3. **Polling** — fires on a fixed interval when a monitored URL's content changes.

All three paths converge on `execute_trigger_job()` — a single async function that
looks up the trigger, handles type-specific logic (polling hash check), calls the
existing agent or workflow runner, and writes an execution log.

---

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │  External systems                    │
                    │  Cron clock · GitHub · Zapier · RSS  │
                    └──────┬───────────────────┬───────────┘
                           │  scheduled fire   │  HTTP POST
                           │                   │
              ┌────────────▼──┐   ┌────────────▼──────────────────┐
              │  APScheduler  │   │  FastAPI                       │
              │  (in-process) │   │  GET/POST /inbound/{token}     │
              │  CronTrigger  │   │  triggers_inbound_router       │
              │  IntervalTrigger   └──────────────┬────────────────┘
              └────────┬──────┘                  │ BackgroundTasks
                       │                         │
                       └──────────┬──────────────┘
                                  │ execute_trigger_job(trigger_id, fired_by)
                                  ▼
              ┌──────────────────────────────────────────────┐
              │  core/scheduler/runner.py                    │
              │  execute_trigger_job()                       │
              │  • load TriggerDB from DB                    │
              │  • polling: fetch URL, hash, skip if same    │
              │  • cron/webhook: fire immediately            │
              │  • _fire_execution()                         │
              │    - make_system_user(space_id)              │
              │    - write "running" log                     │
              │    - call agent_mgr.run() / flow_mgr.run()   │
              │    - consume async generator                 │
              │    - write final log (success/error)         │
              └──────────────────┬───────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │  Existing execution layer  │
                    │  agent_mgr.run()           │
                    │  flow_mgr.run()            │
                    └───────────────────────────┘
```

### Design principles

**Single execution entry point.**
`execute_trigger_job()` is the only place that runs a trigger. APScheduler, the
inbound webhook receiver, and the manual run endpoint all call the same function.
Type-specific routing (polling hash check vs. immediate fire) is isolated inside it.

**DB is authoritative.**
On every startup, `sync_triggers_to_scheduler()` removes all APScheduler jobs and
rebuilds them from the database. APScheduler's own job store is treated as a cache,
not the source of truth. This guarantees consistency after manual DB edits, deployments,
or restarts while the server was down.

**No changes to the execution layer.**
The trigger runner calls `agent_mgr.run()` and `flow_mgr.run()` with the same
interface used by the interactive UI. The execution layer does not know it is being
called by a trigger.

**Polling is change-driven.**
The polling handler hashes the fetched content (SHA-256, capped at 10 MB) and compares
it to the last-seen hash stored in `trigger.config`. It fires the agent/workflow only
when content changes. Unchanged polls write a `skipped` log entry and do nothing else.

---

## Module Layout

```
core/scheduler/
├── scheduler.py        ← init_scheduler() — creates AsyncIOScheduler with
│                         SQLAlchemy job store; coalesce=True, max_instances=1
├── sync.py             ← sync_triggers_to_scheduler() — called at startup;
│                         removes all jobs, re-adds from DB
├── jobs.py             ← register_trigger_job() — wraps CronTrigger /
│                         IntervalTrigger; logs next_run_utc; calls execute_trigger_job
│                       ← remove_trigger_job() — safe no-op if job absent
├── runner.py           ← execute_trigger_job() — main entry point
│                       ← _handle_polling() — fetch, hash, compare, fire or skip
│                       ← _fire_execution() — system_user, log, run(), final log
│                       ← _get_runner() — routes to agent_mgr or flow_mgr
│                       ← _write_log() — creates TriggerExecutionLogDB row
│                       ← _extract_outputs() — best-effort dict from stream chunk
├── system_user.py      ← make_system_user(space_id) — synthetic current_user dict
│                         with user_id_str="system_trigger", role_type="super_user"
└── webhook_utils.py    ← verify_webhook_signature() — HMAC-SHA256 with
                          timing-safe compare_digest

models/trigger.py
├── TriggerDB           ← one row per trigger definition (table: trigger)
└── TriggerExecutionLogDB ← one row per fire attempt (table: trigger_execution_log)

routers/triggers.py
├── triggers_router     ← JWT-protected CRUD + activate/deactivate/run + logs
└── triggers_inbound_router ← public GET/POST /inbound/{webhook_token}
```

---

## Key Sequence Diagrams

### 1. Startup — scheduler sync

Called once during FastAPI lifespan startup, before `scheduler.start()`.

```
main.py lifespan        sync.py                  DB               APScheduler
       │                    │                     │                     │
       │ sync_triggers_to_scheduler()             │                     │
       │───────────────────►│                     │                     │
       │                    │ remove_all_jobs()   │                     │
       │                    │────────────────────────────────────────►  │
       │                    │ SELECT trigger WHERE is_active=True       │
       │                    │  AND trigger_type IN ('cron','polling')   │
       │                    │────────────────────►│                     │
       │                    │◄── [trigger rows] ──│                     │
       │                    │                     │                     │
       │                    │ for each trigger:   │                     │
       │                    │  register_trigger_job(scheduler, trigger) │
       │                    │────────────────────────────────────────►  │
       │                    │  add_job(execute_trigger_job, CronTrigger/IntervalTrigger)
       │                    │◄── job registered ─────────────────────── │
       │                    │  log: next_run_utc=...                    │
       │                    │                     │                     │
       │ scheduler.start()  │                     │                     │
       │────────────────────────────────────────────────────────────►   │
```

---

### 2. Cron trigger fire

```
APScheduler         runner.py                     DB            agent_mgr / flow_mgr
     │                   │                         │                      │
     │ execute_trigger_job(trigger_id, "scheduler")│                      │
     │──────────────────►│                         │                      │
     │                   │ SELECT TriggerDB        │                      │
     │                   │────────────────────────►│                      │
     │                   │◄── trigger row ─────────│                      │
     │                   │ trigger.is_active? yes   │                      │
     │                   │                         │                      │
     │                   │ make_system_user(space_id)                     │
     │                   │ _write_log(status="running")                   │
     │                   │────────────────────────►│                      │
     │                   │                         │                      │
     │                   │ _get_runner(trigger, inputs, ...) → gen        │
     │                   │ async for chunk in gen:─────────────────────►  │
     │                   │   (consumes full async generator)              │
     │                   │◄── last_chunk ──────────────────────────────── │
     │                   │                         │                      │
     │                   │ log.status = "success"  │                      │
     │                   │ log.outputs = ...       │                      │
     │                   │ log.duration_ms = ...   │                      │
     │                   │ db.commit()             │                      │
     │                   │────────────────────────►│                      │
```

---

### 3. Webhook trigger — inbound POST

```
External system      FastAPI router          DB             runner.py
       │                    │                 │                  │
       │ POST /inbound/{tok}│                 │                  │
       │───────────────────►│                 │                  │
       │                    │ SELECT TriggerDB WHERE             │
       │                    │  webhook_token=tok, is_active=True │
       │                    │────────────────►│                  │
       │                    │◄── trigger ─────│                  │
       │                    │                 │                  │
       │                    │ [if webhook_secret set]            │
       │                    │ verify_webhook_signature(body, header, secret)
       │                    │   → HMAC-SHA256 with compare_digest│
       │                    │   → 403 if invalid                 │
       │                    │                 │                  │
       │◄── 200 {"status":"accepted"} ────────│                  │
       │                    │                 │                  │
       │                    │ BackgroundTasks.add_task(          │
       │                    │   execute_trigger_job, trigger_id, │
       │                    │   "webhook")    │                  │
       │                    │──────────────────────────────────► │
       │                    │                 │  (same flow as cron from here)
```

Notes:
- The HTTP response is returned immediately (200) before execution starts.
- Unknown tokens also return 200 to prevent token enumeration.
- `GET /inbound/{token}` is also supported (some webhook platforms send a GET first).

---

### 4. Polling trigger — content unchanged

```
APScheduler         runner.py                     DB            External URL
     │                   │                         │                   │
     │ execute_trigger_job(trigger_id, "scheduler")│                   │
     │──────────────────►│                         │                   │
     │                   │ _handle_polling()        │                   │
     │                   │ asyncio.to_thread(requests.get, poll_url)   │
     │                   │────────────────────────────────────────────►│
     │                   │◄── response body ────────────────────────── │
     │                   │ sha256(body[:10MB]) → current_hash          │
     │                   │                         │                   │
     │                   │ last_seen_hash = config.get("last_seen_hash")
     │                   │ current_hash == last_seen_hash → unchanged  │
     │                   │                         │                   │
     │                   │ UPDATE trigger.config["last_checked_at"]    │
     │                   │────────────────────────►│                   │
     │                   │ _write_log(status="skipped")                │
     │                   │────────────────────────►│                   │
     │                   │ return (no execution)    │                   │
```

---

### 5. Polling trigger — content changed

```
     │                   │                         │                   │
     │                   │ current_hash ≠ last_seen_hash               │
     │                   │ (or first ever check: last_seen_hash=None)  │
     │                   │                         │                   │
     │                   │ UPDATE trigger.config["last_seen_hash"] = current_hash
     │                   │────────────────────────►│                   │
     │                   │                         │                   │
     │                   │ _fire_execution(fired_by="poll",            │
     │                   │   extra_inputs={"_poll_hash": current_hash})│
     │                   │   (same path as cron from here)             │
```

---

## Component Breakdown

### `core/scheduler/scheduler.py`

| Aspect | Detail |
|---|---|
| Scheduler type | `AsyncIOScheduler` — runs in the same event loop as FastAPI |
| Job store | `SQLAlchemyJobStore` pointing at the existing application DB (`apscheduler_jobs` table auto-created) |
| `coalesce` | `True` — if N fires were missed while the server was down, fire only once on restart |
| `max_instances` | `1` — never run two instances of the same trigger concurrently |
| `misfire_grace_time` | `86 400 s` (24 hours) — missed fires within this window are still run on next server start |
| SQLite note | `check_same_thread=False` is set for SQLite to allow APScheduler's internal thread pool to access the job store safely |

---

### `core/scheduler/jobs.py`

| Function | Description |
|---|---|
| `register_trigger_job(scheduler, trigger)` | Adds or replaces an APScheduler job. Cron → `CronTrigger.from_crontab(expr, timezone="UTC")`. Polling → `IntervalTrigger(seconds=N, timezone="UTC")`. Logs `next_run_utc`. Returns job ID stored in `TriggerDB.scheduler_job_id`. |
| `remove_trigger_job(scheduler, trigger)` | Removes the job. Safe to call even if the job does not exist (exception silently ignored). |

---

### `core/scheduler/runner.py`

| Function | Description |
|---|---|
| `execute_trigger_job(trigger_id, fired_by)` | Entry point for all callers. Loads TriggerDB, checks `is_active`, routes to `_handle_polling` or `_fire_execution`. All exceptions caught here — scheduler never sees an unhandled error. |
| `_handle_polling(db, trigger, fired_by)` | Fetches `poll_url` in a thread (15 s timeout). Hashes body (10 MB cap). Compares to `last_seen_hash`. Updates `config` in DB. Calls `_fire_execution` on change; writes `skipped` log on no-change; writes `error` log on fetch failure. |
| `_fire_execution(db, trigger, fired_by, extra_inputs, poll_hash_seen)` | Creates system user. Writes `running` log. Consumes async generator from `_get_runner()` fully. Writes final `success`/`error` log with duration and outputs. |
| `_get_runner(trigger, inputs, conversation_id, current_user)` | Returns `agent_mgr.run()` or `flow_mgr.run()` async generator based on `target_type`. |
| `_write_log(...)` | Creates and commits a `TriggerExecutionLogDB` row. Returns the row (so `_fire_execution` can update it in-place). |
| `_extract_outputs(chunk)` | Best-effort serialization of the last stream chunk to a dict. Falls back to `{"raw": str(chunk)}`. |

---

### `core/scheduler/system_user.py`

The execution layer (`agent_mgr.run()`, `flow_mgr.run()`) expects a `current_user`
dict that normally comes from a JWT-authenticated request. Trigger-fired executions
have no HTTP request and no user token.

`make_system_user(space_id)` returns a synthetic dict with:
- `user_id_str = "system_trigger"`
- `role_type = "super_user"` — allows the manager to bypass `check_user_space()`
- `space_id` set per-trigger
- `session_key = "__trigger_system__"` — distinguishable in logs

The manager's `_internal_run()` path checks `user_id_str == "system_trigger"` and
skips the space ownership check.

---

### `core/scheduler/webhook_utils.py`

`verify_webhook_signature(payload, signature_header, secret)` — GitHub-style
HMAC-SHA256 validation. Expects `X-Hub-Signature-256: sha256=<hex>` header.
Uses `hmac.compare_digest` for timing-safe comparison.

If no secret is configured on the trigger, the check is skipped and all POSTs are
accepted.

---

### `models/trigger.py`

**`TriggerDB`** — table: `trigger`

| Column | Type | Notes |
|---|---|---|
| `trigger_id` | `String(100)` unique | UUID, used in all foreign references |
| `space_id` | `String(100)` | Tenant identifier |
| `trigger_type` | `String(32)` | `"cron"` / `"webhook"` / `"polling"` |
| `target_type` | `String(32)` | `"agent"` / `"workflow"` |
| `target_id` | `String(100)` | Agent ID or Workflow ID |
| `target_version` | `String(100)` | `"draft"` or published version string |
| `input_payload` | `JSON` | Fixed key/value inputs forwarded on every fire |
| `is_active` | `Boolean` | False by default — must be explicitly activated |
| `config` | `JSON` | Type-specific blob (see below) |
| `webhook_token` | `String(128)` unique | URL token for webhook triggers; NULL for others |
| `scheduler_job_id` | `String(255)` | APScheduler job ID; used by CRUD to remove jobs |

Config blobs by type:
```
Cron:    {"cron_expr": "0 9 * * 1"}
Webhook: {"webhook_secret": "<hex-or-null>"}
Polling: {"poll_url": "https://...",
          "poll_interval_seconds": 300,
          "last_seen_hash": "<sha256-hex>",
          "last_checked_at": 1700000000000}
```

**`TriggerExecutionLogDB`** — table: `trigger_execution_log`

| Column | Type | Notes |
|---|---|---|
| `trigger_id` | `String(100)` | References `TriggerDB.trigger_id` |
| `trace_id` | `String(100)` | Cross-reference to agent/workflow execution trace |
| `conversation_id` | `String(100)` | UUID generated per fire |
| `status` | `String(32)` | `running` / `success` / `error` / `skipped` |
| `fired_by` | `String(32)` | `scheduler` / `webhook` / `poll` / `manual` |
| `started_at` / `finished_at` | `BigInteger` | Milliseconds since epoch |
| `duration_ms` | `Integer` | |
| `inputs_snapshot` | `JSON` | Snapshot of inputs at time of fire |
| `outputs` | `JSON` | Last chunk from async generator |
| `error_message` | `Text` | Set on `error` status |
| `poll_hash_seen` | `String(128)` | Polling only — the hash that triggered the fire |

---

### `routers/triggers.py`

| Endpoint | Auth | Description |
|---|---|---|
| `POST /triggers/create` | JWT | Create trigger; generates `webhook_token` for webhook type; registers scheduler job for cron/polling |
| `POST /triggers/list` | JWT | Paginated list with filters (type, is_active, space_id) |
| `POST /triggers/get` | JWT | Single trigger detail |
| `POST /triggers/update` | JWT | Update; re-registers scheduler job if schedule changed |
| `POST /triggers/delete` | JWT | Delete; removes scheduler job and all execution logs |
| `POST /triggers/activate` | JWT | Set `is_active=True`; registers scheduler job |
| `POST /triggers/deactivate` | JWT | Set `is_active=False`; removes scheduler job |
| `POST /triggers/run` | JWT | Manual fire via `asyncio.create_task` |
| `POST /triggers/execution_logs` | JWT | Paginated execution log for a trigger |
| `POST /triggers/execution_log_detail` | JWT | Single log entry |
| `GET /triggers/inbound/{webhook_token}` | None | Webhook receiver (GET handshake) |
| `POST /triggers/inbound/{webhook_token}` | None | Webhook receiver — verifies HMAC if secret set; fires via BackgroundTasks; always returns 200 |

---

## Technical Constraints

**Single scheduler process:**
APScheduler runs as a singleton inside the FastAPI process. If the application is
deployed with multiple workers (e.g. `--workers 4`), only one worker should own the
scheduler. The current implementation does not include a distributed lock. Webhook
triggers are unaffected (stateless HTTP).

**Blocking poll in thread:**
`requests.get()` is synchronous. It is run via `asyncio.to_thread()` to avoid
blocking the event loop. The timeout is 15 seconds. Network errors are caught and
recorded as `error` log entries.

**Full generator consumption:**
`_fire_execution()` consumes the entire async generator from `agent_mgr.run()` /
`flow_mgr.run()` before returning. Partial consumption leaks resources. Only the last
chunk is used for output extraction.

**No real-time output delivery:**
Results are stored in the execution log. There is no mechanism to push outputs to
the webhook caller, an email address, or any other destination after execution. A
post-execution notification step (e.g. send result to Slack) would need to be
implemented inside the agent or workflow itself.

**Coalesce behavior:**
If the server misses multiple scheduled fires (e.g. was down for 3 hours during a
job that runs every hour), APScheduler fires the job exactly once on restart, not 3
times. This is intentional (`coalesce=True`).

---

## Impact on Existing Systems

### Database

Three new tables, no changes to existing tables:

| Table | Created by | Purpose |
|---|---|---|
| `trigger` | SQLAlchemy `Base.metadata.create_all()` on startup | Trigger definitions |
| `trigger_execution_log` | Same | Execution history |
| `apscheduler_jobs` | APScheduler SQLAlchemyJobStore on first `scheduler.start()` | APScheduler internal job state |

### Agent and Workflow Execution

No changes to `agent_mgr`, `flow_mgr`, or any execution-layer code.
The trigger runner passes `user_id_str="system_trigger"` in the `current_user` dict.
The manager's `_internal_run()` checks for this value to skip `check_user_space()`.
This is the only coupling point between the scheduler and the execution layer.

### FastAPI Application

Two lifespan hooks added to `main.py`:

```python
# startup
init_scheduler(settings.DB_URL)
await sync_triggers_to_scheduler(scheduler)
scheduler.start()

# shutdown
scheduler.shutdown()
```

Two routers registered:
```python
app.include_router(triggers_router, prefix="/api/v1/triggers")
app.include_router(triggers_inbound_router, prefix="/api/v1/triggers")
```

### Security

| Surface | Risk | Mitigation |
|---|---|---|
| `/inbound/{webhook_token}` | Public endpoint callable by anyone with the token | Optional HMAC-SHA256 signature verification (`X-Hub-Signature-256`); timing-safe `compare_digest` |
| Unknown webhook tokens | Token enumeration | Always returns 200; trigger lookup is silent |
| System user | `role_type=super_user` bypasses space check | Only used in `execute_trigger_job()`; `user_id_str="system_trigger"` is checked explicitly in the manager |
| Polling fetch | Server-side request forgery (SSRF) | No mitigations currently; `poll_url` is user-supplied; consider URL allowlist for sensitive deployments |

---

## End-to-End Scenarios

### Scenario A — Cron trigger: daily morning report

**Context:** A workflow "Morning Briefing" is set up with a cron trigger
`0 7 * * 1-5` (weekdays at 07:00 UTC). The trigger is active.

```
1. APScheduler fires at 07:00 UTC Monday
   jobs.py: execute_trigger_job("trig-abc", fired_by="scheduler")

2. runner.py: load TriggerDB — is_active=True, trigger_type="cron"

3. make_system_user("space-123")
   _write_log(status="running") → log row id=1001

4. flow_mgr.run(id="wf-42", version="draft",
               inputs={}, conversation_id="uuid-...",
               space_id="space-123", current_user=system_user)
   (async generator consumed fully)

5. log.status = "success"
   log.outputs = {last_chunk fields}
   log.duration_ms = 3420
   db.commit()

6. UI: Triggers → Morning Briefing → History shows:
   ✅ success  fired_by=scheduler  07:00 UTC  3.4s
```

---

### Scenario B — Webhook trigger: GitHub push notification

**Context:** A trigger is configured with a GitHub webhook.
The trigger's inbound URL is `https://app.example.com/api/v1/triggers/inbound/tok-xyz`.
A `webhook_secret` is set. The target is an agent "PR Reviewer".

```
1. Developer pushes to GitHub
   GitHub sends POST to inbound URL with X-Hub-Signature-256 header

2. FastAPI: webhook_inbound(webhook_token="tok-xyz", request, background_tasks)
   SELECT TriggerDB WHERE webhook_token="tok-xyz" AND is_active=True → found

3. secret = trigger.config["webhook_secret"]  → present
   body = await request.body()
   sig_header = request.headers["X-Hub-Signature-256"]
   verify_webhook_signature(body, sig_header, secret) → True

4. HTTP response returned immediately: {"status": "accepted"}

5. background_tasks.add_task(execute_trigger_job, "trig-xyz", "webhook")
   (runs asynchronously after response)

6. runner.py: trigger_type="webhook" → _fire_execution()
   agent_mgr.run(id="agent-pr", inputs=input_payload, ...)
   log: success / error / duration
```

---

### Scenario C — Polling trigger: RSS feed changed

**Context:** A polling trigger monitors `https://news.example.com/feed.rss` every
10 minutes. Target is a workflow "News Summarizer". First run.

```
1. APScheduler fires (interval: 600 s)
   execute_trigger_job("trig-poll", fired_by="scheduler")

2. _handle_polling()
   requests.get("https://news.example.com/feed.rss", timeout=15)
   → 200, body 42 KB
   current_hash = sha256(body) = "a1b2c3..."

3. last_seen_hash = config.get("last_seen_hash") → None  (first run)

4. UPDATE trigger.config:
   {"last_seen_hash": "a1b2c3...", "last_checked_at": 1712000000000}

5. current_hash != last_seen_hash (last_seen_hash was None)
   → fire unconditionally
   _fire_execution(fired_by="poll", extra_inputs={"_poll_hash": "a1b2c3..."})
   flow_mgr.run(inputs={"_poll_hash": "a1b2c3..."})
   log: success

--- 10 minutes later: content unchanged ---

6. _handle_polling()
   requests.get(...) → same body
   current_hash = "a1b2c3..."
   last_seen_hash = "a1b2c3..." → equal

7. _write_log(status="skipped", poll_hash_seen="a1b2c3...")
   return  (no execution, no agent/workflow call)

--- Next run: page updated ---

8. current_hash = "d4e5f6..." ≠ "a1b2c3..."
   UPDATE last_seen_hash = "d4e5f6..."
   _fire_execution()  → workflow runs again
```

---

## External Dependencies

| Package | Version | Used by | License |
|---|---|---|---|
| `apscheduler` | 3.10.x | Scheduler init, job store, cron/interval triggers | MIT |
| `requests` | Any | Polling HTTP GET | Apache 2.0 |
| `sqlalchemy` | Existing | APScheduler job store + trigger DB models | MIT |
| `fastapi` / `starlette` | Existing | Webhook router + BackgroundTasks | MIT |

No new external service accounts required.
