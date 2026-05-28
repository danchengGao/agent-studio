# Microsoft Teams Bot Setup Guide

The Teams bot runs a local HTTP server that Azure Bot Service calls via
webhook whenever a user sends a message.  You need an Azure account and
(for local development) a public HTTPS tunnel such as **ngrok**.

---

## Prerequisites

- Python 3.9+
- Azure account (free tier is sufficient)
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) or access to the Azure Portal
- [ngrok](https://ngrok.com/) (for local development without a deployed server)

---

## Step 1 — Install Dependencies

```bash
pip install -r channels/requirements.txt
```

New packages added for Teams:
- `botbuilder-core` — Microsoft Bot Framework SDK
- `botbuilder-integration-aiohttp` — aiohttp adapter
- `aiohttp` — async HTTP server

---

## Step 2 — Create an Azure Bot Registration

1. Go to the [Azure Portal](https://portal.azure.com/) and sign in.
2. Click **Create a resource** → search for **Azure Bot**.
3. Click **Create**.
4. Fill in the form:
   - **Bot handle**: choose a unique name (e.g. `openjiuwen-bot`)
   - **Subscription / Resource Group**: use existing or create new
   - **Pricing tier**: `F0` (free)
   - **Microsoft App ID**: select **Create new Microsoft App ID**
5. Click **Review + create** → **Create**.
6. After deployment, go to the resource → **Configuration** tab.
7. Copy the **Microsoft App ID** — this is your `APP_ID`.

---

## Step 3 — Create an App Password

1. In the Azure Bot resource → **Configuration** → click **Manage** next to the App ID.
   (This opens Microsoft Entra ID / App Registrations.)
2. Go to **Certificates & secrets** → **New client secret**.
3. Add a description and choose an expiry, then click **Add**.
4. **Copy the secret value immediately** — it is only shown once. This is your `APP_PASSWORD`.

---

## Step 4 — Expose Your Local Server (Development)

The bot server must be reachable over HTTPS.  Use ngrok for local development:

```bash
ngrok http 3978
```

ngrok prints a forwarding URL like `https://abc123.ngrok-free.app`.
Copy it — you will need it in the next step.

---

## Step 5 — Set the Messaging Endpoint

1. Back in Azure Portal → your Azure Bot resource → **Configuration**.
2. Set **Messaging endpoint** to:
   ```
   https://<your-ngrok-url>/api/messages
   ```
   Example: `https://abc123.ngrok-free.app/api/messages`
3. Click **Apply**.

For a production deployment, replace the ngrok URL with your server's
public HTTPS URL.

---

## Step 6 — Enable the Teams Channel

1. In the Azure Bot resource → **Channels** tab.
2. Click **Microsoft Teams** (the Teams logo).
3. Accept the terms, click **Agree** → **Save**.
4. The Teams channel is now active.

---

## Step 7 — Start the Bot

From the project root:

```bash
python -m channels.run teams <APP_ID> <APP_PASSWORD>
```

With a custom backend URL and port:

```bash
python -m channels.run teams <APP_ID> <APP_PASSWORD> \
  --backend-url http://my-server:8000 \
  --port 3978
```

Using environment variables instead of arguments:

```bash
export BACKEND_URL=http://my-server:8000
python -m channels.run teams APP_ID APP_PASSWORD
```

---

## Step 8 — Add the Bot to Teams

### Option A — Test in Teams Web (quickest)

1. In Azure Portal → your Azure Bot → **Channels** → **Microsoft Teams**.
2. Click **Open in Teams** (the link next to the Teams channel).
3. Teams opens a 1:1 chat with your bot — type `help` to verify.

### Option B — Sideload a Teams App Package

For broader deployment (team channels, org-wide):

1. Go to [Teams Developer Portal](https://dev.teams.microsoft.com/).
2. Click **Apps** → **New app**.
3. Fill in the **Basic information** fields.
4. Go to **App features** → **Bot** → **Add a bot**.
5. Select your registered bot (by App ID), check **Personal** scope.
6. Click **Save**.
7. Go to **Publish** → **Download app package** → install it in Teams.

---

## Available Commands

Once the bot is running and added to Teams, users type these messages
in a 1:1 chat with the bot:

| Command | Description |
|---|---|
| `login` | Log in to the backend |
| `logout` | Log out |
| `status` | Check login status |
| `health` | Check backend connectivity |
| `help` | Show all available commands |
| `workflows` | List all workflows |
| `workflows search <query>` | Search workflows by keyword |
| `workflow run <id>` | Run a workflow (prompts for parameters) |
| `workflow cancel` | Cancel current workflow parameter collection |
| `agents` | List all agents |
| `agents search <query>` | Search agents by keyword |
| `agent run <id> <message>` | Send a single message to an agent |
| `agent chat <id>` | Start an interactive chat session |
| `end chat` | End the current chat session |

In a **Teams channel** (not 1:1), mention the bot first:

```
@OpenJiuwenBot help
@OpenJiuwenBot workflow run abc123
```

---

## Token Storage

User session tokens are stored in:

```
channels/platforms/teams/.teams_bot_tokens.json
```

Each token is keyed by the user's Azure Active Directory (AAD) object ID,
which is stable across name and email changes.

This file is listed in `.gitignore` and will not be committed.

---

## Production Deployment

For a production environment:

1. Deploy the bot server behind a reverse proxy (nginx, Caddy) with a
   valid TLS certificate.
2. Set `--host 127.0.0.1` and let the proxy handle HTTPS termination.
3. Update the **Messaging endpoint** in Azure to your production URL.
4. Use environment variables or a secrets manager for `APP_ID` and
   `APP_PASSWORD` — do not hard-code them.

Example systemd service (adjust paths):

```ini
[Unit]
Description=OpenJiuwen Teams Bot
After=network.target

[Service]
WorkingDirectory=/opt/openjiuwen
ExecStart=python -m channels.run teams APP_ID APP_PASSWORD \
          --backend-url http://localhost:8000 --port 3978
Restart=always
EnvironmentFile=/opt/openjiuwen/.env

[Install]
WantedBy=multi-user.target
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `401 Unauthorized` from Azure | Check APP_ID and APP_PASSWORD are correct |
| Bot does not respond | Verify the Messaging Endpoint URL in Azure matches your running server |
| ngrok session expired | Restart ngrok and update the Messaging Endpoint in Azure |
| Cannot connect to backend | Ensure `--backend-url` points to a running OpenJiuwen instance |
| Bot responds in channels but not DMs | Ensure **Personal** scope is enabled in the Teams App configuration |
| Token storage errors | Check write permissions for `platforms/teams/.teams_bot_tokens.json` |

### Test with Bot Framework Emulator (no Azure needed)

For quick local testing without Azure credentials:

1. Download [Bot Framework Emulator](https://github.com/microsoft/BotFramework-Emulator/releases).
2. Start the bot with empty credentials:
   ```bash
   python -m channels.run teams "" "" --port 3978
   ```
3. Open the Emulator → **Open Bot** → URL: `http://localhost:3978/api/messages`
4. Leave App ID and Password blank, click **Connect**.
