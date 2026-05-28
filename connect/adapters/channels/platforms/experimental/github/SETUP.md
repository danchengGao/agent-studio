# GitHub — Setup Guide

Control OpenJiuwen by commenting slash commands on GitHub issues and PRs.

## How it works

1. Your team comments `/workflow run <id>` on a GitHub issue
2. The bot posts a reply with the result (or asks for parameters)
3. The conversation continues in the same issue thread

This is ideal for:
- Triggering code review agents on PRs (`/agent run code-reviewer Review this PR`)
- Running deployment workflows from release issues
- Keeping OpenJiuwen output alongside the relevant context

## Prerequisites

- A GitHub Personal Access Token (or GitHub App) with `repo` scope
- Python deps: `pip install fastapi uvicorn` (already in `channels/requirements.txt`)
- A public HTTPS URL for the webhook (use [ngrok](https://ngrok.com) locally)

## Step-by-step

### 1. Create a GitHub token

Go to GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens**.

Create a token with:
- **Repository access**: the repos where you want the bot active
- **Permissions → Issues → Read & write** (to post comments)
- **Permissions → Pull requests → Read & write** (for PR comments)

### 2. Register the webhook

Go to your repo → **Settings → Webhooks → Add webhook**.

| Field | Value |
|---|---|
| Payload URL | `https://<your-host>/webhook` |
| Content type | `application/json` |
| Secret | Any string — pass it as `--webhook-secret` |
| Events | Select **"Issue comments"** only |

### 3. Expose your server (local dev)

```bash
ngrok http 8080
```

Use the `https://....ngrok.io` URL as the webhook payload URL.

### 4. Run the bot

```bash
export GITHUB_TOKEN=ghp_...
python -m channels.run github $GITHUB_TOKEN --webhook-secret mysecret
```

### 5. Test it

On any issue in your repo, comment:

```
/help
```

The bot should reply with the command list.

---

## All Options

| Option / Argument | Default | Description |
|---|---|---|
| `GITHUB_TOKEN` | _(required)_ | GitHub token for posting comments. Env: `GITHUB_TOKEN` |
| `--webhook-secret SECRET` | _(none)_ | HMAC secret from webhook settings. Env: `GITHUB_WEBHOOK_SECRET` |
| `--backend-url URL` | `http://localhost:8000` | OpenJiuwen backend URL. Env: `BACKEND_URL` |
| `--access-token TOKEN` | _(none)_ | Static backend token — skips per-user login. Env: `ACCESS_TOKEN` |
| `--host HOST` | `0.0.0.0` | Bind address. Env: `HOST` |
| `--port PORT` | `8080` | Listen port. Env: `PORT` |

---

## Commands

Comment on any issue or PR:

| Command | Description |
|---|---|
| `/login` | Log in to OpenJiuwen |
| `/logout` | Log out |
| `/status` | Show login status |
| `/cancel` | Cancel any active operation |
| `/health` | Check backend connectivity |
| `/help` | Show this message |
| `/workflows` | List all workflows |
| `/workflows search <query>` | Search workflows by name |
| `/workflow run <id>` | Run a workflow (collects params interactively) |
| `/agents` | List all agents |
| `/agents search <query>` | Search agents by name |
| `/agent run <id> <message>` | Run an agent with a single message |
| `/agent chat <id>` | Start a multi-turn agent chat |
| `/skip` | Skip an optional workflow parameter |

---

## Multi-turn workflows

When a workflow has input parameters, the bot collects them one at a time via issue comments:

```
You:  /workflow run abc123
Bot:  Enter value for city (string, required):
You:  London
Bot:  Enter value for days (integer, optional — comment /skip to skip):
You:  /skip
Bot:  Running workflow...
Bot:  Result: {"forecast": "Sunny, 22 C"}
```

State is per-user (GitHub username) — multiple users can run separate workflows in the same issue simultaneously.

---

## Auth modes

**Per-user login** (default): each GitHub user runs `/login` and gets their own OpenJiuwen session. Tokens are stored keyed by GitHub username in `platforms/github/.github_tokens.json`.

**Shared token**: pass `--access-token TOKEN` to skip per-user login. All users share one backend session. Useful for team-internal bots.

---

## Security

- Always set `--webhook-secret` in production — it validates that requests genuinely come from GitHub
- The GitHub token only needs `issues: write` and `pull_requests: write` permissions
- Tokens are stored as plaintext JSON — run on a trusted internal server or use file encryption
- Consider restricting which users the bot responds to (e.g. org members only) via a custom check in `bot.py`

---

## Troubleshooting

| Problem | Solution |
|---|---|
| No reply posted | Check GitHub token has `issues: write` permission |
| `401 Invalid signature` | Webhook secret in GitHub settings must match `--webhook-secret` |
| Bot responds to its own comments | `parse_issue_comment` skips `Bot` sender type — check your token account type |
| Login fails | Verify backend URL and OpenJiuwen credentials |
| Command not recognized | Commands must start with `/` — the bot ignores comments without a slash command |
