# Scheduled Triggers

Scheduled Triggers let you automate agent or workflow executions without manual intervention. Instead of clicking "Run", a trigger fires the execution for you — on a timed schedule, in response to an inbound webhook call, or whenever a polled URL changes its content.

## Trigger Types

| Type | How it fires | Typical use case |
|:----:|:-------------|:----------------|
| **Cron** | APScheduler runs the job at a cron-defined schedule | Daily reports, nightly data sync, weekly summaries |
| **Webhook** | An external system POSTs to a unique inbound URL | CI/CD pipelines, GitHub/GitLab events, Slack slash commands |
| **Polling** | The platform periodically fetches a URL and fires when the content changes | News feeds, API status pages, price trackers |

---

## Create a Trigger

1. Navigate to **Triggers** in the left sidebar.
2. Click **New Trigger**.
3. Fill in the form (described in detail below) and click **Save** or **Save & Activate**.

### General Settings

| Field | Description |
|:-----:|:-----------|
| **Name** | A short display name for the trigger. Required. |
| **Description** | Optional free-text description. |
| **Target Type** | Choose **Agent** or **Workflow** — the entity that will be executed when the trigger fires. |
| **Target** | Select the specific agent or workflow from the dropdown. |
| **Version** | Which version to run. Use `draft` for the latest unpublished version, or enter a published version string. Defaults to `draft`. |
| **Input Payload** | Key/value pairs forwarded as input to the agent or workflow on every execution. Click **Add Input** to add rows. |

### Cron Configuration

Enter a standard cron expression (5 fields: minute hour day month weekday).

| Field | Example | Meaning |
|:-----:|:-------:|:--------|
| Cron Expression | `0 9 * * 1` | Every Monday at 09:00 |
| Cron Expression | `*/15 * * * *` | Every 15 minutes |
| Cron Expression | `0 0 1 * *` | First day of every month at midnight |

A human-readable preview of the schedule is shown beneath the input field as you type.

**Quick reference:**

```
┌───────── minute (0-59)
│ ┌─────── hour (0-23)
│ │ ┌───── day of month (1-31)
│ │ │ ┌─── month (1-12)
│ │ │ │ ┌─ day of week (0-7, 0=Sunday)
│ │ │ │ │
* * * * *
```

### Webhook Configuration

When you create a webhook trigger, the platform generates a unique **inbound URL**:

```
https://<your-host>/api/v1/triggers/inbound/<webhook-token>
```

Send a POST request to this URL from any external system to fire the trigger immediately.

| Field | Description |
|:-----:|:-----------|
| **Webhook Token** | Read-only. Shown after the trigger is saved. Embed it in the URL above. |
| **Webhook Secret** | Optional. If set, the platform validates the `X-Hub-Signature-256` HMAC-SHA256 signature on every inbound request (GitHub-style). Leave blank to accept all requests. |

**Signing requests (when Webhook Secret is set):**

```python
import hmac, hashlib

body = b'{"event": "push"}'
secret = "your_webhook_secret"

sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
# Send header: X-Hub-Signature-256: sha256=<sig>
```

> **Security note:** The inbound endpoint always returns HTTP 200 for unknown tokens to prevent token enumeration. Check execution logs to confirm delivery.

### Polling Configuration

| Field | Description |
|:-----:|:-----------|
| **Poll URL** | The URL the platform will fetch on each interval. |
| **Interval** | How often to check. Choices: 1 min, 5 min, 15 min, 30 min, 1 hour, 6 hours, 24 hours. |
| **Last Checked At** | Read-only. Timestamp of the most recent poll attempt. |
| **Last Seen Hash** | Read-only. SHA-256 hash of the last fetched content. |

**Behavior:**
- On the **first** poll after activation, the trigger always fires (there is no prior hash to compare against).
- On subsequent polls, the content is hashed and compared to the stored hash. The trigger fires only when the hash changes.
- If the content is unchanged, a log entry with status `skipped` is recorded — no execution is started.

---

## Activate and Deactivate

A trigger can be in one of two states:

| State | Meaning |
|:-----:|:--------|
| **Active** | The trigger is live. Cron and polling jobs are running in the scheduler. Webhook inbound requests will fire executions. |
| **Inactive** | The trigger is paused. No executions fire automatically. The inbound webhook URL still accepts requests but they are silently dropped. |

**To activate:** Click **Save & Activate** when creating, or click the status chip on the Triggers list page and select **Activate**.

**To deactivate:** Click the status chip on the list and select **Deactivate**, or open the trigger and use the action menu.

---

## Manual Execution

You can fire a trigger immediately regardless of its schedule:

1. Open the Triggers list.
2. Click the **Run** button (play icon) next to the trigger.

This is useful for testing before activating a trigger or for one-off executions.

---

## Execution History

Every trigger execution — whether fired by the scheduler, a webhook, a poll, or manually — creates an execution log entry.

To view history:
1. Open the trigger (click its name on the list).
2. Scroll to the **Execution History** section.

### Log Fields

| Column | Description |
|:------:|:-----------|
| **Status** | `running`, `success`, `error`, or `skipped` (polling only, content unchanged) |
| **Fired By** | `scheduler`, `webhook`, `poll`, or `manual` |
| **Started At** | Timestamp when the execution began |
| **Duration** | Wall-clock time in milliseconds |
| **Trace** | Link icon — opens the full execution trace in the trace viewer |

---

## Edit and Delete

**Edit:** Open a trigger from the list. All fields except **Trigger Type** can be modified. The type is fixed at creation time.

**Delete:** Click the delete (trash) icon on the trigger list row. A confirmation dialog is shown before deletion. Deleting a trigger also removes its scheduler job and all execution logs.

---

## Trigger List — Filters

On the Triggers list page you can filter by:

- **Type** — Cron / Webhook / Polling
- **Status** — Active / Inactive

---

## Example: Daily Agent Report

**Goal:** Run the "Daily Summary Agent" every weekday at 08:30.

1. Click **New Trigger**.
2. Name: `Daily Summary — Weekdays`
3. Target Type: `Agent` → select `Daily Summary Agent`
4. Version: `draft`
5. Input Payload: `{"report_date": "today"}` (add key `report_date`, value `today`)
6. Trigger Configuration tab: `Cron` → enter `30 8 * * 1-5`
   - Preview shows: *"At 08:30 AM, Monday through Friday"*
7. Click **Save & Activate**.

The agent now runs automatically every weekday morning.

---

## Example: Webhook from GitHub

**Goal:** Run a "Code Review Workflow" whenever a pull request is opened.

1. Click **New Trigger**.
2. Name: `GitHub PR Review`
3. Target Type: `Workflow` → select `Code Review Workflow`
4. Trigger Configuration tab: `Webhook`
5. Click **Save** (not Save & Activate yet).
6. Copy the inbound URL shown on the form.
7. In GitHub → Repository Settings → Webhooks → Add webhook:
   - Payload URL: paste the inbound URL
   - Content type: `application/json`
   - Secret: the Webhook Secret you set (leave blank if none)
   - Events: "Pull requests"
8. Back in the Triggers list, activate the trigger.

GitHub will now POST to the inbound URL on every pull-request event.

---

## Example: Poll a News Feed

**Goal:** Run a "News Digest Agent" whenever a blog's RSS feed publishes a new post.

1. Click **New Trigger**.
2. Name: `Tech Blog Watcher`
3. Target Type: `Agent` → select `News Digest Agent`
4. Trigger Configuration tab: `Polling`
5. Poll URL: `https://example.com/rss.xml`
6. Interval: `1 hour`
7. Click **Save & Activate**.

Every hour the platform fetches the RSS feed. When a new item appears, the XML hash changes and the agent fires. The execution log shows `skipped` during quiet hours when nothing changes.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|:--------|:-------------|:----|
| Trigger saved but never fires | Trigger is inactive | Activate the trigger from the list |
| Webhook returns 200 but no execution appears | Wrong token in URL, or trigger is inactive | Check the inbound URL and activation state |
| Cron trigger fires at unexpected time | Server timezone vs. cron expression | Cron expressions are evaluated in the server's local timezone (UTC by default) |
| Polling always shows `skipped` | Content-Type or dynamic elements cause hash changes | The full response body is hashed — check for timestamps or nonces in the response |
| Polling never shows `skipped` (always fires) | Response changes every request | Add a stable hash anchor or switch to Webhook if the source supports it |
| Execution logs show `error` | Agent/workflow runtime error | Click the Trace link in the log row to inspect the full execution trace |
