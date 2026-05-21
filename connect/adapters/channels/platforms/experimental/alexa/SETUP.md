# Amazon Alexa Skill Setup

## Overview

This adapter connects OpenJiuwen to Amazon Alexa as a custom skill using the Alexa Skills Kit (ASK) fulfillment webhook. Users interact via voice commands which are converted to text and dispatched to OpenJiuwen.

## Prerequisites

- An Amazon Developer account at [developer.amazon.com](https://developer.amazon.com)
- A publicly accessible HTTPS server
- Alexa-compatible device or the Alexa app for testing

## Step-by-Step Setup

### 1. Create an Alexa Skill

1. Go to [developer.amazon.com/alexa/console/ask](https://developer.amazon.com/alexa/console/ask)
2. Click **Create Skill**
3. Name your skill (e.g., "OpenJiuwen")
4. Select **Custom** model and **Provision your own** hosting
5. Click **Create Skill**

### 2. Configure the Interaction Model

Add a single flexible intent that captures any spoken command:

1. In the **Build** tab, go to **Interaction Model** -> **Intents**
2. Create a new intent named **CommandIntent**
3. Add a slot named **Command** with slot type **AMAZON.SearchQuery**
4. Add sample utterances:
   - `{Command}`
   - `tell me {Command}`
   - `I want to {Command}`
   - `please {Command}`
5. Also ensure these built-in intents are present:
   - `AMAZON.HelpIntent`
   - `AMAZON.CancelIntent`
   - `AMAZON.StopIntent`
6. Click **Save Model** then **Build Model**

### 3. Configure the Endpoint

1. In the **Build** tab, go to **Endpoint**
2. Select **HTTPS**
3. Set the **Default Region** URL to: `https://<your-host>/`
4. For the SSL certificate, select **My development endpoint has a certificate from a trusted certificate authority** (if using Let's Encrypt or similar)
5. Click **Save Endpoints**

### 4. Start the Bot

```bash
# Basic usage
python -m channels.run alexa

# With options
python -m channels.run alexa \
    --backend-url http://localhost:8000 \
    --port 8080 \
    --skill-id amzn1.ask.skill.your-skill-id

# Using environment variables
export BACKEND_URL=http://localhost:8000
export ALEXA_SKILL_ID=amzn1.ask.skill.your-skill-id
python -m channels.run alexa
```

### 5. Expose Your Server (for local development)

Use [ngrok](https://ngrok.com) or similar:

```bash
ngrok http 8080
```

Use the ngrok HTTPS URL as your endpoint in the Alexa Developer Console.

### 6. Test Your Skill

1. In the **Test** tab, enable testing for your skill
2. Type or say: "Open OpenJiuwen"
3. Then: "help" to hear available commands

## How It Works

1. User says: **"Alexa, ask OpenJiuwen to list workflows"**
2. Alexa sends an `IntentRequest` with `CommandIntent` and `Command` slot value `"list workflows"`
3. This server routes `"list workflows"` through the handler pipeline
4. The response is returned as Alexa JSON with `outputSpeech.text`
5. Alexa reads the response aloud

## Voice-Friendly Design

Responses are optimized for speech:
- No markdown formatting (no `**bold**`, `_italic_`, `#headers`)
- Complete sentences instead of bullet points
- Items are joined with commas for natural speech
- Confirmations use full words ("Logged in successfully" not "Done")

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `ALEXA_HOST` | Bind address | `0.0.0.0` |
| `ALEXA_PORT` | Listen port | `8080` |
| `BACKEND_URL` | OpenJiuwen backend URL | `http://localhost:8000` |
| `ACCESS_TOKEN` | Static backend auth token | (none) |
| `ALEXA_SKILL_ID` | Your Alexa Skill ID for validation | (none) |

## Available Voice Commands

| Say... | Action |
|---|---|
| help | Hear available commands |
| start | Introduction |
| health | Backend health check |
| login | Log in to OpenJiuwen |
| logout | Log out |
| status | Show login status |
| workflows | List all workflows |
| workflow run [name] | Run a workflow |
| agents | List all agents |
| agent run [name] | Start agent chat |

## Troubleshooting

**"There was a problem with the requested skill's response":**
- Check your server logs for Python errors
- Ensure the response JSON matches Alexa's expected format
- Verify the endpoint URL is correct and accessible

**Skill not responding:**
- Check that your HTTPS certificate is valid (Alexa requires HTTPS with a trusted CA)
- Verify the endpoint URL is saved in the developer console
- Test with ngrok first to isolate server issues

**Intent not triggered:**
- Make sure the `CommandIntent` has `AMAZON.SearchQuery` slot type for the `Command` slot
- Rebuild the interaction model after any changes

## Security Note

For production, consider:
1. Using the ASK SDK's built-in request verification (checks Alexa's signing certificate)
2. Setting `--skill-id` to restrict requests to your specific skill
3. Running behind a reverse proxy (nginx/Caddy) with proper TLS termination
