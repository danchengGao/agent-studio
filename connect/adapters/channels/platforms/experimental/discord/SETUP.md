# Discord Bot Setup Guide

This guide walks you through creating a Discord bot from scratch and connecting it to OpenJiuwen.
The bot uses the Discord Gateway (WebSocket) — no public URL required.
Slash commands are registered automatically when the bot starts.

---

## Prerequisites

- A Discord account — [discord.com](https://discord.com)
- A Discord server where you have **Manage Server** permission (or create a new one)
- OpenJiuwen backend running and accessible

---

## Step 1 — Create an Application

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application** (top right)
3. Enter a name, e.g. `OpenJiuwen`
4. Click **Create**

---

## Step 2 — Add a Bot

1. In the left sidebar, click **Bot**
2. Click **Add Bot** → **Yes, do it!**
3. Under **Token**, click **Reset Token** → **Yes, do it!**
4. Copy the token that appears:
   ```
   MTIzNDU2Nzg5MDEyMzQ1Njc4.XXXXXX.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   **Save this — it is your BOT_TOKEN. It is shown only once.**

   > If you lose it, click **Reset Token** again to generate a new one.

---

## Step 3 — Enable Required Intents

Still on the **Bot** page:

1. Scroll down to **Privileged Gateway Intents**
2. Enable **Message Content Intent** (required to read DM message text)
3. Click **Save Changes**

---

## Step 4 — Invite the Bot to Your Server

1. In the left sidebar, click **OAuth2** → **URL Generator**
2. Under **Scopes**, check:
   - `bot`
   - `applications.commands`
3. Under **Bot Permissions**, check:
   - `Send Messages`
   - `Read Message History`
4. Copy the generated URL at the bottom of the page
5. Open that URL in your browser
6. Select the server you want to add the bot to
7. Click **Authorize**

The bot now appears in your server's member list (offline until you run it).

---

## Step 5 — Run the Bot

From the project root directory:

```bash
python -m channels.run discord <BOT_TOKEN>
```

**With a custom backend URL:**
```bash
python -m channels.run discord <BOT_TOKEN> http://your-server:8000
```

**With a static access token** (all users share one backend session, no per-user login needed):
```bash
python -m channels.run discord <BOT_TOKEN> http://your-server:8000 <ACCESS_TOKEN>
```

You should see:
```
✅ Connected to OpenJiuwen backend at http://localhost:8000
✅ Logged in as OpenJiuwen#1234 (ID: 123456789)
   Slash commands synced.
```

> **First run note:** Slash commands can take up to 1 hour to appear globally on Discord.
> To see them immediately, sync to a specific server (guild). See the note at the bottom.

---

## Step 6 — Test the Bot

1. Open your Discord server
2. In any text channel, type `/` — you should see the bot's commands in the autocomplete list
3. Run `/help` — the bot replies with the list of all commands
4. Run `/health` — the bot should report the backend status
5. Run `/login` — the bot sends you a DM to continue the login process

---

## How Multi-Step Flows Work

Unlike Telegram and Slack, Discord slash commands do not allow follow-up text replies
in the same channel. Instead, the bot sends a **DM** when it needs more input:

- `/login` → bot sends you a DM asking for your username (and password if configured)
- `/workflow_run workflow_id:xyz` → if the workflow has parameters, bot sends you a DM to collect them
- `/agent_chat agent_id:xyz` → bot opens a DM conversation with the agent

> **Requirement:** You must allow DMs from server members.
> User Settings → Privacy & Safety → Allow direct messages from server members → ON

---

## Notes

- The bot token is sensitive — treat it like a password. Never share it publicly.
- User sessions are stored locally in `platforms/discord/.discord_bot_tokens.json` (gitignored).
- The bot must be running for users to interact with it. Stop it with `Ctrl+C`.
- Slash commands are global by default (sync takes up to 1 hour on Discord's side).
  For instant updates during development, sync to a specific guild — edit `on_ready` in
  `handlers_registrator.py`:
  ```python
  MY_GUILD = discord.Object(id=YOUR_SERVER_ID)  # right-click server → Copy Server ID
  await bot.tree.sync(guild=MY_GUILD)
  ```
- To get your Server ID: enable Developer Mode (User Settings → Advanced → Developer Mode),
  then right-click your server and select **Copy Server ID**.
