# Requirements Analysis — OpenJiuwen Anywhere (Connect)

---

## Source of Demand

- **Proactive Planning** — New Features
- **Product Requirements** — OpenJiuwen Product / Accessibility & Reach

---

## Demand Background

### WHY

OpenJiuwen provides a powerful platform for building and running AI agents and workflows.
However, all interaction today requires users to open a browser, navigate to the
OpenJiuwen web UI, and type into a chat window. This creates friction in everyday use:
users must switch context each time they want help, making OpenJiuwen feel like a
separate tool rather than an ambient capability.

The same problem affects AI assistants: a system like Claude Desktop or JiuwenClaw that
wants to invoke an OpenJiuwen agent or workflow on a user's behalf has no interface to
do so — it cannot open a browser.

Two distinct groups are underserved:

**1. People** — who already live in messaging applications (WhatsApp, Telegram, Slack,
email, voice assistants) and want to reach OpenJiuwen without switching context.

**2. AI assistants** — that need a structured interface to call OpenJiuwen agents and
workflows autonomously as part of their own reasoning, without a human typing commands.

The goal of this feature is to remove the friction of reaching OpenJiuwen for both
groups: people get OpenJiuwen inside the apps they already use; AI assistants get
OpenJiuwen as a callable tool library.

### WHEN

New feature, targeted for delivery with the OpenJiuwen platform release.

### WHAT

The feature is delivered as the `connect/` module and has two user-facing components:

---

**Component 1 — Channels (for people)**

Channels bring OpenJiuwen into 14 messaging platforms and environments. A user sends a
command or message in their usual app, and OpenJiuwen responds in the same place — no
browser tab, no context switch.

Each user authenticates with their own OpenJiuwen account directly inside their
messaging app. Their agents, workflows, and conversation history remain personal and
private. Where a platform does not support interactive per-user login (see Constraints),
a shared operator-configured token is used instead.

Capabilities available on all platforms:

| Capability | Description |
|---|---|
| Login / Logout | Authenticate with an OpenJiuwen account from inside the messaging app |
| List agents | Browse available agents |
| Search agents | Find agents by name or description |
| Run agent | Send a message to an agent and receive a reply |
| Agent chat | Continue a multi-turn conversation with an agent |
| List workflows | Browse available workflows |
| Search workflows | Find workflows by name or description |
| Run workflow | Execute a workflow; the bot collects required inputs step by step in-conversation |
| Health check | Verify that the OpenJiuwen backend is reachable |

Supported platforms:

**Production-ready platforms** (stable, tested, ready for production use):

| Platform | Audience |
|---|---|
| CLI (terminal) | Developers and power users working in the terminal |
| Email (IMAP/SMTP) | Universal — any user with an email address |
| WeChat | Users and teams in the Chinese market |
| HTTP Webhook | Any custom system or internal tool that can make an HTTP call |

**Experimental platforms** (functional but under development, may have rough edges):

| Platform | Audience |
|---|---|
| Telegram | Personal users, technical users, communities |
| Slack | Workplace teams |
| Discord | Developer communities, creator groups |
| WhatsApp | Personal users and teams who work primarily in WhatsApp |
| Microsoft Teams | Enterprise organisations on the Microsoft ecosystem |
| Facebook Messenger | Consumer-facing and existing Messenger audiences |
| GitHub | Developers triggering OpenJiuwen from issue and PR comments |
| Google Assistant | Voice and smart home users |
| Twilio SMS | Mobile-first users |
| Amazon Alexa | Voice and hands-free environments |

---

**Component 2 — MCP Server (for AI assistants)**

The MCP (Model Context Protocol) server exposes OpenJiuwen agents and workflows as
callable tools to any MCP-compatible AI assistant. The AI assistant discovers the
available tools automatically at startup and then calls them autonomously during a
conversation — deciding on its own when to search for a workflow, when to run an agent,
and how to use the results.

The developer configures the connection once (backend URL + access token). After that,
the AI assistant can use all OpenJiuwen capabilities without further setup.

Supported AI clients: Claude Desktop (Anthropic), JiuwenClaw (same product family as
OpenJiuwen), and any other MCP-compatible AI assistant.

OpenJiuwen capabilities exposed to AI assistants via MCP:

- Find and browse agents
- Run an agent; continue multi-turn conversations
- Find and browse workflows
- Inspect a workflow's definition and required inputs
- Run a workflow with inputs
- Verify backend connectivity

---

### Requirement Type

☑ **Functionality** (excluding Trust)
☑ **Operation and Maintenance Methods** (multi-platform deployment and configuration)

---

## Needs Assessment

### Constraints

**Response delivery — not real-time:**
Responses from agents and workflows are collected in full before being sent to the user.
Users receive a complete reply rather than a streaming/token-by-token response.
This is acceptable for conversational use but means long-running agents introduce a
visible wait before any response appears.

**Per-user login not available on all platforms:**
Microsoft Teams, WhatsApp, Google Assistant, and Amazon Alexa do not support the full
per-user interactive login flow due to platform architecture limitations. These platforms
use a shared backend token configured by the operator at deployment time. All users on
those platforms share the same OpenJiuwen identity.

**Platform-specific response limits (user-visible):**
Some platforms impose hard constraints on response size or response time that affect
what OpenJiuwen can return:
- Twilio SMS: 1600-character maximum per message
- Facebook Messenger: 2000-character maximum per message
- Google Assistant: 10-second maximum response time (enforced by Google)
- Amazon Alexa: 8-second maximum response time (enforced by Amazon)
- WeChat: 5-second synchronous response window

Long-running agents or workflows may not complete within these limits on the affected
platforms.

**8 platforms require a public internet URL:**
WhatsApp, Microsoft Teams, Google Assistant, Twilio SMS, GitHub, Facebook Messenger,
WeChat, and Amazon Alexa all operate by sending inbound requests to the adapter.
The adapter must be reachable via a public HTTPS URL. Deployment infrastructure for
exposing these adapters is outside the scope of this requirement.

**MCP — one identity per server instance:**
The MCP server uses a single access token set at startup. There is no per-user
authentication in the MCP flow. All AI assistant actions are performed under that
one identity on the OpenJiuwen backend.

### Impact of Requirement Implementation on Existing Systems

**OpenJiuwen backend:** No changes required. The connect layer uses existing REST API
endpoints and existing Bearer token authentication exclusively.

**Existing users and the web UI:** No impact. The connect layer is purely additive.
Users who continue to use the browser are unaffected.

**New inbound traffic:** The connect layer introduces additional API calls to the
OpenJiuwen backend — one or more per user command, across all connected platforms.
Volume scales with the number of active platform connections and users.

### External Dependencies

The connect layer depends on external platform services for each channel to function.
Each platform requires a developer account, a registered application or bot, and
(for webhook-based platforms) a public HTTPS URL.

| Platform | What must be set up |
|---|---|
| Telegram | Bot created via @BotFather → bot token |
| Slack | Slack App with Socket Mode enabled → bot token + app token |
| Discord | Application registered in Discord Developer Portal → bot token |
| Microsoft Teams | Bot registered in Azure Bot Service → App ID + password |
| WhatsApp | Meta Business account + verified phone number → access token |
| Facebook Messenger | Meta App with Messenger product → page access token |
| WeChat | WeChat Official Account (verified) → AppID + AppSecret |
| Twilio SMS | Twilio account with a purchased phone number → Account SID + Auth Token |
| Google Assistant | Google Actions project → fulfillment webhook URL |
| Amazon Alexa | Alexa Developer Console skill → fulfillment webhook URL |
| GitHub | GitHub repository with webhook configured → personal access token |
| HTTP Webhook | No external registration — self-hosted HTTP server |
| CLI | No external registration — local terminal |
| Email | IMAP + SMTP access to a mailbox → email address + password/app password |
