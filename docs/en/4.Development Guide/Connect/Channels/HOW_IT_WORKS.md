# How Humans Connect to OpenJiuwen via Channels

This document explains exactly what happens at every stage — from getting platform
credentials to a user running a workflow inside WhatsApp or Slack. Intended for
developers setting up a channel for the first time, or anyone wanting to understand
the full connection flow.

---

## The big picture

```
  You (developer)
       │
       │  configure once (platform bot credentials)
       ▼
  channel server starts
       │
       │  connects to messaging platform
       ▼
  Messaging Platform  ◄──────────►  Channel Bot  ──────────────►  OpenJiuwen backend
  (Telegram, Slack,    messages       (channels/                  HTTP + per-user
   WhatsApp, etc.)                    platforms/<name>/)          Bearer token
       │
       │  human types /login, runs agents, runs workflows
       ▼
  End user (human)
```

Channels direction is: **Human → Messaging Platform → Channel Bot → OpenJiuwen backend**.
The human is the consumer. OpenJiuwen is the system being exposed.
This is the opposite of MCP, where Claude the LLM consumes OpenJiuwen autonomously.

**Two separate sets of credentials exist side by side:**

| Credential | Who it belongs to | When it is set | What it allows |
|---|---|---|---|
| Platform bot token | The bot itself (Telegram, Slack…) | Developer, at startup | The bot to connect to the messaging platform |
| OpenJiuwen Bearer token | Each human user | User, at runtime via /login | That specific user to call OpenJiuwen on their own behalf |

---

## Full step-by-step flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1 — GET PLATFORM CREDENTIALS  (one-time, done by developer)    │
│                                                                     │
│  Each messaging platform requires its own bot credentials.          │
│  These are obtained once from the platform's developer console,     │
│  not from OpenJiuwen.                                               │
│                                                                     │
│  Examples:                                                          │
│    Telegram:  Create a bot via @BotFather → get bot token           │
│    Slack:     Create a Slack app → get Bot User OAuth Token         │
│    WhatsApp:  Register via Meta Business → get access token         │
│               + phone_number_id + verify_token                      │
│    Discord:   Create application → get bot token                    │
│    Teams:     Register Azure bot → get app_id + app_password        │
│                                                                     │
│  These credentials identify your bot to the messaging platform.     │
│  They have nothing to do with OpenJiuwen authentication.            │
│  They never expire during normal operation (unless you rotate them).│
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2 — START THE CHANNEL SERVER  (developer runs this)            │
│                                                                     │
│  python -m connect.adapters.channels.run <platform> [OPTIONS]       │
│                                                                     │
│  Examples:                                                          │
│    python -m connect.adapters.channels.run telegram                 │
│      --token TELEGRAM_BOT_TOKEN                                     │
│      --backend-url http://localhost:8000                            │
│                                                                     │
│    python -m connect.adapters.channels.run whatsapp                 │
│      --access-token WHATSAPP_ACCESS_TOKEN                           │
│      --phone-number-id 123456                                       │
│      --verify-token my_verify_secret                                │
│      --backend-url http://localhost:8000                            │
│      --port 8080                                                    │
│                                                                     │
│  What happens inside:                                               │
│    launcher.py reads the platform credentials from args             │
│    creates an OpenJiuwenClient(base_url=backend_url)                │
│      → no OpenJiuwen token yet — users haven't logged in            │
│    registers all command handlers (login, logout, agents, etc.)     │
│    starts the server (see Step 3)                                   │
│                                                                     │
│  The process runs until you stop it (Ctrl+C or service manager).    │
│  One running process serves all users of that platform at once.     │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3 — PLATFORM CONNECTION  (two models, depending on platform)   │
│                                                                     │
│  Model A — SDK / long-polling (Telegram, Slack, Discord):           │
│                                                                     │
│    The platform SDK opens a persistent connection to the platform's │
│    servers and receives messages over it. No public URL needed.     │
│    The bot reaches out; the platform pushes events back.            │
│                                                                     │
│    Telegram example:                                                │
│      python-telegram-bot Application starts polling                 │
│        → long-polls Telegram servers for updates                    │
│        → Telegram delivers any new messages to the bot              │
│                                                                     │
│  Model B — Webhooks (WhatsApp, Teams, Twilio, Messenger, WeChat):   │
│                                                                     │
│    The channel server runs a FastAPI+uvicorn HTTP server.           │
│    The messaging platform sends POST requests to your public URL    │
│    whenever a user sends a message.                                 │
│    Requires a publicly reachable URL (real domain or ngrok tunnel). │
│                                                                     │
│    WhatsApp example:                                                │
│      uvicorn starts on port 8080                                    │
│        → you register https://yourdomain.com/webhook                │
│          in the Meta Developer Console                              │
│        → Meta sends POST /webhook for every incoming message        │
│                                                                     │
│  In both models the result is the same: messages from users arrive  │
│  at the channel bot and are routed to the correct handler.          │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │  user sends a message
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4 — USER AUTHENTICATION  (each user, once per device/session)  │
│                                                                     │
│  When a new user first messages the bot, they are not logged in.    │
│  The bot has no OpenJiuwen token for them yet.               .      │
│  They must authenticate.                                            │
│                                                                     │
│  The /login flow (same logic on every platform):                    │
│                                                                     │
│  4a. User types /login (or "login") in the chat.                    │
│      Bot replies: "Please enter your OpenJiuwen username:"          │
│                                                                     │
│  4b. User types their OpenJiuwen username.                          │
│      Bot stores it temporarily in user_data and asks for password.  │
│                                                                     │
│  4c. User types their OpenJiuwen password.                          │
│      Bot calls: do_login(backend_client, username, password)        │
│        → POST /auth/login to OpenJiuwen backend                     │
│        → OpenJiuwen returns: access_token, refresh_token            │
│        → backend_client.set_token(access_token)                     │
│        → GET /spaces/ to find the user's default space              │
│        → returns {token, space_id, refresh_token}                   │
│                                                                     │
│  4d. Bot calls: set_user_data(user_id, token, space_id,             │
│                               refresh_token)                        │
│        → saved to .{platform}_tokens.json on disk, keyed by user_id │
│        e.g. .telegram_bot_tokens.json:                              │
│          {                                                          │
│            "123456789": {                                           │
│              "token": "eyJhbGc...",                                 │
│              "space_id": "space-abc",                               │
│              "refresh_token": "eyJhbGc..."                          │
│            }                                                        │
│          }                                                          │
│                                                                     │
│  4e. Bot tells the user: "✅ Logged in as alice. You can now run    │
│      agents and workflows."                                         │
│                                                                     │
│  This token persists across bot restarts. The user does not need    │
│  to log in again on the next session unless the token expires and   │
│  auto-refresh also fails (see Step 5c).                             │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │  user sends a command
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5 — PER-MESSAGE FLOW  (every command the user sends)           │
│                                                                     │
│  Example: user types "/workflow_execute wf-99"                      │
│                                                                     │
│  5a. Platform delivers the message to the channel bot.              │
│      Handler for workflow_execute is called.                        │
│                                                                     │
│  5b. Bot loads the user's token from disk:                          │
│        token    = get_user_token(user_id)      ← from .json file    │
│        space_id = get_user_space_id(user_id)                        │
│        refresh  = get_user_refresh_token(user_id)                   │
│        backend_client.set_token(token)                              │
│        backend_client.set_space_id(space_id)                        │
│                                                                     │
│  5c. Bot calls: verify_and_refresh(client, user_id, refresh)        │
│      Token is still valid → proceed                                 │
│      Token expired, refresh_token exists:                           │
│        → POST /auth/refresh with refresh_token                      │
│        → OpenJiuwen returns new access_token                        │
│        → client.set_token(new_token)                                │
│        → .json file updated silently                                │
│        → user sees nothing — it just works                          │
│      Token expired, refresh also fails:                             │
│        → bot tells user: "Session expired. Please /login again."    │
│        → flow stops here                                            │
│                                                                     │
│  5d. Bot calls client logic:                                        │
│        execute_workflow(client, "wf-99", inputs={...})              │
│          → POST /api/v1/execution/workflow                          │
│          → Authorization: Bearer eyJhbGc...  (this user's token)    │
│          → OpenJiuwen executes the workflow as this specific user   │
│          → response streams back as SSE events                      │
│        parse_workflow_result(events) → (outputs, error)             │
│                                                                     │
│  5e. Bot formats the output for the platform and replies:           │
│      Telegram → sends a text message                                │
│      Slack    → sends a Slack message block                         │
│      WhatsApp → sends a WhatsApp message via Meta Graph API         │
│      CLI      → prints to stdout                                    │
│                                                                     │
│  Each user's token is used only for their own requests.             │
│  User A's token never touches User B's requests.                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## What the user sees vs. what actually happens

```
User types:  "/workflow_execute wf-99"

                    Bot works (not visible to user)
                            │
              ┌─────────────▼────────────────────┐
              │  load token from .json           │  ← disk read
              │  verify_and_refresh()            │  ← silent token check
              └─────────────┬────────────────────┘
                            │
              ┌─────────────▼────────────────────┐
              │  collect input parameters        │  ← multi-message dialog
              │  Bot: "Please enter 'source':"   │     if workflow needs inputs
              │  User: "my_data.csv"             │
              └─────────────┬────────────────────┘
                            │
              ┌─────────────▼────────────────────┐
              │  execute_workflow("wf-99", ...)  │  ← HTTP to OpenJiuwen
              │  stream SSE events               │
              │  parse result                    │
              └─────────────┬────────────────────┘
                            │
User sees:   "✅ Workflow complete. Output: ..."
```

---

## Token lifecycle — channels vs. MCP

| | Channels | MCP |
|---|---|---|
| Who authenticates | Each human user, interactively, at runtime | Developer, once, at config time |
| When | First time user messages the bot | Before Claude Desktop starts |
| How | /login → username + password typed in chat | Token pasted into claude_desktop_config.json |
| Stored where | `.{platform}_tokens.json` on disk, keyed by user_id | In OS process memory (read from config at startup) |
| Multiple users | Yes — one token per user in the same file | No — one token for the one configured identity |
| Token expiry | Handled automatically via refresh_token (silent) | Not handled — requires manual config update + restart |
| Logout | /logout clears the user's entry from the .json file | No logout — stop Claude Desktop / remove from config |

---

## What happens when a user's token expires

```
User sends any command
        ↓
Bot loads token from .json file
        ↓
verify_and_refresh() called
        ↓
  ┌─────────────────────────────────────┐
  │ Token still valid                   │ → continue normally (most common)
  └─────────────────────────────────────┘
  ┌─────────────────────────────────────┐
  │ Token expired + refresh_token exists│ → POST /auth/refresh
  │                                     │   new token saved to .json
  │                                     │   user sees nothing
  └─────────────────────────────────────┘
  ┌─────────────────────────────────────┐
  │ Token expired + refresh also failed │ → Bot tells user:
  │                                     │   "Session expired. /login again."
  └─────────────────────────────────────┘
```

Unlike MCP, the user can immediately recover by typing /login — no developer
intervention, no config file editing, no restart required.
