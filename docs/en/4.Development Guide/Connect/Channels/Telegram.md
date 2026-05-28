# Connect — Telegram

The Telegram bot uses long polling via python-telegram-bot. Users interact with it via
slash commands in a direct message conversation.

## Prerequisites

- A Telegram account ([telegram.org](https://telegram.org))
- OpenJiuwen backend running and accessible

## Step 1 — Create a Bot with BotFather

BotFather is Telegram's official bot for creating and managing bots.

1. Open Telegram and search for **@BotFather** (blue verified checkmark)
2. Start a conversation: tap **Start**
3. Send `/newbot`
4. BotFather asks for a **display name** — this is what users see in chats.
   Example: `OpenJiuwen Assistant`
5. BotFather asks for a **username** — must end in `bot`, no spaces.
   Example: `openjiuwen_assistant_bot`
6. BotFather replies with your **Bot Token**:
   ```
   Done! Use this token to access the HTTP API:
   123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   **Copy and save this token.**

## Step 2 — (Optional) Configure the Bot

Still in the BotFather conversation:

**Set a description** (shown when users open the bot for the first time):
```
/setdescription
```
Select your bot, then type a description, e.g.:
> Interact with OpenJiuwen workflows and agents directly from Telegram.

**Set a profile photo:**
```
/setuserpic
```
Select your bot, then send an image.

**Set the command list** (enables autocomplete in Telegram):
```
/setcommands
```
Select your bot, then paste:
```
login - Log in to OpenJiuwen backend
logout - Log out
status - Check login status
workflows - List all workflows
workflow_search - Search workflows
workflow_execute - Run a workflow
agents - List all agents
agent_search - Search agents
agent_execute - Run an agent with a single message
agent_start_chat - Start interactive chat with an agent
health - Check backend health
help - Show all commands
```

## Installation

### For Direct Run (Local Development)

If running the backend directly on your machine, install dependencies first:

```bash
pip install -r connect/adapters/channels/requirements.txt
```

### For Docker Run (Production)

If running OpenJiuwen in Docker, dependencies are already installed via `pyproject.toml` — skip to the next step.

## Step 3 — Run the Bot

**Direct Run:**
```bash
python -m connect.adapters.channels.run telegram <BOT_TOKEN>
```

**Docker Run:**
```bash
docker exec -it <container_id> python -m connect.adapters.channels.run telegram <BOT_TOKEN>
```

Replace `<container_id>` with your actual container ID (find it with `docker ps`).

**Note:** All examples below show Direct Run commands. For Docker, prefix each command with `docker exec -it <container_id>`.

**With a custom backend URL:**
```bash
python -m connect.adapters.channels.run telegram <BOT_TOKEN> http://your-server:8000
```

**With a static access token** (all users share one backend session — no per-user login needed):
```bash
python -m connect.adapters.channels.run telegram <BOT_TOKEN> http://your-server:8000 <ACCESS_TOKEN>
```

You should see:
```
Connected to OpenJiuwen backend at http://localhost:8000
OpenJiuwen Telegram Bot is running!
```

## Step 4 — Test the Bot

1. Open Telegram and search for the bot username you chose (e.g. `@openjiuwen_assistant_bot`)
2. Tap **Start**
3. Send `/help` — you should see the list of available commands
4. Send `/health` — the bot should report the backend status
5. Send `/login` and follow the prompts to authenticate

## Available Commands

| Command | Description |
|---------|-------------|
| `/login` | Log in to the OpenJiuwen backend |
| `/logout` | Log out |
| `/status` | Check login status |
| `/workflows` | List all workflows |
| `/workflow_search <query>` | Search workflows by keyword |
| `/workflow_execute <id>` | Run a workflow |
| `/agents` | List all agents |
| `/agent_search <query>` | Search agents by keyword |
| `/agent_execute <id> <message>` | Send a single message to an agent |
| `/agent_start_chat <id>` | Start interactive chat with an agent |
| `/health` | Check backend health |
| `/help` | Show all commands |

## Notes

- The bot token is sensitive — treat it like a password. Never share it publicly.
- User sessions are stored in `connect/adapters/channels/platforms/telegram/.telegram_bot_tokens.json` (gitignored).
- The bot must be running for users to interact with it. Stop with `Ctrl+C`.
- To get a new token, use `/revoke` in BotFather, then `/newbot` or `/mybots`.
