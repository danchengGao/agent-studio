# WhatsApp Bot Setup Guide

The WhatsApp bot uses the **Meta WhatsApp Cloud API**.  Meta calls your
webhook whenever a user sends a message; the bot replies by calling the
Graph API.  You need a Meta Developer account and (for local development)
a public HTTPS tunnel such as **ngrok**.

No extra Python packages are required — `requests` and `aiohttp` are
already in `requirements.txt`.

---

## Prerequisites

- Python 3.9+
- Meta Developer account at [developers.facebook.com](https://developers.facebook.com/)
- [ngrok](https://ngrok.com/) (for local development)

---

## Step 1 — Install Dependencies

```bash
pip install -r channels/requirements.txt
```

---

## Step 2 — Create a Meta App

1. Go to [Meta for Developers](https://developers.facebook.com/) → **My Apps** → **Create App**.
2. Select **Business** as the app type, click **Next**.
3. Give your app a name (e.g. `OpenJiuwen Bot`) and click **Create App**.

---

## Step 3 — Add the WhatsApp Product

1. In your app dashboard, scroll to **Add Products to Your App**.
2. Find **WhatsApp** and click **Set Up**.
3. You will land on the **WhatsApp → API Setup** page.

---

## Step 4 — Get Your Credentials

On the **WhatsApp → API Setup** page you will find:

| Field | Where to find it |
|---|---|
| **Phone Number ID** | "From" section — copy the number ID |
| **Access Token** | "Temporary access token" (lasts 24h for testing) or create a permanent one |

For a **permanent token** (required for production):
1. Go to **Business Settings** → **System Users** → **Add**.
2. Create a system user with **Admin** role.
3. Click **Add Assets** → select your app → grant access.
4. Click **Generate New Token** → select your app → choose `whatsapp_business_messaging` scope.
5. Copy and save the token — it does not expire.

---

## Step 5 — Expose Your Local Server (Development)

```bash
ngrok http 8080
```

ngrok prints a forwarding URL like `https://abc123.ngrok-free.app`.
Copy it — you will need it in the next step.

---

## Step 6 — Configure the Webhook

1. In Meta App dashboard → **WhatsApp** → **Configuration** → **Webhook**.
2. Click **Edit**.
3. Set **Callback URL** to:
   ```
   https://<your-ngrok-url>/webhook
   ```
4. Set **Verify token** to a string you choose — e.g. `openjiuwen_verify`.
   You will pass this same value to the bot via `--verify-token`.
5. Click **Verify and Save**.  *(The bot must be running for this to succeed.)*
6. After saving, click **Manage** next to the webhook and subscribe to:
   - `messages`

---

## Step 7 — Add a Test Phone Number

For development, Meta provides a free test number:

1. **WhatsApp → API Setup** → "To" section → **Add phone number**.
2. Enter your personal WhatsApp number and verify it with the OTP.
3. You can now message the test bot from your phone.

For production you need to apply for a dedicated number.

---

## Step 8 — Start the Bot

First start ngrok (if not already running), then:

```bash
python -m channels.run whatsapp <ACCESS_TOKEN> <PHONE_NUMBER_ID> \
  --verify-token openjiuwen_verify
```

With a custom backend URL:

```bash
python -m channels.run whatsapp <ACCESS_TOKEN> <PHONE_NUMBER_ID> \
  --verify-token openjiuwen_verify \
  --backend-url http://my-server:8000
```

Using environment variables:

```bash
export BACKEND_URL=http://my-server:8000
export WHATSAPP_VERIFY_TOKEN=openjiuwen_verify
python -m channels.run whatsapp TOKEN PHONE_ID
```

---

## Available Commands

Once the bot is running, send these messages from WhatsApp:

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
| `workflow cancel` | Cancel parameter collection |
| `agents` | List all agents |
| `agents search <query>` | Search agents by keyword |
| `agent run <id> <message>` | Send a single message to an agent |
| `agent chat <id>` | Start an interactive chat session |
| `end chat` | End the current chat session |

WhatsApp supports basic formatting in message bodies:
- `*bold*`
- `_italic_`
- `~strikethrough~`
- `` `monospace` ``

---

## Token Storage

User session tokens are stored in:

```
channels/platforms/whatsapp/.whatsapp_bot_tokens.json
```

Each token is keyed by the user's WhatsApp phone number (e.g. `15551234567`).

This file is listed in `.gitignore` and will not be committed.

---

## Production Deployment

For a production environment:

1. Obtain a dedicated WhatsApp number (apply via Meta Business Manager).
2. Generate a non-expiring system user access token (see Step 4 above).
3. Deploy the bot server with a valid TLS certificate.
4. Update the Webhook Callback URL in Meta to your production URL.
5. Do **not** hard-code the access token — use environment variables or a
   secrets manager.

Example systemd service:

```ini
[Unit]
Description=OpenJiuwen WhatsApp Bot
After=network.target

[Service]
WorkingDirectory=/opt/openjiuwen
ExecStart=python -m channels.run whatsapp \
          WHATSAPP_ACCESS_TOKEN PHONE_NUMBER_ID \
          --backend-url http://localhost:8000 \
          --verify-token mysecret \
          --port 8080
Restart=always
EnvironmentFile=/opt/openjiuwen/.env

[Install]
WantedBy=multi-user.target
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Webhook verification fails | Make sure the bot is running before clicking "Verify and Save" in Meta |
| `--verify-token` mismatch | The value passed to `--verify-token` must exactly match what you set in Meta Portal |
| Messages not delivered | Check that the `messages` webhook field is subscribed |
| `401 Unauthorized` from Graph API | The access token has expired — generate a new one or use a permanent token |
| ngrok session expired | Restart ngrok and update the Webhook Callback URL in Meta Portal |
| Non-text messages ignored | The bot only processes text messages; images, audio, etc. are silently ignored |
| Test number limit | Meta test numbers can only send to verified personal numbers (max 5 recipients) |
