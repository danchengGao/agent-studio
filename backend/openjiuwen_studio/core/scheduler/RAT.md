# Requirements Analysis — Scheduled Triggers

---

## Source of Demand

- **Proactive Planning** — New Features
- **Product Requirements** — OpenJiuwen Platform / Automation & Orchestration

---

## Demand Background

### WHY

OpenJiuwen lets users build agents and workflows, but today those agents and workflows
only run when a human opens the browser and presses a button. Every execution is
manual and synchronous. This creates a ceiling on the value the platform can deliver:

- A workflow that needs to run every morning cannot be automated.
- An agent that should react to an external event (a new GitHub issue, an incoming
  HTTP POST) has no way to receive that event.
- A workflow that should fire whenever a monitored web page changes cannot detect
  the change.

Users who want automation today must build their own external scheduler, write their
own polling scripts, or set up their own webhook relay — and then call the OpenJiuwen
API manually. This is friction the platform should absorb.

The goal of this feature is to give agents and workflows a native way to be triggered
automatically, covering the three most common automation patterns:

1. **Time schedule** — run at a fixed cron schedule (every day at 09:00 UTC, every
   Monday, etc.).
2. **Inbound webhook** — run whenever an external system sends an HTTP POST to a
   unique URL (GitHub push, Stripe payment, Zapier action, etc.).
3. **Content polling** — run whenever the content at a monitored URL changes
   (a public API endpoint, an RSS feed, a status page, etc.).

### WHEN

New feature, targeted for delivery with the current OpenJiuwen platform release.

### WHAT

The feature is delivered as:

- A **Triggers** management UI — create, edit, activate/deactivate, delete triggers;
  view execution history per trigger.
- A **REST API** — full CRUD + activate/deactivate/run-manual + execution logs.
- A **scheduler backend** — APScheduler embedded in the FastAPI process, persisting
  jobs to the existing database, rebuilt from DB on every startup.
- A **webhook inbound receiver** — a public FastAPI endpoint that accepts HTTP POST
  requests and fires the corresponding trigger asynchronously.

---

**Trigger Types**

| Type | How it fires | Config |
|---|---|---|
| **Cron** | APScheduler fires the job at the cron schedule (UTC) | `cron_expr` — standard 5-field cron expression |
| **Webhook** | External system POSTs to `/api/v1/triggers/inbound/{token}` | `webhook_secret` — optional HMAC-SHA256 secret for signature verification |
| **Polling** | APScheduler polls a URL at a fixed interval; fires only when content changes | `poll_url`, `poll_interval_seconds` |

**Trigger Targets**

| Target | Run mechanism |
|---|---|
| Agent | `agent_mgr.run()` — same path as interactive chat |
| Workflow | `flow_mgr.run()` — same path as GUI workflow execution |

**Input Payload**

Each trigger stores an optional `input_payload` dict. Its key/value pairs are
forwarded as inputs to every execution. For polling triggers, the SHA-256 hash of
the fetched content is additionally injected as `_poll_hash`.

**Execution Log**

Every fire attempt is recorded in `trigger_execution_log` with:
- Status: `running` → `success` / `error` / `skipped`
- `fired_by`: `scheduler` / `webhook` / `poll` / `manual`
- Duration, inputs snapshot, outputs, error message
- `poll_hash_seen` (polling only) — the content hash that triggered the fire

---

### Requirement Type

☑ **Functionality** (excluding Trust)
☑ **Operation and Maintenance Methods** (scheduler lifecycle, DB-backed persistence)

---

## Needs Assessment

### Constraints

**No streaming output to trigger caller:**
Agent and workflow execution is consumed fully before the trigger log is written.
There is no streaming/real-time delivery of results to any external system. The output
is stored in the execution log and visible in the UI afterward.

**Polling content cap:**
The polling handler caps response body at 10 MB before hashing. Responses larger than
10 MB are hashed only on their first 10 MB. This is a practical safeguard against
memory exhaustion on arbitrarily large responses.

**Polling: first check always fires:**
On the very first poll of a new trigger (no `last_seen_hash` stored yet), the trigger
fires unconditionally regardless of content. Subsequent polls fire only on change.

**Cron and polling triggers require an active server:**
Cron and polling jobs live in APScheduler inside the FastAPI process. If the server is
down at a scheduled time, APScheduler will coalesce missed fires and run at most once
on the next startup (within `misfire_grace_time` = 86 400 seconds / 24 hours).

**Webhook triggers require a public URL:**
The inbound webhook endpoint must be reachable from the external system (GitHub,
Stripe, Zapier, etc.). Local development requires a tunnel (ngrok or equivalent).
Deployment infrastructure is outside the scope of this feature.

**System user execution:**
Trigger-fired executions run under a synthetic `system_trigger` user with
`role_type = super_user`. The space ownership check (`check_user_space`) is bypassed
for this user inside the manager. No real user token is involved.

**One scheduler instance:**
APScheduler runs as a singleton inside the FastAPI process. Multi-process deployments
(e.g. multiple uvicorn workers) are not supported for scheduler-based triggers. Only
one process should own the scheduler. Webhook triggers are stateless and safe across
multiple workers.

### Impact of Requirement Implementation on Existing Systems

**Database:** Two new tables are created on first startup:
- `trigger` — trigger definitions
- `trigger_execution_log` — execution history
- `apscheduler_jobs` — APScheduler's internal job store (auto-created by APScheduler)

No existing tables are modified.

**Agent and workflow execution:** No changes to `agent_mgr.run()` or `flow_mgr.run()`.
The trigger runner calls them exactly as the interactive UI does, passing a synthetic
`current_user` dict.

**FastAPI application:** Two routers are registered at startup:
- `triggers_router` (JWT-protected) at `/api/v1/triggers`
- `triggers_inbound_router` (no JWT) at `/api/v1/triggers` — only the `/inbound/{token}` path

**Startup sequence:** `init_scheduler()` + `sync_triggers_to_scheduler()` are called
during application startup (FastAPI lifespan). Shutdown calls `scheduler.shutdown()`.

**Existing users and the web UI:** No impact. All changes are additive.

### External Dependencies

| Dependency | Version | Purpose |
|---|---|---|
| `apscheduler` | 3.x | Cron and interval job scheduling; SQLAlchemy job store |
| `requests` | Any | Polling HTTP GET (run in thread to avoid blocking event loop) |
| `sqlalchemy` | Existing (already a dependency) | APScheduler job store; trigger DB models |
| `fastapi` / `starlette` `BackgroundTasks` | Existing | Async webhook execution without blocking the HTTP response |

No new external service accounts or infrastructure are required.
For webhook triggers to receive external POSTs, the deployment must expose a public HTTPS URL.
