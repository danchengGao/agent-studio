# Connect — MCP Server

The MCP server exposes your OpenJiuwen agents and workflows as **MCP (Model Context Protocol) tools**
so that any MCP-compatible AI client — such as **Claude Desktop** or **JiuwenClaw** —
can discover and invoke them autonomously.

## How It Works

```
# stdio (default) — client launches server as a subprocess
MCP client  ──stdio──►  mcp_server  ──HTTP──►  OpenJiuwen backend

# SSE — server runs persistently; clients connect over HTTP
MCP client  ──SSE───►  mcp_server  ──HTTP──►  OpenJiuwen backend
```

- **stdio transport** (default): the MCP client spawns the server as a subprocess. Simplest setup; suited for desktop clients like Claude Desktop.
- **SSE transport**: the server runs as a persistent HTTP process; clients connect via URL. Suited for remote or shared deployments.
- Auth: **static token** configured once at startup. No per-user login; one shared client handles all requests.

## Prerequisites

1. Python 3.10+
2. OpenJiuwen backend running (default: `http://localhost:8000`)
3. A valid access token for the backend

### Get a Token

Use the CLI to log in and obtain a token:

```bash
python -m connect.adapters.channels.run cli --backend-url http://localhost:8000 login
```

The token is saved to `connect/adapters/channels/platforms/cli/.cli_tokens.json`. Copy the value
from `"token": "..."`.

## Installation

```bash
pip install -r connect/adapters/mcp_server/requirements.txt
```

## Running Manually (for Testing)

```bash
# stdio transport (default) — process waits for MCP messages on stdin
python -m connect.adapters.mcp_server \
  --token YOUR_TOKEN \
  --backend-url http://localhost:8000

# SSE transport — starts HTTP server, clients connect via URL
python -m connect.adapters.mcp_server \
  --token YOUR_TOKEN \
  --backend-url http://localhost:8000 \
  --transport sse \
  --host 0.0.0.0 \
  --port 8080
# → listening at http://0.0.0.0:8080/sse
```

## Connecting an MCP Client

### Claude Desktop

Add the following to your Claude Desktop config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**stdio transport** (Claude Desktop spawns the server):

```json
{
  "mcpServers": {
    "openjiuwen": {
      "command": "/usr/local/bin/python3.12",
      "args": [
        "-m", "connect.adapters.mcp_server",
        "--backend-url", "http://localhost:8000",
        "--token", "YOUR_TOKEN_HERE"
      ],
      "cwd": "/path/to/agent-studio"
    }
  }
}
```

> Replace `command` with the path to your Python interpreter (`which python3.12`).
> `cwd` must point to the project root. Restart Claude Desktop after editing the config.

**SSE transport** (server must already be running with `--transport sse`):

```json
{
  "mcpServers": {
    "openjiuwen": {
      "url": "http://localhost:8080/sse"
    }
  }
}
```

### JiuwenClaw

JiuwenClaw is a personal AI assistant (from the same product family as OpenJiuwen) that supports
MCP server connections. When connected to OpenJiuwen, JiuwenClaw can call your agents and
workflows as part of its own reasoning — using structured workflows to handle tasks it would
otherwise solve step by step.

Register this server as an MCP tool in JiuwenClaw's MCP client settings, using the same
`command`, `args`, and `cwd` as in the Claude Desktop example above. Refer to the JiuwenClaw
documentation for the exact configuration format.

### Any Other MCP-Compatible Client

- **stdio**: launch the server as a subprocess with `--token` and `--backend-url`; set `cwd` to the project root.
- **SSE**: start the server with `--transport sse`, then point the client at `http://HOST:PORT/sse`.

## Available Tools

| Tool | Description |
|------|-------------|
| `health_check()` | Verify backend connectivity |
| `list_agents(page?, page_size?)` | Paginated list of agents |
| `search_agents(keyword)` | Search agents by name/description |
| `get_agent(agent_id)` | Show agent definition (description, model, tools) |
| `run_agent(agent_id, message, conversation_id?)` | Chat with an agent; returns reply + conversation_id |
| `reset_agent(conversation_id)` | Discard a conversation (start fresh next call) |
| `list_workflows(page?, page_size?)` | Paginated list of workflows |
| `search_workflows(keyword)` | Search workflows by name/description |
| `get_workflow(workflow_id)` | Show workflow definition and required inputs |
| `run_workflow(workflow_id, inputs?)` | Execute a workflow and return its outputs |

### Multi-Turn Agent Conversations

```
Client:  run_agent("agent-123", "Hello!")
         → Reply: Hi there! How can I help?
           Conversation ID: conv-abc
Client:  run_agent("agent-123", "Tell me a joke", conversation_id="conv-abc")
         → Reply: ...
```

Pass the `conversation_id` from each response back to the next `run_agent` call to maintain context.

## Environment Variables

All CLI arguments can also be set via environment variables:

| Variable | CLI flag | Description |
|----------|----------|-------------|
| `OJ_TOKEN` | `--token` | Backend access token (required) |
| `OJ_BACKEND_URL` | `--backend-url` | Backend URL (default: `http://localhost:8000`) |
| `OJ_TRANSPORT` | `--transport` | Transport type: `stdio` or `sse` (default: `stdio`) |
| `OJ_HOST` | `--host` | SSE server bind host (default: `0.0.0.0`) |
| `OJ_PORT` | `--port` | SSE server port (default: `8080`) |

## Troubleshooting

**`ModuleNotFoundError: No module named 'channels'`**
: Make sure `cwd` points to the project root (`agent-studio/`), not a subdirectory.

**`ModuleNotFoundError: No module named 'mcp'`**
: Run `pip install -r connect/adapters/mcp_server/requirements.txt` in your Python environment.

**`ERROR: --token is required`**
: Set `--token` in the args list or set the `OJ_TOKEN` environment variable.

**Tools appear in the client but return "Could not reach backend"**
: Verify the OpenJiuwen backend is running and `--backend-url` is correct.
  Test with: `python -m connect.adapters.mcp_server --token YOUR_TOKEN` and watch for errors.

**Token expired / 401 errors**
: Log in again via the CLI and update the token in your MCP client's config, then restart the client.
