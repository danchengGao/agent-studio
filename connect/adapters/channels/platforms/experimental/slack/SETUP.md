# Slack Bot Setup Guide

This guide walks you through creating a Slack app from scratch and connecting it to OpenJiuwen.
The bot uses **Socket Mode** — no public URL or server exposure required.

---

## Prerequisites

- A Slack account and access to a Slack workspace where you can install apps
  (free workspaces work fine)
- OpenJiuwen backend running and accessible

---

## Step 1 — Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App**
3. Choose **From scratch**
4. Fill in:
   - **App Name**: e.g. `OpenJiuwen`
   - **Pick a workspace**: select the workspace where you want to use the bot
5. Click **Create App**

---

## Step 2 — Enable Socket Mode

Socket Mode lets the bot connect to Slack without a public URL.

1. In the left sidebar, click **Socket Mode**
2. Toggle **Enable Socket Mode** to ON
3. A popup asks you to create an App-Level Token:
   - **Token Name**: e.g. `socket-token`
   - **Scopes**: click **Add Scope** and add `connections:write`
4. Click **Generate**
5. Copy the token — it starts with `xapp-`

   ```
   xapp-1-XXXXXXXXXX-0000000000000-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

   **Save this — it is your APP_TOKEN.**

---

## Step 3 — Add Bot Token Scopes

1. In the left sidebar, click **OAuth & Permissions**
2. Scroll down to **Bot Token Scopes**
3. Click **Add an OAuth Scope** and add each of these:

   | Scope | Purpose |
   |---|---|
   | `commands` | Receive slash command invocations |
   | `chat:write` | Send messages |
   | `im:history` | Read direct messages |
   | `im:read` | View direct message channels |
   | `im:write` | Start direct message conversations |

---

## Step 4 — Add Slash Commands

1. In the left sidebar, click **Slash Commands**
2. Click **Create New Command** for each command below.
   - **Request URL**: enter any placeholder URL, e.g. `https://example.com` — it is not used in Socket Mode
   - **Short Description**: copy from the table

   | Command             | Short Description |
   |---------------------|---|
   | `/login`            | Log in to OpenJiuwen backend |
   | `/logout`           | Log out |
   | `/auth_status`      | Check login status |
   | `/workflows`        | List all workflows |
   | `/workflows_search` | Search workflows by keyword |
   | `/workflow_run`     | Run a workflow |
   | `/workflow_cancel`  | Cancel workflow parameter collection |
   | `/agents`           | List all agents |
   | `/agents_search`    | Search agents by keyword |
   | `/agent_run`        | Run an agent with a single message |
   | `/agent_chat`       | Start interactive chat with an agent |
   | `/agent_end_chat`   | End current agent chat session |
   | `/health`           | Check backend health |
   | `/help`             | Show all available commands |

   > **Tip:** Create all 14 commands before moving on — Slack saves each one individually.

---

## Step 5 — Enable Direct Messages

The bot uses DMs for multi-step flows (login, workflow parameter collection, agent chat).

1. In the left sidebar, click **App Home**
2. Scroll to **Show Tabs**
3. Toggle **Allow users to send Slash commands and messages from the messages tab** to ON

---

## Step 6 — Install the App to Your Workspace

1. In the left sidebar, click **OAuth & Permissions**
2. Scroll up and click **Install to Workspace**
3. Review the permissions and click **Allow**
4. You are redirected back. Copy the **Bot User OAuth Token** — it starts with `xoxb-`:

   ```
   xoxb-0000000000000-0000000000000-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

   **Save this — it is your BOT_TOKEN.**

---

## Step 7 — Run the Bot

From the project root directory:

```bash
python -m channels.run slack <BOT_TOKEN> <APP_TOKEN>
```

**With a custom backend URL:**
```bash
python -m channels.run slack <BOT_TOKEN> <APP_TOKEN> http://your-server:8000
```

**With a static access token** (all users share one backend session, no per-user login needed):
```bash
python -m channels.run slack <BOT_TOKEN> <APP_TOKEN> http://your-server:8000 <ACCESS_TOKEN>
```

You should see:
```
✅ Connected to OpenJiuwen backend at http://localhost:8000
🤖 OpenJiuwen Slack Bot is running! (Socket Mode)
```

---

## Step 8 — Test the Bot

1. Open your Slack workspace
2. Find the bot in the sidebar under **Apps** — click the bot name
3. In the **Messages** tab, type `/help` — you should see the list of commands
4. Type `/health` — the bot should report the backend status
5. Type `/login` and follow the prompts to authenticate

   > For multi-step flows (login, workflow parameter collection, agent chat),
   > the bot will ask you to reply with plain text in the DM conversation.

---

## Notes

- Both tokens are sensitive — treat them like passwords. Never share them publicly.
- User sessions are stored locally in `platforms/slack/.slack_bot_tokens.json` (gitignored).
- The bot must be running for users to interact with it. Stop it with `Ctrl+C`.
- If you reinstall the app (e.g. to add new scopes), you get a new BOT_TOKEN — update your run command.
- To add the bot to a channel (optional), go to the channel → **Integrations** → **Add apps**.
  Slash commands work from any channel the bot is added to, and from DMs.
