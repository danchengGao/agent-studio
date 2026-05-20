# Connect — Slack

The Slack bot uses **Socket Mode** — no public URL or server exposure required.
Users interact with it via slash commands in direct messages or channels.

## Prerequisites

- A Slack account and access to a workspace where you can install apps (free workspaces work)
- OpenJiuwen backend running and accessible

## Step 1 — Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App** → **From scratch**
3. Fill in:
   - **App Name**: e.g. `OpenJiuwen`
   - **Pick a workspace**: select your target workspace
4. Click **Create App**

## Step 2 — Enable Socket Mode

Socket Mode lets the bot connect to Slack without a public URL.

1. In the left sidebar, click **Socket Mode**
2. Toggle **Enable Socket Mode** to ON
3. When prompted to create an App-Level Token:
   - **Token Name**: e.g. `socket-token`
   - **Scopes**: add `connections:write`
4. Click **Generate** and copy the token — it starts with `xapp-`

**Save this as your `APP_TOKEN`.**

## Step 3 — Add Bot Token Scopes

1. In the left sidebar, click **OAuth & Permissions**
2. Scroll to **Bot Token Scopes** and add each of these:

   | Scope | Purpose |
   |-------|---------|
   | `commands` | Receive slash command invocations |
   | `chat:write` | Send messages |
   | `im:history` | Read direct messages |
   | `im:read` | View direct message channels |
   | `im:write` | Start direct message conversations |

## Step 4 — Add Slash Commands

1. In the left sidebar, click **Slash Commands**
2. Click **Create New Command** for each command below
   - **Request URL**: any placeholder, e.g. `https://example.com` (not used in Socket Mode)
   - **Short Description**: copy from the table

   | Command | Short Description |
   |---------|------------------|
   | `/login` | Log in to OpenJiuwen backend |
   | `/logout` | Log out |
   | `/auth_status` | Check login status |
   | `/workflows` | List all workflows |
   | `/workflows_search` | Search workflows by keyword |
   | `/workflow_run` | Run a workflow |
   | `/workflow_cancel` | Cancel workflow parameter collection |
   | `/agents` | List all agents |
   | `/agents_search` | Search agents by keyword |
   | `/agent_run` | Run an agent with a single message |
   | `/agent_chat` | Start interactive chat with an agent |
   | `/agent_end_chat` | End current agent chat session |
   | `/health` | Check backend health |
   | `/help` | Show all available commands |

   > Create all 14 commands before moving on — Slack saves each one individually.

## Step 5 — Enable Direct Messages

The bot uses DMs for multi-step flows (login, workflow parameter collection, agent chat).

1. In the left sidebar, click **App Home**
2. Scroll to **Show Tabs**
3. Toggle **Allow users to send Slash commands and messages from the messages tab** to ON

## Step 6 — Install the App to Your Workspace

1. In the left sidebar, click **OAuth & Permissions**
2. Scroll up and click **Install to Workspace**
3. Review the permissions and click **Allow**
4. Copy the **Bot User OAuth Token** — it starts with `xoxb-`

**Save this as your `BOT_TOKEN`.**

## Installation

### For Direct Run (Local Development)

If running the backend directly on your machine, install dependencies first:

```bash
pip install -r connect/adapters/channels/requirements.txt
```

### For Docker Run (Production)

If running OpenJiuwen in Docker, dependencies are already installed via `pyproject.toml` — skip to the next step.

## Step 7 — Run the Bot

**Direct Run:**
```bash
python -m connect.adapters.channels.run slack <BOT_TOKEN> <APP_TOKEN>
```

**Docker Run:**
```bash
docker exec -it <container_id> python -m connect.adapters.channels.run slack <BOT_TOKEN> <APP_TOKEN>
```

Replace `<container_id>` with your actual container ID (find it with `docker ps`).

**Note:** All examples below show Direct Run commands. For Docker, prefix each command with `docker exec -it <container_id>`.

**With a custom backend URL:**
```bash
python -m connect.adapters.channels.run slack <BOT_TOKEN> <APP_TOKEN> http://your-server:8000
```

**With a static access token** (all users share one backend session — no per-user login needed):
```bash
python -m connect.adapters.channels.run slack <BOT_TOKEN> <APP_TOKEN> http://your-server:8000 <ACCESS_TOKEN>
```

You should see:
```
Connected to OpenJiuwen backend at http://localhost:8000
OpenJiuwen Slack Bot is running! (Socket Mode)
```

## Step 8 — Test the Bot

1. Open your Slack workspace → find the bot under **Apps** in the sidebar
2. In the **Messages** tab, type `/help` — you should see the list of commands
3. Type `/health` — the bot should report the backend status
4. Type `/login` and follow the prompts to authenticate

For multi-step flows (login, workflow parameter collection, agent chat), the bot will ask you
to reply with plain text in the DM conversation.

## Notes

- Both tokens are sensitive — treat them like passwords. Never share them publicly.
- User sessions are stored in `connect/adapters/channels/platforms/slack/.slack_bot_tokens.json` (gitignored).
- The bot must be running for users to interact with it. Stop with `Ctrl+C`.
- If you reinstall the app (e.g. to add new scopes), you get a new `BOT_TOKEN` — update your run command.
- To use slash commands from a channel, add the bot to that channel via **Integrations** → **Add apps**.
