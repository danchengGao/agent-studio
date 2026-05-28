# Twilio SMS — Setup Guide

Send SMS to your Twilio number and get replies from OpenJiuwen.

## Prerequisites

- A [Twilio account](https://console.twilio.com) (free trial works)
- A Twilio phone number with SMS capability
- Python deps: `pip install aiohttp` (already in `channels/requirements.txt`)
- A public HTTPS URL (use [ngrok](https://ngrok.com) for local development)

## Step-by-step

### 1. Get your Twilio credentials

Log in to [console.twilio.com](https://console.twilio.com).

On the **Account Info** panel (home page) you will find:
- **Account SID** — starts with `AC...`
- **Auth Token** — click the eye icon to reveal

### 2. Get a Twilio phone number

Go to **Phone Numbers → Manage → Active Numbers**.
If you don't have one, click **Buy a number** and pick one with SMS capability.

### 3. Configure the webhook

Click your phone number. Under **Messaging → "A MESSAGE COMES IN"**:
- Set the webhook URL to: `https://<your-host>/sms`
- Method: `HTTP POST`
- Save.

### 4. Expose your server with ngrok (local dev)

```bash
ngrok http 8080
```

Copy the `https://....ngrok.io` URL and use it as the Twilio webhook.

### 5. Run the bot

```bash
python -m channels.run twilio <ACCOUNT_SID> <AUTH_TOKEN> <FROM_NUMBER>
```

| Argument | Example |
|---|---|
| `ACCOUNT_SID` | `AC1234567890abcdef` |
| `AUTH_TOKEN` | `your_auth_token` |
| `FROM_NUMBER` | `+15551234567` (your Twilio number, E.164 format) |

### 6. Test it

Send an SMS to your Twilio number:
```
help
```

---

## All Options

```
python -m channels.run twilio <ACCOUNT_SID> <AUTH_TOKEN> <FROM_NUMBER> [OPTIONS]
```

| Option | Default | Description |
|---|---|---|
| `--backend-url URL` | `http://localhost:8000` | OpenJiuwen backend URL. Env: `BACKEND_URL` |
| `--access-token TOKEN` | _(none)_ | Static backend token — skips per-user login. Env: `ACCESS_TOKEN` |
| `--host HOST` | `0.0.0.0` | Bind address. Env: `HOST` |
| `--port PORT` | `8080` | Listen port. Env: `PORT` |
| `--verify-signatures` | _(off)_ | Validate `X-Twilio-Signature` (recommended in production) |

---

## Commands (send as SMS text)

| Command | Description |
|---|---|
| `login` | Log in to OpenJiuwen |
| `logout` | Log out |
| `status` | Show login status |
| `cancel` | Cancel active operation |
| `health` | Check backend connectivity |
| `help` | Show all commands |
| `workflows` | List workflows |
| `workflows search <query>` | Search workflows |
| `workflow run <id>` | Run a workflow |
| `agents` | List agents |
| `agents search <query>` | Search agents |
| `agent run <id> <message>` | Run an agent once |
| `agent chat <id>` | Start a multi-turn agent chat |
| `skip` | Skip an optional workflow parameter |

---

## How it Works

1. You send an SMS to your Twilio number
2. Twilio POSTs the message to `POST /sms` on your server
3. The bot parses the command and calls the OpenJiuwen backend
4. The reply is sent back via the Twilio REST API

**No real-time streaming** — the full response is collected before replying.
Long-running workflows may take 10–30 s.

---

## Production Checklist

- [ ] Run behind a reverse proxy with TLS (nginx + Let's Encrypt)
- [ ] Enable `--verify-signatures` to authenticate Twilio requests
- [ ] Set `--access-token` or ensure users log in per-number
- [ ] Consider rate-limiting (one user could trigger many backend calls)

---

## Troubleshooting

| Problem | Solution |
|---|---|
| No reply | Check ngrok is running and webhook URL is correct in Twilio console |
| `Forbidden` response | Check your webhook URL and Auth Token match |
| Login fails | Verify your OpenJiuwen credentials and `--backend-url` |
| SMS truncated | Responses >1600 chars are cut off (Twilio limit) |
