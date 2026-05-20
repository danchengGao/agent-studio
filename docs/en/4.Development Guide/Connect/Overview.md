# Connect - Channels and MCP

## Overview

OpenJiuwen Connect extends the reach of your agents and workflows beyond the browser, making them accessible from messaging apps, terminal, and AI assistants. It consists of two main components:

- **Channels** — Bring OpenJiuwen into platforms where people already work (Telegram, Slack, Email, CLI, Webhook, etc.)
- **MCP (Model Context Protocol)** — Enable AI assistants to autonomously call your agents and workflows as tools

## Why Connect?

High effort means low usage. A brilliant AI that requires opening a browser and navigating to a specific page is less useful than one you can reach from wherever you already are. Connect solves this by:

1. **For People** — Run agents and workflows directly from messaging apps or terminal
2. **For AI Assistants** — Let AI tools autonomously use your OpenJiuwen capabilities

## Channels

### What Are Channels?

Channels bring OpenJiuwen into the apps and environments you use every day. Instead of opening a browser, you type a message wherever you are, and OpenJiuwen responds in the same place.

### Capabilities

From any channel, users can:

- **Run agents** — Start and continue multi-turn conversations with any agent
- **Execute workflows** — Trigger workflows; if inputs are needed, the bot collects them interactively
- **Browse library** — List and search agents and workflows
- **Manage sessions** — Log in, log out, check connection status

### Supported Platforms

#### Production-Ready

| Platform | Best For |
|----------|----------|
| **CLI** | Developers and power users who work in the terminal |
| **Email** | Anyone — universal access with no client-side setup |
| **Telegram** | Technical users and communities |
| **Slack** | Workplace teams |
| **Webhook** | Custom systems, products, or internal tools via HTTP |

#### Experimental

| Platform | Best For |
|----------|----------|
| **WeChat** | Users in the Chinese market |
| **Discord** | Developer communities |
| **WhatsApp** | Personal and team use |
| **Microsoft Teams** | Enterprise Microsoft environments |
| **Facebook Messenger** | Consumer-facing use cases |
| **GitHub** | Developers working from issues and PRs |
| **Google Assistant** | Voice and smart home users |
| **SMS (Twilio)** | Mobile-first plain-text access |
| **Amazon Alexa** | Hands-free voice environments |

### Authentication

Each user authenticates with their own OpenJiuwen account directly inside the app. Their agents, workflows, and conversation history remain personal and private.

## MCP (Model Context Protocol)

### What Is MCP?

MCP is an open standard that lets AI assistants call external tools during conversations. When OpenJiuwen is connected as an MCP tool, compatible AI assistants can autonomously discover and run your agents and workflows.

### How It Works

You describe what you want in natural language to your AI assistant. The assistant decides when and how to use OpenJiuwen as a tool — without you typing commands or opening the browser.

```
You: "Find the onboarding workflow and run it for Alice."

AI Assistant: [searches OpenJiuwen, inspects workflow inputs, runs it]
             "Done. The onboarding workflow completed for Alice."
```

### Capabilities

AI assistants connected via MCP can:

- **Find agents** — Search and browse your agent library
- **Talk to agents** — Run multi-turn conversations with context preservation
- **Find workflows** — Search and inspect your workflow library
- **Run workflows** — Execute workflows with proper inputs and retrieve results
- **Check status** — Verify backend reachability before taking action

### Compatible AI Assistants

Any AI assistant that implements MCP can connect to OpenJiuwen:

- **Claude Desktop** (by Anthropic) — Configure OpenJiuwen as an MCP server
- **JiuwenClaw** — Personal AI assistant with persistent memory that uses OpenJiuwen workflows as structured capabilities

## Installation

### Backend Integration

The Connect feature is automatically installed when you deploy OpenJiuwen Studio:

1. **Dependencies** — All required packages (python-telegram-bot, slack-bolt, discord.py, botbuilder-core, mcp, etc.) are included in the backend's `pyproject.toml`

2. **Docker Installation** — The Connect module is automatically copied and configured in the Docker image with proper PYTHONPATH settings

3. **Local Development** — For local development, the Connect module is available at `connect/` in the project root

### Setting Up Channels

Each platform has its own setup guide in this folder:

- [CLI](Channels/CLI.md) — Terminal interface, no third-party service needed
- [Email](Channels/Email.md) — IMAP/SMTP polling, works with any email provider
- [Telegram](Channels/Telegram.md) — Telegram bot via BotFather
- [Slack](Channels/Slack.md) — Slack app with Socket Mode
- [Webhook](Channels/Webhook.md) — HTTP REST API for external integrations

Platform-specific `SETUP.md` files are also available in the source tree:

```
connect/adapters/channels/platforms/
├── cli/SETUP.md
├── email/SETUP.md
├── telegram/SETUP.md
├── slack/SETUP.md
├── webhook/SETUP.md
└── experimental/
    ├── wechat/SETUP.md
    ├── discord/SETUP.md
    └── ... (other platforms)
```

### Setting Up MCP

See the [MCP Server](./MCP%20Server.md) guide in this folder, or refer to `connect/adapters/mcp_server/README.md` in the source tree.

## Architecture

### Connect Client

The Connect client (`connect/client/`) provides:

- **Authentication** — Secure login and session management
- **Agent Operations** — List, search, and interact with agents
- **Workflow Operations** — List, search, and execute workflows

### Adapters

Connect uses adapters to integrate with different platforms:

- **Channels Adapter** (`connect/adapters/channels/`) — Handles messaging platform integrations
- **MCP Server Adapter** (`connect/adapters/mcp_server/`) — Implements the Model Context Protocol

## Development

### Project Structure

```
connect/
├── client/              # Core client library
│   ├── auth/           # Authentication logic
│   ├── agents/         # Agent operations
│   ├── workflows/      # Workflow operations
│   └── config.py       # Configuration
├── adapters/
│   ├── channels/       # Messaging platform adapters
│   │   ├── platforms/  # Platform-specific implementations
│   │   ├── HOW_IT_WORKS.md
│   │   └── requirements.txt
│   └── mcp_server/     # MCP protocol implementation
│       ├── README.md
│       └── requirements.txt
└── README.md           # Full Connect documentation
```

### Adding a New Channel

1. Create a new platform directory under `connect/adapters/channels/platforms/`
2. Implement the platform-specific bot logic using the Connect client
3. Add authentication flow for user login
4. Add a `SETUP.md` with configuration instructions
5. Test with real users and agents

## Key Concepts

### Build Once, Reach Everywhere

Agents and workflows built in the OpenJiuwen web interface are automatically available through all channels and MCP connections. No duplicate configuration needed.

### The Web Interface Is the Studio

Channels and MCP are for **usage**, not **authoring**. Build and edit agents/workflows in the browser; run them from anywhere.

### Personal Sessions

In channels, each user logs in with their own account. Their agents, workflows, and history are isolated and private.

## More Information

For comprehensive documentation and design details, see:

- `connect/README.md` — Full Connect overview and philosophy
- `connect/adapters/channels/ARCHITECTURE.md` — Deep technical design
- `connect/adapters/channels/HOW_IT_WORKS.md` — End-to-end execution flow
- `connect/adapters/mcp_server/README.md` — MCP server setup
- Platform-specific `SETUP.md` files — Individual platform configuration
