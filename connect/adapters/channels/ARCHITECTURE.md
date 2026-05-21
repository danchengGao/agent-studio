# Channels — Architecture

**Version:** 1.0
**Scope:** Internal architecture of the `channels/` system

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Supported Platforms](#2-supported-platforms)
3. [Architecture Principles](#3-architecture-principles)
4. [Folder Structure](#4-folder-structure)
5. [Client Layer](#5-client-layer)
6. [Platform Adapters](#6-platform-adapters)
7. [Authentication & Session Model](#7-authentication--session-model)
8. [Workflow Execution Flow](#8-workflow-execution-flow)
9. [Agent Execution Flow](#9-agent-execution-flow)
10. [Adding a New Platform](#10-adding-a-new-platform)
11. [Configuration Reference](#11-configuration-reference)
12. [Security Considerations](#12-security-considerations)

---

## 1. System Overview

From the outside, the experience is called OpenJiuwen Anywhere — the idea that OpenJiuwen is available wherever you already are.
Behind the scenes, this is powered by an internal system called channels. At the highest level, channels sits between two things: the user's platform (Slack, Telegram, etc.) and the OpenJiuwen backend.

```
┌──────────────────────────────────────────────────────────────────┐
│                        User's World                              │
│                                                                  │
│  Slack  Telegram  Teams  WhatsApp  Discord  CLI  HTTP  Email  GA  │
└────────────────────────────┬─────────────────────────────────────┘
                             │  message / command / HTTP request
                             ▼
┌───────────────────────────────────────────────────────────────────┐
│                    channels/ (this system)                        │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐      │
│  │  platforms/                                             │      │
│  │  Thin adapters — translate platform events into         │      │
│  │  client/ function calls, format responses back          │      │
│  └──────────────────────────┬──────────────────────────────┘      │
│                             │                                     │
│  ┌──────────────────────────▼──────────────────────────────┐      │
│  │  client/                                                │      │
│  │  All business logic: auth, token management,            │      │
│  │  workflow execution, agent execution, parsing           │      │
│  └──────────────────────────┬──────────────────────────────┘      │
└───────────────────────────────────────────────────────────────────┘
                             │  HTTP + SSE
                             ▼
┌───────────────────────────────────────────────────────────────────┐
│                  OpenJiuwen Backend (API)                         │
│                                                                   │
│  /auth  /workflows  /agents  /execution/workflow  /execution/agent│
└───────────────────────────────────────────────────────────────────┘
```

Each platform adapter:
1. Receives a message or command from the user
2. Extracts user ID and intent
3. Calls the relevant `client/` function
4. Formats the result and sends it back to the user

All backend communication happens through `client/` — no adapter talks to the OpenJiuwen backend directly.

---

## 2. Supported Platforms

### Production-Ready Platforms

These platforms are stable, tested, and ready for production use:

| Platform | Mechanism | Connection type | Per-user auth | Notes |
|---|---|---|---|---|
| **CLI** | argparse | stdin/stdout | Yes | Great for scripting and CI/CD |
| **Email** | IMAP polling + SMTP | Polling loop | Yes | Stdlib only; no extra dependencies |
| **Webhook** | FastAPI | HTTP | Flexible | Stateless; integrates with any system |
| **Telegram** | Bot API | Long polling | Yes | Full feature set; richest command coverage |
| **Slack** | Bolt + Socket Mode | WebSocket (outbound only) | Yes | No public URL needed |

### Experimental Platforms

These platforms are functional but still under development. They may have rough edges or incomplete features:

| Platform | Mechanism | Connection type | Per-user auth | Notes |
|---|---|---|---|---|
| **WeChat** | WeChat Open Platform | Webhook (inbound) | Yes | XML protocol; synchronous reply + Customer Service API |
| **Discord** | discord.py | WebSocket gateway | Yes | Native slash commands |
| **WhatsApp** | Meta Business API | Webhook (inbound) | Static token | Requires public URL + Meta verification |
| **Microsoft Teams** | Bot Framework | Webhook (inbound) | Shared (Azure) | Azure app registration required |
| **Facebook Messenger** | Meta Graph API | Webhook (inbound) | Yes | Stdlib only; PSID as user_id; no markdown |
| **GitHub** | GitHub REST API | Webhook (inbound) | Yes | Slash commands in issue/PR comments |
| **Google Assistant** | Actions SDK v3 | Webhook (inbound) | Shared | 10 s response timeout; voice-friendly |
| **Twilio SMS** | Twilio REST API | Webhook (inbound) | Yes | Stdlib only; 1600-char SMS limit |
| **Amazon Alexa** | Alexa Skills Kit | Webhook (inbound) | Shared | Voice-friendly; no markdown; 8 s timeout |

---

## 3. Architecture Principles

### 3.1 Strict Separation: Client vs. Platform

`client/` contains **zero platform-specific imports**. No Telegram, no Slack, no Discord references anywhere in client.

This means:
- Client logic is testable without any bot framework
- A new platform can be added without touching client
- Bugs in business logic (e.g. token refresh) are fixed once and work everywhere

### 3.2 Thin Adapters

Each platform adapter does exactly three things per handler:
1. **Extract** — pull user ID, command, and arguments from the platform's event format
2. **Call** — invoke the relevant `client/` function
3. **Reply** — format and send the result back through the platform's API

Adapters do not contain business logic. They are I/O translators.

### 3.3 Platform-Agnostic Parameter Collection

Multi-step workflow parameter collection (ask user for each input, one at a time) is implemented once in `client/workflows/param_collector.py` as a state machine (`ParamCollectionSession`). Every platform that supports interactive conversations uses the same class — only the storage location and the "send a message" mechanism differ.

### 3.4 Single Entry Point

All platforms are launched through a single entry point:

```bash
python -m channels.run <platform> [args...]
```

`run.py` dynamically imports `channels.platforms.<platform>.launcher` and calls `main()`. This makes it straightforward to add new platforms without changing the top-level interface.

### 3.5 Flexible Auth Modes

The system supports three authentication modes, and platforms can use any of them:
- **Per-user login** — each user authenticates individually (Telegram, Slack, Discord, CLI)
- **Shared static token** — all users share one backend token (useful for team-internal Webhook deployments)
- **Per-request token** — caller supplies token with each request (Webhook adapter)

---

## 4. Folder Structure

```
channels/
├── run.py                          ← Universal entry point; dispatches by platform name
├── requirements.txt
│
├── client/                         ← Platform-agnostic business logic
│   ├── client.py                   ← HTTP client wrapper for the OpenJiuwen backend
│   ├── config.py                   ← Reads VITE_ENABLE_NEW_AUTH from .env
│   ├── platform_state.py           ← PlatformState class — shared per-user state used by all platforms
│   ├── auth/
│   │   ├── do_login.py             ← Orchestrates username/password → token exchange
│   │   ├── login.py                ← POST /auth/login
│   │   ├── verify_token.py         ← GET  /auth/verify_access_token
│   │   ├── refresh_token.py        ← POST /auth/refresh
│   │   ├── get_spaces.py           ← GET  /spaces/
│   │   ├── token_manager.py        ← verify_and_refresh() — silent token renewal logic
│   │   └── token_storage/          ← JSON file-based per-user token persistence
│   ├── workflows/
│   │   ├── list_workflows.py
│   │   ├── search_workflows.py
│   │   ├── get_workflow.py
│   │   ├── execute_workflow.py     ← Streams SSE from backend
│   │   ├── result_parser.py        ← Extracts outputs from SSE event stream
│   │   └── param_collector.py      ← ParamCollectionSession state machine
│   ├── agents/
│   │   ├── list_agents.py
│   │   ├── search_agents.py
│   │   ├── execute_agent.py        ← Streams SSE from backend
│   │   └── response_parser.py      ← Extracts text + conversation_id from SSE
│   └── general/
│       └── health_check.py
│
└── platforms/
    ├── base.py                     ← Developer checklist for adding a new platform
    │
    ├── Production-ready platforms:
    ├── cli/                        ← Terminal interface (argparse)
    ├── email/                      ← IMAP polling + SMTP replies (stdlib only)
    ├── telegram/                   ← Telegram bot (long polling)
    ├── slack/                      ← Slack app (Socket Mode)
    ├── webhook/                    ← FastAPI REST adapter (stateless HTTP)
    │
    └── experimental/               ← Experimental platforms (functional but under development)
        ├── wechat/                 ← WeChat Official Account bot (XML webhook)
        ├── discord/                ← Discord bot (WebSocket gateway)
        ├── whatsapp/               ← WhatsApp Business API webhook
        ├── teams/                  ← Microsoft Teams bot (Bot Framework)
        ├── messenger/              ← Facebook Messenger bot (Meta Graph API webhook)
        ├── github/                 ← Slash commands in GitHub issue/PR comments
        ├── google_assistant/       ← Google Actions SDK v3 fulfillment webhook
        ├── twilio/                 ← SMS via Twilio REST API (aiohttp webhook)
        └── alexa/                  ← Amazon Alexa skill fulfillment webhook
```

Each `platforms/<name>/` and `platforms/experimental/<name>/` follows the same internal structure (described in §6).

---

## 5. Client Layer

### 5.1 OpenJiuwenClient (`client/client.py`)

The single HTTP wrapper used everywhere. It holds:
- `base_url` — the backend URL
- `token` — current access token (set after login or refresh)
- `space_id` — the user's active space (required by most API calls)

All adapters create an `OpenJiuwenClient` instance per user (or share one in static-token mode). Client functions receive a client instance as their first argument — they never manage the client lifecycle themselves.

### 5.2 Authentication (`client/auth/`)

**Login flow:**

```
do_login(client, username, password)
    ├── login(client, username, password)       → POST /auth/login → access_token
    ├── get_spaces(client)                      → GET  /spaces/    → space list
    └── returns {token, space_id, refresh_token}
```

After login, the caller saves these three values to token storage (keyed by user ID).

**Token renewal flow (`token_manager.verify_and_refresh`):**

```
verify_token(client)
    ├── OK             → return (True, None)         ← token still valid
    ├── HTTP 401       → try refresh_token(client)
    │       ├── success  → return (True, new_token)  ← caller must save new token
    │       └── fail     → return (False, None)      ← force re-login
    └── other error    → return (True, None)          ← optimistic: don't force logout
```

The "optimistic" handling of non-401 errors is intentional: network hiccups and 5xx backend errors should not log users out. Only a confirmed 401 triggers a refresh attempt.

### 5.3 Token Storage (`client/auth/token_storage/`)

Tokens are persisted in a JSON file, one entry per user. The file path is set by each launcher via the `OJ_TOKEN_STORAGE` environment variable before any imports run.

Default paths per platform:

**Production-ready platforms:**
- `platforms/cli/.cli_tokens.json`
- `platforms/email/.email_tokens.json`
- `platforms/experimental/telegram/.telegram_bot_tokens.json`
- `platforms/experimental/slack/.slack_bot_tokens.json`
- (Webhook: no persistent token storage — tokens passed per request)

**Experimental platforms:**
- `platforms/experimental/wechat/.wechat_tokens.json`
- `platforms/experimental/discord/.discord_bot_tokens.json`
- `platforms/experimental/whatsapp/.whatsapp_bot_tokens.json`
- `platforms/experimental/teams/.teams_bot_tokens.json`
- `platforms/experimental/messenger/.messenger_tokens.json`
- `platforms/experimental/github/.github_tokens.json`
- `platforms/experimental/google_assistant/.google_assistant_tokens.json`
- `platforms/experimental/twilio/.twilio_tokens.json`
- `platforms/experimental/alexa/.alexa_tokens.json`

Structure:
```json
{
  "<user_id>": {
    "token":         "eyJhbGci...",
    "space_id":      "space_abc",
    "refresh_token": "eyJhbGci..."
  }
}
```

The user ID is platform-specific (Telegram chat ID, Slack user ID, OS username for CLI, etc.). All token storage functions are pure read/write — no platform logic.

### 5.4 Workflow Execution (`client/workflows/`)

**Execution** calls `POST /execution/workflow` and streams the response as Server-Sent Events (SSE). The stream is consumed synchronously, collecting all events into a list. Once the stream ends, `result_parser.py` inspects the events to find the final outputs or error message.

**Parameter Collection (`ParamCollectionSession`)** is a state machine for multi-turn input gathering:

```
State: list of pending parameters (in order)
         ↓
prompt_next()  → format a message asking for the next parameter
         ↓
submit(text)   → validate type, store value, advance to next param
  or
skip()         → skip if optional, reject if required
         ↓
[all params answered]
  → get_collected() → dict of {param_name: value}
  → execute the workflow
```

The session object is serializable and can be stored in any platform's per-user context (Telegram's `context.user_data`, Slack's state dict, etc.).

### 5.5 Agent Execution (`client/agents/`)

**Execution** calls `POST /execution/agent` with the user's message and an optional `conversation_id`. The SSE stream is consumed and parsed by `response_parser.py`, which:
- Extracts the latest `conversation_id` (needed to continue the thread)
- Finds the final answer text
- Returns `(text, conversation_id, error)`

The returned `conversation_id` must be stored by the platform adapter and passed in the next call to continue the conversation thread.

### 5.6 SSE Streaming

Both workflow and agent execution use the same streaming pattern:

```
POST to /execution endpoint with stream=True
    ↓
Read response line by line
    ↓
Lines starting with "data:" → parse as JSON → append to event list
    ↓
Stream ends (or timeout at 120s) → return event list
    ↓
Parser inspects events for outputs / errors
```

Streaming happens synchronously inside the HTTP call. Real-time token-by-token streaming to the chat platform is not implemented — the full response is collected first, then sent.

---

## 6. Platform Adapters

### 6.1 Common Internal Structure

Every platform adapter follows the same layout:

```
platforms/<name>/
├── launcher.py                 ← Framework init, handler registration, event loop start
├── client_session.py           ← Auth helper (get or validate backend client per user)
├── handlers_registrator.py     ← Top-level registration, calls submodule registrators
├── state.py                    ← Per-user in-memory state (platforms that need it)
├── auth/
│   ├── commands.py             ← Command name constants (LOGIN, LOGOUT, STATUS, CANCEL)
│   ├── handlers_registrator.py
│   └── handlers/               ← login_start, login_password, logout, status, cancel
├── agents/
│   ├── commands.py
│   ├── handlers_registrator.py
│   └── handlers/               ← agents_list, agents_search, agent_execute,
│                                   agent_chat_start, agent_chat_message, agent_chat_end
├── workflows/
│   ├── commands.py
│   ├── handlers_registrator.py
│   └── handlers/               ← workflows_list, workflows_search, workflow_execute,
│                                   workflow_execute_collect, workflow_execute_cancel
└── general/
    ├── handlers_registrator.py
    └── handlers/               ← health, help/start
```

### 6.2 Telegram

**Framework:** `python-telegram-bot` v20+
**Connection:** Long polling (bot connects out to Telegram; no inbound port needed)
**Auth model:** Per-user; `@require_login` decorator on every protected handler

Multi-turn flows (login sequence, workflow parameter collection) are implemented using `ConversationHandler`, which keeps the user in a specific state until the flow completes or is cancelled.

The `@require_login` decorator:
1. Checks for a stored token
2. Creates a per-user `OpenJiuwenClient` stored in `context.user_data`
3. Acquires a per-user async lock (prevents token refresh race conditions)
4. Calls `verify_and_refresh()` before every handler invocation
5. Saves any new token issued during refresh

### 6.3 Slack

**Framework:** `slack-bolt`
**Connection:** Socket Mode (WebSocket to Slack; no public URL needed)
**Auth model:** Per-user; `get_backend_client(user_id, respond)` called at the top of each handler

Slack handlers receive dependency-injected arguments (`ack`, `respond`, `command`, `body`). Every slash command handler calls `ack()` immediately (Slack requires a response within 3 seconds), then performs the actual work and calls `respond()` with the result.

Per-user state (login flow state, workflow collection session) is stored in a module-level dict in `state.py`, keyed by Slack user ID.

### 6.4 Discord

**Framework:** `discord.py` v2+
**Connection:** WebSocket gateway (persistent connection to Discord)
**Auth model:** Per-user; `get_backend_client(user_id)` returns `(client, error)` tuple

Commands are registered as slash commands using Discord's application command tree (`bot.tree.command()`). On startup, the tree is synced with Discord's servers. Handlers are async and use `interaction.followup.send()` to reply (after deferring with `interaction.response.defer()` for long operations).

### 6.5 WhatsApp

**Framework:** `aiohttp` HTTP server
**Connection:** Meta webhook (Meta POSTs inbound messages to a public URL)
**Auth model:** Static token; no per-user login

WhatsApp does not support interactive bot-style sessions in the same way as Telegram/Slack. The adapter receives webhook payloads from Meta, extracts the sender's phone number and message text, dispatches to command handlers, and sends replies via the WhatsApp Business API (`graph.facebook.com`).

Meta requires a webhook verification step (GET request with a challenge) before messages flow.

### 6.6 Microsoft Teams

**Framework:** `botbuilder-core` (Microsoft Bot Framework)
**Connection:** Azure webhook (Teams POSTs inbound messages to a public URL)
**Auth model:** Shared Azure app identity; no per-user login stored locally

The adapter registers an `OJTeamsBot` class with a single `on_turn()` method. The Bot Framework adapter handles the Azure OAuth token validation on every inbound request. `on_turn()` extracts the user's AAD object ID and message text, then dispatches to command handlers.

### 6.7 Webhook

**Framework:** FastAPI + uvicorn
**Connection:** Stateless HTTP server
**Auth model:** Flexible (per-request token in body/header, or static server token)

The Webhook adapter exposes a REST API that any external system can call:

```
GET  /health
POST /agents/list
POST /agents/search
POST /agents/execute
POST /workflows/list
POST /workflows/search
POST /workflows/execute
GET  /docs          ← auto-generated OpenAPI docs
```

Every request is self-contained: the caller provides the backend token (or the server uses a configured static token). There is no session state. This makes the webhook adapter the most versatile channel — it can be called from Zapier, n8n, GitHub Actions, cron jobs, or any HTTP client.

An optional `WEBHOOK_API_KEY` can be configured to restrict who can call the adapter.

### 6.8 CLI

**Framework:** `argparse`
**Connection:** stdin/stdout
**Auth model:** Per-user; token stored in `platforms/cli/.cli_tokens.json` keyed by OS username

The CLI exposes a hierarchical command structure:

```
channels.run cli login
channels.run cli logout
channels.run cli status
channels.run cli workflow list
channels.run cli workflow search <keyword>
channels.run cli workflow execute <workflow_id>
channels.run cli agent list
channels.run cli agent search <keyword>
channels.run cli agent execute <agent_id> <message>
channels.run cli agent chat <agent_id>
```

For workflow execution, the CLI prompts for each parameter interactively using the same `ParamCollectionSession` as the chat platforms. This makes it suitable for scripting (non-interactive mode) and for manual exploration (interactive mode).

### 6.9 Email

**Framework:** stdlib (`imaplib`, `smtplib`, `email`)
**Connection:** IMAP polling loop (bot connects out to IMAP server; no inbound port needed)
**Auth model:** Per-user; token stored keyed by sender email address

The email adapter polls an IMAP inbox every N seconds (configurable, default 10 s) for `UNSEEN` messages. For each unread email, it:
1. Decodes the RFC 2047 subject and body
2. Strips quoted reply text (lines starting with `>`, `On ... wrote:`, `-----Original Message-----`)
3. Extracts the first non-empty, non-quoted line as the command
4. Dispatches to command handlers (same handler pipeline as other platforms)
5. Replies via SMTP, threading the reply using `In-Reply-To` and `References` headers

Because IMAP/SMTP are blocking calls, the polling loop runs in a plain `asyncio` loop using `asyncio.run()`. Long-running workflow or agent executions block the poll iteration for their duration.

Responses are plain text (no markdown) since email clients render `*bold*` and `_italic_` literally.

The user ID is the sender's email address, enabling per-user token storage across multiple correspondents.

### 6.10 Google Assistant

**Framework:** FastAPI + uvicorn
**Connection:** Webhook (Google POSTs to `/fulfillment` on every user turn)
**Auth model:** Per-session; token stored keyed by Google session ID

Google Assistant (Actions SDK v3) calls the fulfillment webhook with a JSON payload containing:
- `handler.name` — the scene/intent handler name
- `intent.query` — the user's raw speech/text input
- `session.id` — unique ID for the current conversation session

The adapter treats `session.id` as the user ID. Multi-turn state (login flow, parameter collection, agent chat) persists in memory for the duration of the Google session.

Responses must be spoken aloud, so all handlers produce natural language text without markdown formatting. The response is wrapped in the Actions SDK v3 format:

```json
{
  "session": {"id": "..."},
  "prompt": {
    "firstSimple": {"speech": "...", "text": "..."}
  }
}
```

**10-second timeout:** Google enforces a hard response deadline. Long-running workflows or agent calls that exceed 10 s will result in a timeout error on the Google side.

An optional `GA_API_KEY` can be configured to restrict which clients can call the `/fulfillment` endpoint, since the endpoint must be publicly accessible.

### 6.11 Twilio SMS

**Framework:** stdlib (`urllib`) + `aiohttp` HTTP server
**Connection:** Webhook (Twilio POSTs inbound SMS to `/sms`)
**Auth model:** Per-user; token stored keyed by sender phone number

The Twilio adapter is structurally identical to WhatsApp — both are inbound webhooks from a platform-specific messaging service. The key differences:

- **No SDK required**: SMS sending uses the Twilio REST API via `urllib` directly (`POST /Accounts/{SID}/Messages`)
- **Reply format**: `send_sms()` truncates responses to 1600 characters (Twilio's 10-segment limit)
- **Webhook response**: returns an empty `<Response/>` TwiML immediately; the actual reply is sent asynchronously via the REST API
- **Signature verification**: `X-Twilio-Signature` HMAC validation is optional but recommended in production (`--verify-signatures` flag)
- **User ID**: the sender's phone number in E.164 format (e.g. `+15551234567`)
- **No markdown**: SMS clients display raw text; `strip_markdown()` removes formatting before sending

### 6.12 GitHub

**Framework:** FastAPI + uvicorn
**Connection:** Webhook (GitHub POSTs `issue_comment` events to `/webhook`)
**Auth model:** Per-user; token stored keyed by GitHub username

The GitHub adapter is event-driven rather than conversational. GitHub sends a webhook payload whenever a new issue or PR comment is created. The adapter:

1. Verifies the `X-Hub-Signature-256` HMAC header using the configured webhook secret
2. Ignores all event types except `issue_comment` (action: `created`) and skips bot senders
3. Scans the comment body for the first line starting with `/` — this is the command
4. Dispatches to the command handler pipeline (identical to other platforms)
5. Posts the result back as a new GitHub comment via the REST API

The `say()` closure is bound per event to the correct `(repo_full_name, issue_number)` pair, so replies always appear in the right thread.

**Multi-turn state** (parameter collection, agent chat) persists across comments in the same session, keyed by GitHub username. Multiple users can run independent workflows on the same issue simultaneously.

**Markdown-aware responses**: GitHub renders Markdown in comments, so responses use `**bold**`, `` `code` ``, and tables where appropriate (unlike email and SMS which strip formatting).

---

### 6.13 Facebook Messenger

**Framework:** aiohttp (inbound webhook)
**Connection:** Webhook (Meta POSTs events to `POST /webhook`, verifies via `GET /webhook`)
**Auth model:** Per-user; token stored keyed by Page-Scoped ID (PSID)

The Messenger adapter is structurally identical to WhatsApp — both are inbound webhooks from the Meta Graph API. The key differences:

- **Single token**: Only a `PAGE_ACCESS_TOKEN` is needed (no `phone_number_id`)
- **User ID**: Page-Scoped ID (`sender.id` in the payload) instead of phone number
- **Payload structure**: `entry[].messaging[]` instead of `entry[].changes[].value.messages[]`
- **Echo filtering**: Messages with `is_echo: true` are ignored (they are sent by the page itself)
- **No SDK required**: Replies sent via `urllib` to `graph.facebook.com/v18.0/me/messages`
- **Message limit**: 2000 characters (truncated with `...`)

The verification handshake (`GET /webhook`) matches `hub.mode == 'subscribe'` and compares `hub.verify_token` against the configured `--verify-token` arg.

---

### 6.14 WeChat Official Account

**Framework:** aiohttp (inbound webhook)
**Connection:** Webhook (WeChat POSTs XML to `POST /webhook`, verifies via `GET /webhook`)
**Auth model:** Per-user; token stored keyed by OpenID

WeChat uses a completely different protocol from all other adapters:

- **XML protocol**: All inbound messages and outbound replies are XML (not JSON)
- **Signature verification**: SHA1 of `sorted([token, timestamp, nonce])` joined — WeChat's own scheme
- **Synchronous reply model**: WeChat expects an XML response body within 5 seconds. The first `say()` call is embedded in the HTTP response as `<xml>...<Content>...</Content>...</xml>`. Any additional replies use the Customer Service Messages API (requires AppID + AppSecret → access_token)
- **Access token caching**: `get_access_token()` caches the token in-process with a 60-second pre-expiry buffer; refreshes automatically from `api.weixin.qq.com/cgi-bin/token`
- **No SDK required**: All HTTP calls use `urllib`; XML parsing uses `xml.etree.ElementTree`
- **User ID**: OpenID (`<FromUserName>` in the XML payload)

The `say()` closure in the launcher captures the first reply synchronously, then routes additional replies via `asyncio.get_event_loop().run_in_executor()` to avoid blocking the event loop.

---

### 6.15 Amazon Alexa

**Framework:** FastAPI (inbound fulfillment webhook)
**Connection:** Webhook (Alexa POSTs skill requests to `POST /`)
**Auth model:** Per-user; token stored keyed by `session.user.userId` (persistent across sessions)

The Alexa adapter mirrors Google Assistant in structure. Key differences:

- **Pydantic models**: `AlexaSkillRequest` parses the three Alexa request types: `LaunchRequest`, `IntentRequest`, `SessionEndedRequest`
- **Command extraction**: `extract_command()` reads the `Command` slot from `CommandIntent` (slot type `AMAZON.SearchQuery`)
- **Built-in intents**: `AMAZON.StopIntent`/`AMAZON.CancelIntent` return `shouldEndSession: true`; `AMAZON.HelpIntent` returns a brief spoken summary
- **Multi-turn**: `shouldEndSession: false` keeps the session alive between turns
- **Voice-friendly**: `_strip_markdown()` removes `**bold**`, `_italic_`, `#headers`, `[link](url)` before sending to TTS
- **User ID persistence**: `session.user.userId` is stable across sessions (unlike `session.sessionId` which changes per conversation)
- **No SDK required**: Standard FastAPI JSON responses; no `ask-sdk` dependency

---

## 7. Authentication & Session Model

### 7.1 Login Flow (interactive platforms)

```
User: /login
    ↓
Platform sends: "Please enter your username"
    ↓
User: michael@company.com
    ↓
[if password mode enabled]
Platform sends: "Please enter your password"
User: ••••••••
    ↓
client.auth.do_login(client, username, password)
    → POST /auth/login           → access_token
    → GET  /spaces/              → space_id
    ↓
set_user_data(user_id, token, space_id, refresh_token)
    ↓
Platform sends: "✅ Logged in successfully"
```

### 7.2 Token Lifecycle

```
┌──────────────────────────────────────────────────────────────┐
│  Every protected handler call:                               │
│                                                              │
│  1. Load token from storage                                  │
│  2. verify_and_refresh(client, user_id, refresh_token)       │
│       ├── token valid           → proceed                    │
│       ├── 401 + refresh OK      → save new token, proceed    │
│       ├── 401 + no refresh      → "Session expired, /login"  │
│       └── other error           → proceed (optimistic)       │
│  3. Call client.* function                                   │
│  4. Return result to user                                    │
└──────────────────────────────────────────────────────────────┘
```

### 7.3 Per-User State

Chat platforms (Telegram, Slack, Discord, Email, Google Assistant) maintain per-user state dictionaries:
- Current login flow step (waiting for username, waiting for password)
- Active `ParamCollectionSession` for workflow execution
- Active agent chat session (agent ID + conversation ID)

State is held in memory (lost on restart). Token storage (authentication) is persisted to disk and survives restarts.

**`PlatformState` — shared implementation (`client/platform_state.py`)**

All platforms that need per-user state instantiate a `PlatformState` object in their `state.py` module:

```python
# platforms/<name>/state.py
from ..client.platform_state import PlatformState as _PlatformState
_state = _PlatformState()
get_user_data  = _state.get_user_data
set_app_config = _state.set_app_config
get_app_config = _state.get_app_config
```

Each platform has its own `_state` instance, so their user-data dicts are completely independent. The public API (`get_user_data`, `set_app_config`, `get_app_config`) is identical across all platforms — handlers can be moved or copied between platforms without changes.

---

## 8. Workflow Execution Flow

```
User: /workflow_execute <workflow_id>
    ↓
client.workflows.get_workflow(client, workflow_id)
    → returns workflow definition including input_parameters list
    ↓
┌── No input parameters ────────────────────────────────────────┐
│   client.workflows.execute_workflow(client, workflow_id, {})  │
│   client.workflows.result_parser.parse_workflow_result(events)│
│   Platform sends: result text                                 │
└───────────────────────────────────────────────────────────────┘

┌── Has input parameters ───────────────────────────────────────┐
│   ParamCollectionSession(workflow_id, params)                 │
│   Platform sends: "Enter value for <param_1> (<type>):"       │
│                                                               │
│   [loop for each parameter]                                   │
│   User types a value (or /workflow_skip for optional param)   │
│   session.submit(text) or session.skip()                      │
│       → validates type (string, int, float, bool)             │
│       → if required + skip attempted: sends error             │
│       → if all done: break loop                               │
│       → else: sends next prompt                               │
│                                                               │
│   client.workflows.execute_workflow(client, id, collected)    │
│   client.workflows.result_parser.parse_workflow_result(events)│
│   Platform sends: result text                                 │
└───────────────────────────────────────────────────────────────┘

User: /workflow_cancel (at any point during collection)
    → session cleaned up
    → Platform sends: "❌ Workflow cancelled"
```

---

## 9. Agent Execution Flow

### Single execution

```
User: /agent_execute <agent_id> Hello, summarize this week's news
    ↓
client.agents.execute_agent(client, agent_id, message, conversation_id="")
    → SSE stream from /execution/agent
    ↓
client.agents.response_parser.parse_agent_response(events)
    → extracts (text, conversation_id, error)
    ↓
Platform sends: text response
```

### Multi-turn chat session

```
User: /agent_start_chat <agent_id>
    ↓
Platform stores: {agent_id, conversation_id: ""}
Platform sends: "✅ Chat started. Every message will go to this agent."

User: <any free text message>
    ↓
execute_agent(client, agent_id, text, stored_conversation_id)
    ↓
parse_agent_response(events)
    → new conversation_id (links this reply to the thread)
    ↓
Platform updates stored conversation_id
Platform sends: agent reply

[continues until...]

User: /agent_end_chat
    ↓
Platform clears stored session
Platform sends: "Chat ended."
```

The `conversation_id` is what links messages into a thread on the backend. It is extracted from the SSE response events on every turn and must be stored and re-sent on the next call.

---

## 10. Adding a New Platform

The `platforms/base.py` file contains the canonical checklist. At a high level:

**Step 1 — Launcher**
Create `platforms/<name>/launcher.py`. Parse CLI args or env vars. Set `OJ_TOKEN_STORAGE` before any imports from `client/`. Initialize the platform framework. Call `register_handlers()`. Start the event loop. Register the platform in `run.py`.

**Step 2 — Auth helper**
Create `platforms/<name>/client_session.py`. Implement the auth pattern that fits the platform:
- Decorator (`@require_login`) for frameworks with per-call handler decoration (e.g. async bot frameworks)
- Function (`get_backend_client(user_id, ...)`) returning a client or None for simpler cases
- Direct calls for stateless platforms (Webhook, CLI)

In all cases, use `get_user_token()`, `verify_and_refresh()`, and `set_user_data()` from `client/auth/`.

**Step 3 — State**
If the platform supports multi-turn conversations, create `platforms/<name>/state.py` — a module-level dict keyed by user ID. Store login flow state, `ParamCollectionSession`, and agent chat session here.

**Step 4 — Handlers**
Create the standard subdirectory structure (`auth/`, `agents/`, `workflows/`, `general/`). For each handler:
1. Extract `user_id` and command arguments from the platform event
2. Call `get_backend_client()` / use `@require_login`
3. Call the relevant `client.*` function
4. Format and send the response using the platform's messaging API

**Step 5 — Registration**
Wire up all handlers in `handlers_registrator.py` files using whatever mechanism the platform provides (command registration, route registration, event listeners, etc.).

---

## 11. Configuration Reference

### Universal

| Variable | Description | Default |
|---|---|---|
| `BACKEND_URL` | OpenJiuwen backend base URL | `http://localhost:8000` |
| `ACCESS_TOKEN` | Shared static backend token (skips per-user login) | _(none)_ |
| `VITE_ENABLE_NEW_AUTH` | Enable password-based login | `False` |
| `OJ_TOKEN_STORAGE` | Override token file path (set by launcher) | Platform-specific |

### Telegram
```bash
python -m channels.run telegram <BOT_TOKEN> [BACKEND_URL] [ACCESS_TOKEN]
```

### Slack
```bash
SLACK_BOT_TOKEN=xoxb-... SLACK_APP_TOKEN=xapp-... \
python -m channels.run slack [BACKEND_URL] [ACCESS_TOKEN]
```

### Discord
```bash
python -m channels.run discord <BOT_TOKEN> [BACKEND_URL] [ACCESS_TOKEN]
```

### WhatsApp
```bash
WHATSAPP_ACCESS_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=... \
WHATSAPP_VERIFY_TOKEN=my_secret \
python -m channels.run whatsapp [BACKEND_URL] [ACCESS_TOKEN]
```

### Teams
```bash
python -m channels.run teams <APP_ID> <APP_PASSWORD> [BACKEND_URL]
```

### Webhook
```bash
python -m channels.run webhook \
  --backend-url http://localhost:8000 \
  --token <optional_static_token> \
  --api-key <optional_server_key> \
  --host 0.0.0.0 --port 8080
```

### CLI
```bash
python -m channels.run cli login [--backend-url http://localhost:8000]
python -m channels.run cli workflow execute <id>
python -m channels.run cli agent execute <id> "message"
```

### Email
```bash
python -m channels.run email <IMAP_HOST> <SMTP_HOST> <EMAIL_ADDRESS> <PASSWORD> \
  [--imap-port 993] [--smtp-port 587] \
  [--backend-url http://localhost:8000] \
  [--access-token TOKEN] \
  [--poll-interval 10]
```

### Google Assistant
```bash
python -m channels.run google_assistant \
  [--host 0.0.0.0] [--port 8080] \
  [--backend-url http://localhost:8000] \
  [--access-token TOKEN] \
  [--api-key KEY]
```

### Twilio SMS
```bash
python -m channels.run twilio <ACCOUNT_SID> <AUTH_TOKEN> <FROM_NUMBER> \
  [--backend-url http://localhost:8000] \
  [--access-token TOKEN] \
  [--host 0.0.0.0] [--port 8080] \
  [--verify-signatures]
```

### GitHub
```bash
python -m channels.run github <GITHUB_TOKEN> \
  [--webhook-secret SECRET] \
  [--backend-url http://localhost:8000] \
  [--access-token TOKEN] \
  [--host 0.0.0.0] [--port 8080]
```

### Facebook Messenger
```bash
python -m channels.run messenger <PAGE_ACCESS_TOKEN> \
  [--verify-token TOKEN] \
  [--backend-url http://localhost:8000] \
  [--access-token-backend TOKEN] \
  [--host 0.0.0.0] [--port 8080]
```

### WeChat Official Account
```bash
python -m channels.run wechat <WECHAT_TOKEN> <APP_ID> <APP_SECRET> \
  [--backend-url http://localhost:8000] \
  [--access-token-backend TOKEN] \
  [--host 0.0.0.0] [--port 8080]
```

### Amazon Alexa
```bash
python -m channels.run alexa \
  [--skill-id amzn1.ask.skill.xxx] \
  [--backend-url http://localhost:8000] \
  [--access-token TOKEN] \
  [--host 0.0.0.0] [--port 8080]
```

Platform-specific env vars:

| Platform | Variable | Description |
|---|---|---|
| Email | `IMAP_PORT` | IMAP SSL port (default: 993) |
| Email | `SMTP_PORT` | SMTP STARTTLS port (default: 587) |
| Email | `EMAIL_POLL_INTERVAL` | Poll interval in seconds (default: 10) |
| Google Assistant | `GA_HOST` | Bind address (default: 0.0.0.0) |
| Google Assistant | `GA_PORT` | Listen port (default: 8080) |
| Google Assistant | `GA_API_KEY` | Optional API key for `/fulfillment` |
| GitHub | `GITHUB_TOKEN` | GitHub Personal Access Token |
| GitHub | `GITHUB_WEBHOOK_SECRET` | HMAC secret for webhook verification |
| Messenger | `MESSENGER_VERIFY_TOKEN` | Webhook verification token |
| Alexa | `ALEXA_HOST` | Bind address (default: 0.0.0.0) |
| Alexa | `ALEXA_PORT` | Listen port (default: 8080) |
| Alexa | `ALEXA_SKILL_ID` | Optional Alexa Skill ID for validation |

---

## 12. Security Considerations

**Token storage at rest**
Tokens are stored as plaintext JSON files. On production deployments, restrict file permissions (`chmod 600`) and consider moving to an encrypted store or a secrets manager for the token file.

**Token refresh**
Silent refresh only triggers on confirmed HTTP 401. Transient errors (network issues, backend 5xx) do not trigger logout — this is intentional to avoid false "session expired" messages.

**Race conditions**
Telegram uses a per-user `asyncio.Lock` around token refresh to prevent two concurrent handler invocations from both attempting a refresh simultaneously. Other platforms should implement similar serialization if they expect high concurrency per user.

**Webhook server protection**
The Webhook adapter supports an optional `WEBHOOK_API_KEY`. Without it, anyone who can reach the server can trigger agent and workflow execution. In production, always run behind a reverse proxy with TLS and configure the API key.

**WhatsApp and Teams inbound webhooks**
Both platforms sign inbound webhook payloads. WhatsApp uses the Meta verify token for the initial handshake; Teams uses Azure OAuth token validation via the Bot Framework adapter. Do not expose these endpoints without the respective verification in place.

**No sensitive data in commands**
Avoid putting secrets (API keys, passwords) directly in command arguments — they may be logged by the platform. The login flow asks for credentials interactively (not as command arguments) for this reason.

---

*Document scope: `channels/` only. OpenJiuwen Studio backend architecture is covered separately.*
