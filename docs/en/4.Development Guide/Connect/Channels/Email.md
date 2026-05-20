# Connect — Email

The Email bot polls an **IMAP inbox** for unread messages and replies via **SMTP**.
It uses only the Python standard library — no extra dependencies are required.

Each sender's email address is used as their persistent user ID, so every person who emails
the bot gets their own session and token.

## How It Works

1. You create a dedicated email account (e.g., `mybot@gmail.com`)
2. You start the email bot with that account's credentials
3. Anyone can email commands to `mybot@gmail.com`
4. The bot reads those emails, processes the commands, and replies

**Example:**
- Start the bot: `python -m connect.adapters.channels.run email imap.gmail.com smtp.gmail.com aibot@gmail.com APP_PASSWORD`
- Send an email to `aibot@gmail.com` with the body: `help`
- The bot replies with the list of available commands
- Reply to that email with your next command — the bot reads it and responds

The first non-quoted, non-empty line of each email body is treated as the command. Quoted reply
text (lines starting with `>`) is stripped automatically, so replying to a bot email just works.

## Prerequisites

- Python 3.9+
- An email account with IMAP enabled (Gmail, Outlook, or any IMAP/SMTP provider)
- A running OpenJiuwen backend

## Installation

```bash
pip install -r connect/adapters/channels/requirements.txt
```

No additional packages are needed for the email bot — it uses only the standard library.

## Step 1 — Enable IMAP on Your Email Account

### Gmail

1. Open Gmail → **Settings** → **See all settings**
2. Go to the **Forwarding and POP/IMAP** tab
3. Under **IMAP access**, select **Enable IMAP** and click **Save Changes**

**Create an App Password (required if 2-Step Verification is on):**

1. Go to [myaccount.google.com](https://myaccount.google.com) → **Security**
2. Under "How you sign in to Google", click **2-Step Verification**
3. Scroll to the bottom → **App passwords**
4. Select **Mail** and your device → click **Generate**
5. Copy the 16-character password — use this as `<PASSWORD>` below

### Outlook / Microsoft 365

1. Sign in to [outlook.com](https://outlook.com) → **Settings** → **Mail** → **Sync email**
2. Enable **IMAP** access
3. IMAP host: `outlook.office365.com`, SMTP host: `smtp-mail.outlook.com`

### Chinese Email Providers (163.com, 188.com, QQ Mail)

Chinese providers require **authorization codes** instead of account passwords:

#### 163.com / 126.com

1. Log in to [mail.163.com](https://mail.163.com) → **Settings** → **POP3/SMTP/IMAP**
2. Enable **IMAP/SMTP Service**
3. Click **Generate Authorization Code** — copy this code (not your account password)
4. IMAP host: `imap.163.com`, SMTP host: `smtp.163.com`

#### 188.com

1. Log in to your 188.com mailbox → **Settings** → **Account Security**
2. Enable **IMAP/SMTP Service** and generate an **Authorization Code**
3. IMAP host: `imap.188.com`, SMTP host: `smtp.188.com`

#### QQ Mail

1. Go to [mail.qq.com](https://mail.qq.com) → **Settings** → **Account**
2. Enable **IMAP/SMTP Service** and generate an **Authorization Code**
3. IMAP host: `imap.qq.com`, SMTP host: `smtp.qq.com`

## Step 2 — Start the Bot

### Gmail

```bash
python -m connect.adapters.channels.run email \
  imap.gmail.com smtp.gmail.com \
  bot@gmail.com APP_PASSWORD
```

### Outlook

```bash
python -m connect.adapters.channels.run email \
  outlook.office365.com smtp-mail.outlook.com \
  bot@outlook.com YOUR_PASSWORD \
  --smtp-port 587
```

### 163.com

```bash
python -m connect.adapters.channels.run email \
  imap.163.com smtp.163.com \
  yourname@163.com AUTHORIZATION_CODE
```

### With custom backend URL

```bash
python -m connect.adapters.channels.run email \
  imap.gmail.com smtp.gmail.com \
  bot@gmail.com APP_PASSWORD \
  --backend-url http://my-server:8000
```

### With slower polling (reduces IMAP load)

```bash
python -m connect.adapters.channels.run email \
  imap.gmail.com smtp.gmail.com \
  bot@gmail.com APP_PASSWORD \
  --poll-interval 30
```

## Configuration Options

| Argument / Option | Required | Default | Description |
|---|---|---|---|
| `IMAP_HOST` | Yes | — | IMAP server hostname |
| `SMTP_HOST` | Yes | — | SMTP server hostname |
| `EMAIL_ADDRESS` | Yes | — | Email address the bot monitors and replies from |
| `PASSWORD` | Yes | — | Email account password or authorization code |
| `--imap-port PORT` | No | `993` | IMAP SSL port. Env: `IMAP_PORT` |
| `--smtp-port PORT` | No | `587` | SMTP STARTTLS port. Env: `SMTP_PORT` |
| `--backend-url URL` | No | `http://localhost:8000` | OpenJiuwen backend URL. Env: `BACKEND_URL` |
| `--access-token TOKEN` | No | — | Static backend token (skips per-user login). Env: `ACCESS_TOKEN` |
| `--poll-interval N` | No | `10` | Seconds between inbox polls. Env: `EMAIL_POLL_INTERVAL` |

## Available Commands

Send these as the first line of an email body to the bot's address:

| Command | Description |
|---------|-------------|
| `login` | Log in to the OpenJiuwen backend |
| `logout` | Log out |
| `status` | Check login status |
| `cancel` | Cancel any active operation |
| `health` | Check backend connectivity |
| `help` | Show all available commands |
| `workflows` | List all workflows |
| `workflows search <query>` | Search workflows by keyword |
| `workflow execute <id>` | Run a workflow (bot replies with parameter prompts) |
| `workflow skip` | Skip an optional parameter |
| `workflow cancel` | Cancel parameter collection |
| `agents` | List all agents |
| `agents search <query>` | Search agents by keyword |
| `agent execute <id> <message>` | Send a single message to an agent |
| `agent chat <id>` | Start an interactive chat session |

Multi-turn flows (login, workflow parameter collection, agent chat) work by replying to the
bot's email. Each reply is read as the next input in the flow.

## Production Deployment

Example systemd service:

```ini
[Unit]
Description=OpenJiuwen Email Bot
After=network.target

[Service]
WorkingDirectory=/opt/openjiuwen
ExecStart=python -m connect.adapters.channels.run email \
          imap.gmail.com smtp.gmail.com \
          bot@gmail.com APP_PASSWORD \
          --backend-url http://localhost:8000 \
          --poll-interval 15
Restart=always
EnvironmentFile=/opt/openjiuwen/.env

[Install]
WantedBy=multi-user.target
```

## Token Storage

User session tokens are stored in `connect/adapters/channels/platforms/email/.email_tokens.json`,
keyed by the sender's email address (lowercase). This file is gitignored.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `IMAP login failed` | Check email/password. For Gmail use an App Password. For Chinese providers (163.com, 188.com, QQ), use an Authorization Code. |
| `SELECT INBOX failed: Unsafe Login` (188.com, 163.com) | This is handled automatically via IMAP ID command. Ensure IMAP/SMTP service is explicitly enabled in mailbox settings and you are using an Authorization Code. |
| `SMTP authentication failed` | Use App Password for Gmail; Authorization Code for Chinese providers. |
| `Connection unexpectedly closed` (SMTP) | The bot tries both STARTTLS (port 587) and SSL (port 465) automatically. Check firewall settings if both fail. |
| Bot doesn't see new emails | Confirm IMAP is enabled in account settings. |
| Commands not recognised | The command must be the very first non-blank line of the email body, not after a quoted reply. |
| Gmail blocks login | Enable IMAP and use an App Password. |
