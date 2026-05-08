# Google Assistant Setup Guide

The Google Assistant channel exposes a fulfillment webhook that Google's
Actions SDK v3 calls every time a user speaks to your Action.  You need a
Google account and a project in the **Actions Console**.

---

## Prerequisites

- Python 3.9+
- `fastapi` and `uvicorn` installed (`pip install -r channels/requirements.txt`)
- A Google account
- A public HTTPS URL for local development (use [ngrok](https://ngrok.com/))

---

## Step 1 — Install Dependencies

```bash
pip install -r channels/requirements.txt
```

---

## Step 2 — Create a Google Actions Project

1. Go to [console.actions.google.com](https://console.actions.google.com/) and sign in.
2. Click **New project**, give it a name (e.g. `OpenJiuwen`), and choose your language.
3. Select **Custom** as the project type and click **Start building**.

---

## Step 3 — Configure the Invocation

1. In the left sidebar, go to **Develop** → **Invocation**.
2. Set a display name (e.g. `Open Jiuwen`).
3. Click **Save**.

---

## Step 4 — Create a Main Scene

1. Go to **Develop** → **Scenes** → **+** to add a new scene, name it `Main`.
2. Under **On enter**, add a **Call your webhook** condition with handler name `default_handler`.
3. Under **Wait for user input**, add a free-form slot that captures the full utterance.
4. After the slot is filled, add another **Call your webhook** action.
5. This creates a loop: Google calls webhook → speaks reply → listens → calls webhook again.

---

## Step 5 — Set the Fulfillment Webhook

1. Go to **Develop** → **Webhook**.
2. Select **HTTPS endpoint**.
3. Set the URL to:
   ```
   https://<your-host>/fulfillment
   ```
4. Click **Save**.

For local development, use ngrok:
```bash
ngrok http 8080
# Copy the https://... URL and paste it as the webhook URL above
```

---

## Step 6 — Start the Server

```bash
python -m channels.run google_assistant
```

With a custom backend:
```bash
python -m channels.run google_assistant --backend-url http://my-server:8000
```

With API key protection:
```bash
python -m channels.run google_assistant --api-key mysecret
```

---

## All Options

| Option | Required | Description |
|---|---|---|
| `--host HOST` | No | Bind address. Default: `0.0.0.0`. Env: `GA_HOST` |
| `--port PORT` | No | Listen port. Default: `8080`. Env: `GA_PORT` |
| `--backend-url URL` | No | OpenJiuwen backend URL. Default: `http://localhost:8000`. Env: `BACKEND_URL` |
| `--access-token TOKEN` | No | Static backend token. Env: `ACCESS_TOKEN` |
| `--api-key KEY` | No | Protect fulfillment with `X-API-Key` header. Env: `GA_API_KEY` |

---

## Available Commands (speak these)

| What to say | What it does |
|---|---|
| `login` | Log in to the backend |
| `logout` | Log out |
| `status` | Check login status |
| `cancel` | Cancel any active operation |
| `health` | Check backend connectivity |
| `help` | Hear all available commands |
| `workflows` | List all workflows |
| `workflows search <query>` | Search workflows by keyword |
| `workflow execute <id>` | Run a workflow (asks for parameters via voice) |
| `workflow skip` | Skip an optional parameter |
| `workflow cancel` | Cancel parameter collection |
| `agents` | List all agents |
| `agents search <query>` | Search agents by keyword |
| `agent execute <id> <message>` | Send a single message to an agent |
| `agent start <id>` | Start an interactive chat session |
| `agent end` | End the current chat |

---

## How It Works

1. User invokes the Action by saying *"Hey Google, talk to Open Jiuwen"*.
2. Google calls `POST /fulfillment` with the session ID and the user's text.
3. The server parses the command and calls the appropriate OpenJiuwen API.
4. The response is returned as spoken text within the same HTTP response.
5. Google reads it aloud, then listens for the next command.

**Note:** Google Assistant has a **10-second fulfillment timeout**. Workflow executions that take longer will time out. For long-running workflows, consider using the Webhook channel and triggering asynchronously.

---

## Token Storage

User session tokens are stored in:

```
channels/platforms/google_assistant/.google_assistant_tokens.json
```

Tokens are keyed by Google's session ID. Because Google Actions sessions are
temporary, returning users will need to log in again in a new session.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Google says "There was a glitch" | Check server logs — likely a Python exception or timeout |
| Webhook verification fails | Make sure the server is reachable at the HTTPS URL |
| ngrok session expired | Restart ngrok and update the webhook URL in Actions Console |
| 10-second timeout | The workflow took too long — try the Webhook channel instead |
| Commands not recognised | Google STT may transcribe differently — check logs for actual `query` value |
