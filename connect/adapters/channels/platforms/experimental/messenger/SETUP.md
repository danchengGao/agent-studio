# Facebook Messenger Platform Setup

## Overview

This adapter connects OpenJiuwen to Facebook Messenger using Meta's Messenger Platform webhook API.
Messages are received via a webhook (`POST /webhook`) and replies are sent via the Graph API.

## Prerequisites

- A Facebook account
- A Facebook Page (the bot will respond as this page)
- A Meta Developer account at [developers.facebook.com](https://developers.facebook.com)

## Step-by-Step Setup

### 1. Create a Meta App

1. Go to [developers.facebook.com](https://developers.facebook.com) and click **My Apps → Create App**
2. Select **Business** as the app type
3. Give your app a name and click **Create App**

### 2. Add the Messenger Product

1. In your app dashboard, click **Add Product**
2. Find **Messenger** and click **Set Up**

### 3. Generate a Page Access Token

1. In the Messenger settings, scroll to **Access Tokens**
2. Click **Add or Remove Pages** and connect your Facebook Page
3. Click **Generate Token** next to your page
4. Copy the token — this is your `PAGE_ACCESS_TOKEN`

### 4. Configure the Webhook

1. In Messenger settings, scroll to **Webhooks**
2. Click **Add Callback URL**
3. Enter your public URL: `https://<your-host>/webhook`
4. Enter a **Verify Token** — this must match the `--verify-token` flag you pass to the launcher
5. Click **Verify and Save**
6. Under **Webhook Fields**, subscribe to: `messages`

### 5. Start the Bot

```bash
# Basic usage
python -m channels.run messenger <PAGE_ACCESS_TOKEN>

# With custom verify token
python -m channels.run messenger <PAGE_ACCESS_TOKEN> \
    --verify-token my_secret_token \
    --backend-url http://localhost:8000 \
    --port 8080

# Using environment variables
export PAGE_ACCESS_TOKEN=EAABwzLixnjYBO...
export MESSENGER_VERIFY_TOKEN=my_secret_token
export BACKEND_URL=http://localhost:8000
python -m channels.run messenger $PAGE_ACCESS_TOKEN
```

### 6. Expose Your Server (for local development)

Use [ngrok](https://ngrok.com) or similar:

```bash
ngrok http 8080
```

Then use the ngrok HTTPS URL as your webhook callback URL in Meta Developer Portal.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `MESSENGER_VERIFY_TOKEN` | Webhook verification token | `openjiuwen_verify` |
| `BACKEND_URL` | OpenJiuwen backend URL | `http://localhost:8000` |
| `ACCESS_TOKEN` | Static backend auth token | (none) |
| `HOST` | Bind address | `0.0.0.0` |
| `PORT` | Listen port | `8080` |

## Bot Commands

Once connected, users can send these commands in Messenger:

| Command | Description |
|---|---|
| `help` | Show all commands |
| `start` | Introduction and quick start |
| `health` | Backend health check |
| `login` | Log in to OpenJiuwen |
| `logout` | Log out |
| `status` | Show login status |
| `workflows` | List all workflows |
| `workflow run <name>` | Run a workflow |
| `agents` | List all agents |
| `agent run <name>` | Start agent chat |

## Troubleshooting

**Webhook verification fails:**
- Ensure `--verify-token` matches exactly what you entered in Meta Developer Portal
- Check that your server is publicly accessible via HTTPS

**Messages not received:**
- Verify your page is subscribed to the `messages` webhook field
- Check the Meta Developer Portal → Webhooks → Test button

**Token expired:**
- Page Access Tokens from the portal can expire; use a System User token for production
- Go to Business Settings → System Users to generate a non-expiring token
