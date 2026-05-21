# Channels — Developer Quick-Start

Connect OpenJiuwen to any messaging platform, voice assistant, or CLI. Each platform is a thin adapter on top of shared `client/` logic — add one, get all features.

---

## Supported Platforms

### Production-Ready Platforms

These platforms are stable, tested, and ready for production use:

| Platform | How to start | Setup guide |
|---|---|---|
| **CLI** | Run commands in your terminal | [SETUP.md](platforms/cli/SETUP.md) |
| **Email** | Monitor an inbox and reply via email | [SETUP.md](platforms/email/SETUP.md) |
| **Webhook** | Call a REST API from any system | [SETUP.md](platforms/webhook/SETUP.md) |
| **Telegram** | Run a Telegram bot | [SETUP.md](platforms/telegram/SETUP.md) |
| **Slack** | Install a Slack app | [SETUP.md](platforms/slack/SETUP.md) |

### Experimental Platforms

These platforms are functional but still under development. They may have rough edges or incomplete features:

| Platform | How to start | Setup guide |
|---|---|---|
| **WeChat** | WeChat Official Account bot | [SETUP.md](platforms/experimental/wechat/SETUP.md) |
| **Discord** | Add a Discord bot | [SETUP.md](platforms/experimental/discord/SETUP.md) |
| **WhatsApp** | Connect via WhatsApp Business API | [SETUP.md](platforms/experimental/whatsapp/SETUP.md) |
| **Microsoft Teams** | Deploy a Teams bot | [SETUP.md](platforms/experimental/teams/SETUP.md) |
| **Facebook Messenger** | Messenger bot via Meta Graph API | [SETUP.md](platforms/experimental/messenger/SETUP.md) |
| **GitHub** | Slash commands in issue/PR comments | [SETUP.md](platforms/experimental/github/SETUP.md) |
| **Google Assistant** | Voice + text via Google Actions | [SETUP.md](platforms/experimental/google_assistant/SETUP.md) |
| **Twilio SMS** | Send and receive SMS via Twilio | [SETUP.md](platforms/experimental/twilio/SETUP.md) |
| **Amazon Alexa** | Voice skill via Alexa Skills Kit | [SETUP.md](platforms/experimental/alexa/SETUP.md) |

---

## Requirements

- Python 3.10+
- A running OpenJiuwen backend

```bash
pip install -r channels/requirements.txt
```

---

## Available Commands (all platforms)

### Authentication
| Command | Description |
|---|---|
| `login` | Start login flow (prompts for username, optionally password) |
| `logout` | Clear stored credentials |
| `status` | Show current login state and token validity |
| `cancel` | Cancel any active operation |

### Workflows
| Command | Description |
|---|---|
| `workflows` | List all workflows in your space (up to 10) |
| `workflows_search <keyword>` | Search workflows by name |
| `workflow_execute <workflow_id>` | Execute a workflow, collecting input parameters interactively |
| `workflow_skip` | Skip an optional workflow parameter during execution |
| `workflow_cancel` | Cancel the current workflow execution |

### Agents
| Command | Description |
|---|---|
| `agents` | List all agents in your space (up to 10) |
| `agents_search <keyword>` | Search agents by name |
| `agent_execute <agent_id> <message>` | Send a single message to an agent |
| `agent_start_chat <agent_id>` | Start an interactive chat session with an agent |
| `agent_end_chat` | End the current agent chat session |

### General
| Command | Description |
|---|---|
| `start` / `help` | Welcome message and command overview |
| `health` | Check backend connectivity |

> Platform-specific syntax varies — Telegram/Discord use `/command`, Slack uses `/command`, Teams/WhatsApp use text commands, CLI uses `python -m channels.run cli <command>`, Webhook uses HTTP routes.

---

## Running

All platforms launch through a single entry point:

```
python -m channels.run <platform> [args...]
```

---

### Telegram

```bash
python -m channels.run telegram <BOT_TOKEN> [BACKEND_URL] [ACCESS_TOKEN]
```

| Argument | Required | Description |
|---|---|---|
| `BOT_TOKEN` | Yes | Bot token from [@BotFather](https://t.me/BotFather) |
| `BACKEND_URL` | No | OpenJiuwen backend URL. Default: `http://localhost:8000`. Env: `BACKEND_URL` |
| `ACCESS_TOKEN` | No | Static backend token — all users share it, per-user login is skipped. Env: `ACCESS_TOKEN` |

```bash
python -m channels.run telegram 123456:ABCDEF
python -m channels.run telegram 123456:ABCDEF http://my-server:8000
python -m channels.run telegram 123456:ABCDEF http://my-server:8000 eyJhbGci...
```

---

### Slack

Uses **Socket Mode** — no public URL needed.

```bash
python -m channels.run slack <BOT_TOKEN> <APP_TOKEN> [BACKEND_URL] [ACCESS_TOKEN]
```

| Argument | Required | Description |
|---|---|---|
| `BOT_TOKEN` | Yes | `xoxb-...` — Bot User OAuth Token (Slack App → OAuth & Permissions) |
| `APP_TOKEN` | Yes | `xapp-...` — App-Level Token with `connections:write` scope (Slack App → App-Level Tokens) |
| `BACKEND_URL` | No | OpenJiuwen backend URL. Default: `http://localhost:8000`. Env: `BACKEND_URL` |
| `ACCESS_TOKEN` | No | Static backend token. Env: `ACCESS_TOKEN` |

```bash
python -m channels.run slack xoxb-... xapp-...
python -m channels.run slack xoxb-... xapp-... http://my-server:8000
python -m channels.run slack xoxb-... xapp-... http://my-server:8000 eyJhbGci...
```

---

### Discord

Uses the **Discord Gateway** (WebSocket) — no public URL needed. Slash commands register automatically on first connect.

```bash
python -m channels.run discord <BOT_TOKEN> [BACKEND_URL] [ACCESS_TOKEN]
```

| Argument | Required | Description |
|---|---|---|
| `BOT_TOKEN` | Yes | Bot token from Discord Developer Portal → Bot → Token |
| `BACKEND_URL` | No | OpenJiuwen backend URL. Default: `http://localhost:8000`. Env: `BACKEND_URL` |
| `ACCESS_TOKEN` | No | Static backend token. Env: `ACCESS_TOKEN` |

```bash
python -m channels.run discord TOKEN
python -m channels.run discord TOKEN http://my-server:8000
python -m channels.run discord TOKEN http://my-server:8000 eyJhbGci...
```

---

### WhatsApp

Runs an **aiohttp webhook server**. Meta POSTs inbound messages to your `/webhook` endpoint — requires a public HTTPS URL (use [ngrok](https://ngrok.com) for local dev).

```bash
python -m channels.run whatsapp <ACCESS_TOKEN> <PHONE_NUMBER_ID> [OPTIONS]
```

| Argument / Option | Required | Description |
|---|---|---|
| `ACCESS_TOKEN` | Yes | Meta API permanent access token (Meta Developer Portal → App → WhatsApp → API Setup) |
| `PHONE_NUMBER_ID` | Yes | WhatsApp Phone Number ID (same location) |
| `--verify-token TOKEN` | No | Webhook verify token set in Meta Portal. Default: `openjiuwen_verify`. Env: `WHATSAPP_VERIFY_TOKEN` |
| `--backend-url URL` | No | OpenJiuwen backend URL. Default: `http://localhost:8000`. Env: `BACKEND_URL` |
| `--access-token-backend TOKEN` | No | Static backend token. Env: `ACCESS_TOKEN` |
| `--host HOST` | No | Bind address. Default: `0.0.0.0`. Env: `HOST` |
| `--port PORT` | No | Listen port. Default: `8080`. Env: `PORT` |

Endpoints: `GET /webhook` (Meta verification challenge), `POST /webhook` (incoming messages), `GET /health`

```bash
python -m channels.run whatsapp TOKEN PHONE_ID
python -m channels.run whatsapp TOKEN PHONE_ID --backend-url http://my-server:8000 --verify-token mysecret
python -m channels.run whatsapp TOKEN PHONE_ID --port 8080
```

---

### Microsoft Teams

Runs an **aiohttp webhook server**. Azure Bot Service POSTs inbound messages to `/api/messages` — requires a public HTTPS URL.

```bash
python -m channels.run teams <APP_ID> <APP_PASSWORD> [OPTIONS]
```

| Argument / Option | Required | Description |
|---|---|---|
| `APP_ID` | Yes | Azure Bot App ID (Azure Portal → Bot Registration → Configuration) |
| `APP_PASSWORD` | Yes | Azure Bot App Password / Client Secret (same location) |
| `--backend-url URL` | No | OpenJiuwen backend URL. Default: `http://localhost:8000`. Env: `BACKEND_URL` |
| `--access-token TOKEN` | No | Static backend token. Env: `ACCESS_TOKEN` |
| `--host HOST` | No | Bind address. Default: `0.0.0.0`. Env: `HOST` |
| `--port PORT` | No | Listen port. Default: `3978`. Env: `PORT` |

Endpoints: `POST /api/messages` (Bot Framework activity endpoint), `GET /health`

```bash
python -m channels.run teams APP_ID APP_PASSWORD
python -m channels.run teams APP_ID APP_PASSWORD --backend-url http://my-server:8000 --port 3978
```

---

### Webhook

Stateless **FastAPI HTTP server**. Any external system (scripts, n8n, Zapier, CI pipelines) can trigger agents and workflows via HTTP. Interactive docs at `/docs` once running.

```bash
python -m channels.run webhook [OPTIONS]
```

| Option | Required | Description |
|---|---|---|
| `--host HOST` | No | Bind address. Default: `0.0.0.0`. Env: `WEBHOOK_HOST` |
| `--port PORT` | No | Listen port. Default: `8080`. Env: `WEBHOOK_PORT` |
| `--backend-url URL` | No | OpenJiuwen backend URL. Default: `http://localhost:8000`. Env: `BACKEND_URL` |
| `--token TOKEN` | No | Static backend token used when requests don't supply their own. Env: `ACCESS_TOKEN` |
| `--api-key KEY` | No | If set, every request must include `X-API-Key: <key>`. Env: `WEBHOOK_API_KEY` |

Endpoints: `GET /health`, `POST /agents/list`, `POST /agents/search`, `POST /agents/execute`, `POST /workflows/list`, `POST /workflows/search`, `POST /workflows/execute`

```bash
python -m channels.run webhook
python -m channels.run webhook --port 9000 --backend-url http://my-server:8000
python -m channels.run webhook --token eyJhbGci... --api-key mysecret
```

---

### CLI

Interactive terminal interface. Token is stored per OS user in `platforms/cli/.cli_tokens.json`.

```bash
python -m channels.run cli [--backend-url URL] <command> [args...]
```

**Global option:**

| Option | Description |
|---|---|
| `--backend-url URL` | OpenJiuwen backend URL. Default: `http://localhost:8000`. Env: `BACKEND_URL` |

**Auth & general:**

```bash
python -m channels.run cli login
python -m channels.run cli logout
python -m channels.run cli status
python -m channels.run cli health
```

**Workflow commands:**

```bash
python -m channels.run cli workflow list
python -m channels.run cli workflow search <keyword>
python -m channels.run cli workflow execute <workflow_id>
python -m channels.run cli workflow execute <workflow_id> -i key1=value1 -i key2=value2
```

**Agent commands:**

```bash
python -m channels.run cli agent list
python -m channels.run cli agent search <keyword>
python -m channels.run cli agent execute <agent_id> <message>
python -m channels.run cli agent chat <agent_id>    # Interactive chat (type 'exit' to quit)
```

**With custom backend URL** (`--backend-url` goes before the subcommand):

```bash
python -m channels.run cli --backend-url http://my-server:8000 workflow list
```

---

### Email

Polls an **IMAP inbox** for unread messages and replies via **SMTP**. Uses only the Python standard library. The sender's email address is the user ID.

```bash
python -m channels.run email <IMAP_HOST> <SMTP_HOST> <EMAIL_ADDRESS> <PASSWORD> [OPTIONS]
```

| Argument / Option | Required | Description |
|---|---|---|
| `IMAP_HOST` | Yes | IMAP server hostname (e.g. `imap.gmail.com`) |
| `SMTP_HOST` | Yes | SMTP server hostname (e.g. `smtp.gmail.com`) |
| `EMAIL_ADDRESS` | Yes | Email address the bot monitors and replies from |
| `PASSWORD` | Yes | Email account password or app-specific password |
| `--imap-port PORT` | No | IMAP SSL port. Default: `993`. Env: `IMAP_PORT` |
| `--smtp-port PORT` | No | SMTP STARTTLS port. Default: `587`. Env: `SMTP_PORT` |
| `--backend-url URL` | No | OpenJiuwen backend URL. Default: `http://localhost:8000`. Env: `BACKEND_URL` |
| `--access-token TOKEN` | No | Static backend token. Env: `ACCESS_TOKEN` |
| `--poll-interval N` | No | Seconds between inbox polls. Default: `10`. Env: `EMAIL_POLL_INTERVAL` |

**Gmail setup:** enable IMAP in Gmail settings, then create an App Password (Google Account → Security → 2-Step Verification → App passwords).

```bash
python -m channels.run email imap.gmail.com smtp.gmail.com bot@gmail.com APP_PASSWORD
python -m channels.run email imap.gmail.com smtp.gmail.com bot@gmail.com APP_PASSWORD \
  --backend-url http://my-server:8000 --poll-interval 30
```

---

### Google Assistant

Runs a **FastAPI fulfillment webhook** that Google Assistant calls on every user turn. Requires a public HTTPS URL (use [ngrok](https://ngrok.com) for local dev).

```bash
python -m channels.run google_assistant [OPTIONS]
```

| Option | Required | Description |
|---|---|---|
| `--host HOST` | No | Bind address. Default: `0.0.0.0`. Env: `GA_HOST` |
| `--port PORT` | No | Listen port. Default: `8080`. Env: `GA_PORT` |
| `--backend-url URL` | No | OpenJiuwen backend URL. Default: `http://localhost:8000`. Env: `BACKEND_URL` |
| `--access-token TOKEN` | No | Static backend token. Env: `ACCESS_TOKEN` |
| `--api-key KEY` | No | If set, requests must include `X-API-Key: <key>`. Env: `GA_API_KEY` |

**Endpoint:** `POST /fulfillment` (register this URL in Google Actions Console → Webhook)

> **10-second timeout:** Google Assistant enforces a 10 s response deadline. Long-running workflows may not complete in time.

```bash
python -m channels.run google_assistant
python -m channels.run google_assistant --port 8080 --api-key mysecret
python -m channels.run google_assistant --backend-url http://my-server:8000
```

---

### Twilio SMS

Runs an **aiohttp webhook server**. Twilio POSTs inbound SMS to `/sms`. Uses only stdlib — no Twilio SDK needed. Requires a public HTTPS URL.

```bash
python -m channels.run twilio <ACCOUNT_SID> <AUTH_TOKEN> <FROM_NUMBER> [OPTIONS]
```

| Argument / Option | Required | Description |
|---|---|---|
| `ACCOUNT_SID` | Yes | Twilio Account SID (console.twilio.com) |
| `AUTH_TOKEN` | Yes | Twilio Auth Token (console.twilio.com) |
| `FROM_NUMBER` | Yes | Your Twilio phone number in E.164 format (e.g. `+15551234567`) |
| `--backend-url URL` | No | OpenJiuwen backend URL. Default: `http://localhost:8000`. Env: `BACKEND_URL` |
| `--access-token TOKEN` | No | Static backend token. Env: `ACCESS_TOKEN` |
| `--host HOST` | No | Bind address. Default: `0.0.0.0`. Env: `HOST` |
| `--port PORT` | No | Listen port. Default: `8080`. Env: `PORT` |
| `--verify-signatures` | No | Validate `X-Twilio-Signature` on every request (recommended in production) |

Endpoint: `POST /sms` (register this URL in Twilio → Phone Numbers → Webhooks)

```bash
python -m channels.run twilio AC... token... +15551234567
python -m channels.run twilio AC... token... +15551234567 \
  --verify-signatures --backend-url http://my-server:8000
```

---

### GitHub

Runs a **FastAPI webhook server**. GitHub POSTs `issue_comment` events to `/webhook`. Users control OpenJiuwen by commenting slash commands on issues and PRs. Requires a public HTTPS URL.

```bash
python -m channels.run github <GITHUB_TOKEN> [OPTIONS]
```

| Argument / Option | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | Yes | GitHub Personal Access Token with `repo` scope. Env: `GITHUB_TOKEN` |
| `--webhook-secret SECRET` | No | HMAC secret from GitHub webhook settings. Env: `GITHUB_WEBHOOK_SECRET` |
| `--backend-url URL` | No | OpenJiuwen backend URL. Default: `http://localhost:8000`. Env: `BACKEND_URL` |
| `--access-token TOKEN` | No | Static backend token. Env: `ACCESS_TOKEN` |
| `--host HOST` | No | Bind address. Default: `0.0.0.0`. Env: `HOST` |
| `--port PORT` | No | Listen port. Default: `8080`. Env: `PORT` |

Endpoint: `POST /webhook` (register in GitHub → Repo Settings → Webhooks, event: Issue comments)

```bash
python -m channels.run github ghp_...
python -m channels.run github ghp_... --webhook-secret mysecret --backend-url http://my-server:8000
```

---

### Facebook Messenger

Runs an **aiohttp webhook server**. Meta POSTs incoming Messenger messages to `POST /webhook`. Uses only stdlib — no Meta SDK needed.

```bash
python -m channels.run messenger <PAGE_ACCESS_TOKEN> [OPTIONS]
```

| Argument | Required | Description |
|---|---|---|
| `PAGE_ACCESS_TOKEN` | Yes | Meta Page Access Token (from Meta Developer Portal → Messenger → Token Generation) |
| `--verify-token` | No | Webhook verification token (default: `openjiuwen_verify`, env: `MESSENGER_VERIFY_TOKEN`) |

Endpoint: `GET /webhook` + `POST /webhook` (register in Meta Developer Portal → Webhooks, subscribe to `messages`)

```bash
python -m channels.run messenger EAABwzLixnjYBO...
python -m channels.run messenger EAABwzLixnjYBO... \
  --verify-token my_secret --backend-url http://my-server:8000
```

---

### WeChat Official Account

Runs an **aiohttp webhook server**. WeChat sends XML messages to `POST /webhook`. Replies are sent synchronously as XML. Uses only stdlib — no WeChat SDK needed.

```bash
python -m channels.run wechat <WECHAT_TOKEN> <APP_ID> <APP_SECRET> [OPTIONS]
```

| Argument | Required | Description |
|---|---|---|
| `WECHAT_TOKEN` | Yes | Verification token set in WeChat Official Account developer settings |
| `APP_ID` | Yes | WeChat AppID (from Official Account settings) |
| `APP_SECRET` | Yes | WeChat AppSecret (from Official Account settings) |

Endpoint: `GET /webhook` (verify) + `POST /webhook` (messages) — register in WeChat Official Account → Development → Server Configuration

```bash
python -m channels.run wechat my_token wx1234567890 secret1234
python -m channels.run wechat my_token wx1234567890 secret1234 \
  --backend-url http://my-server:8000
```

---

### Amazon Alexa

Runs a **FastAPI fulfillment webhook**. Alexa sends intents to `POST /`. Responses are automatically stripped of markdown for clean TTS.

```bash
python -m channels.run alexa [OPTIONS]
```

| Option | Description |
|---|---|
| `--skill-id ID` | Optional: restrict to requests from this Alexa Skill ID (env: `ALEXA_SKILL_ID`) |
| `--host HOST` | Bind address (default: `0.0.0.0`, env: `ALEXA_HOST`) |
| `--port PORT` | Listen port (default: `8080`, env: `ALEXA_PORT`) |

Endpoint: `POST /` (register in Alexa Developer Console → Build → Endpoint → HTTPS)

```bash
python -m channels.run alexa
python -m channels.run alexa --skill-id amzn1.ask.skill.xxx --backend-url http://my-server:8000
```

---

See each platform's `SETUP.md` for prerequisites and full setup instructions.

---

## Further Reading

| Document | What's in it |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Internals: client/ layer, adapter structure, auth flows, SSE streaming, adding a new platform |
| [HOW_IT_WORKS.md](HOW_IT_WORKS.md) | End-to-end flow: from user message to OpenJiuwen backend and back |
