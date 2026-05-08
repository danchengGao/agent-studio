# WeChat Official Account Setup

## Overview

This adapter connects OpenJiuwen to WeChat Official Account using the WeChat Open Platform webhook API.
Messages are received as XML and replies are sent synchronously in the HTTP response body.

## Prerequisites

- A WeChat Official Account (Subscription Account or Service Account)
- A publicly accessible HTTPS server
- Your AppID and AppSecret from the Official Account settings

## Step-by-Step Setup

### 1. Get Your AppID and AppSecret

1. Log in to [mp.weixin.qq.com](https://mp.weixin.qq.com)
2. Go to **Development** -> **Basic Configuration**
3. Copy your **AppID** and **AppSecret**

### 2. Configure the Server

1. Go to **Development** -> **Basic Configuration** -> **Server Configuration**
2. Click **Modify Configuration**
3. Set **URL** to: `https://<your-host>/webhook`
4. Set **Token** — this is your `WECHAT_TOKEN` (choose any string)
5. Set **EncodingAESKey** — click "Random Generate" (optional encryption, not required for basic use)
6. Select **Message Encryption Mode**: Plain Text (for simplest setup)
7. Click **Submit** — WeChat will immediately send a GET verification request

### 3. Start the Bot

The bot must be running before you click Submit in step 7:

```bash
# Basic usage
python -m channels.run wechat <WECHAT_TOKEN> <APP_ID> <APP_SECRET>

# With all options
python -m channels.run wechat my_token wx1234567890 secret1234 \
    --backend-url http://localhost:8000 \
    --port 8080

# Using environment variables
export WECHAT_TOKEN=my_token
export BACKEND_URL=http://localhost:8000
python -m channels.run wechat $WECHAT_TOKEN wx1234567890 secret1234
```

### 4. Expose Your Server (for local development)

Use [ngrok](https://ngrok.com) or similar:

```bash
ngrok http 8080
```

Use the ngrok HTTPS URL as your server URL in WeChat Official Account settings.

## Message Flow

WeChat uses a synchronous reply model:
1. User sends a message
2. WeChat forwards it to your webhook via POST
3. **Your server must reply within 5 seconds** with an XML response
4. For longer replies or multiple messages, use the Customer Service Messages API (requires AppID + AppSecret)

This adapter handles this automatically:
- First reply -> sent as synchronous XML in the HTTP response
- Additional replies -> sent via Customer Service API

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `BACKEND_URL` | OpenJiuwen backend URL | `http://localhost:8000` |
| `ACCESS_TOKEN` | Static backend auth token | (none) |
| `HOST` | Bind address | `0.0.0.0` |
| `PORT` | Listen port | `8080` |

## Bot Commands

Users can send these commands in WeChat:

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
| `agent end` | End agent chat |

## Limitations

- **5-second timeout**: WeChat requires a response within 5 seconds. Complex workflows may exceed this; the first reply is sent synchronously and subsequent ones via Customer Service API.
- **Customer Service API**: Only available for Service Accounts with the Customer Service permission. Subscription Accounts can only use synchronous replies.
- **Verified accounts only**: Some features require a verified Official Account.

## Troubleshooting

**Server verification fails:**
- Make sure your server is running before clicking Submit in WeChat settings
- Verify the token matches exactly
- Ensure your server is accessible via HTTPS (WeChat requires HTTPS)

**Messages not received:**
- Check that your Official Account has messaging permissions enabled
- In WeChat Developer Settings, ensure the server configuration is saved and active

**Customer Service API errors:**
- Error 48001: Insufficient permissions — your account may not have Customer Service API access
- This is non-critical; the synchronous reply still works
