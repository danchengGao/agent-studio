# OpenJiuwen MCP Server

Exposes your OpenJiuwen agents and workflows as **MCP (Model Context Protocol) tools**
so that any MCP-compatible AI client — such as **Claude Desktop** or **JiuwenClaw** —
can discover and invoke them autonomously.

---

## How it works

```
# stdio (default) — client launches server as a subprocess
MCP client  ──stdio──►  mcp_server  ──HTTP──►  OpenJiuwen backend

# SSE — server runs persistently; clients connect over HTTP
MCP client  ──SSE───►  mcp_server  ──HTTP──►  OpenJiuwen backend
```

- **stdio transport** (default): the MCP client spawns the server as a subprocess. Simplest setup; suited for desktop clients like Claude Desktop.
- **SSE transport**: the server runs as a persistent HTTP process; clients connect via URL. Suited for remote/shared deployments.
- Auth: **static token** configured once in the server settings.
- No per-user login; one shared `OpenJiuwenClient` handles all requests.

---

## Prerequisites

1. **Python 3.10+**
2. **OpenJiuwen backend** running (default: `http://localhost:8000`)
3. A valid **access token** for the backend

### Get a token

The easiest way is to use the OpenJiuwen CLI platform — after logging in, the token is
stored in `channels/platforms/cli/.cli_tokens.json`:

```bash
python -m channels.run cli --backend-url http://localhost:8000
# → /login  → token is saved automatically
cat channels/platforms/cli/.cli_tokens.json
```

Copy the token value from `"token": "..."`.

---

## Installation

```bash
cd /path/to/agent-studio
pip install -r connect/adapters/mcp_server/requirements.txt
```

---

## Running manually (for testing)

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

```
python connect/adapters/mcp_server/server.py --help   # full argument reference
```

---

## Connecting an MCP client

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
      "cwd": "/Users/you/PycharmProjects/openjiuwen/agent-studio"
    }
  }
}
```

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

**Notes:**
- For stdio: replace `command` with the path to your Python interpreter (`which python3.12`); `cwd` must point to the project root.
- The space is auto-selected from your account on startup.
- Restart Claude Desktop after editing the config.

### JiuwenClaw

JiuwenClaw is a personal AI assistant (from the same product family as OpenJiuwen) that
supports MCP server connections. When connected to OpenJiuwen, JiuwenClaw can call on your
OpenJiuwen agents and workflows as part of its own reasoning — using structured workflows to
handle tasks it would otherwise need to solve step by step.

To connect JiuwenClaw to OpenJiuwen, register this server as an MCP tool in JiuwenClaw's
MCP client settings, providing the same command, args, and cwd as in the Claude Desktop
example above. Refer to the JiuwenClaw documentation for the exact configuration format.

Once connected, JiuwenClaw will discover the same 9 tools and can call them autonomously
during any conversation or scheduled task.

### Any other MCP-compatible client

Any MCP-compatible client can use either transport:

- **stdio**: launch the server as a subprocess with `--token` and `--backend-url`; set `cwd` to the project root.
- **SSE**: start the server with `--transport sse`, then point the client at `http://HOST:PORT/sse`.

---

## Available tools

| Tool | Description |
|---|---|
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

### Multi-turn agent conversations

```
Client:  run_agent("agent-123", "Hello!")
         → Reply: Hi there! How can I help?
           Conversation ID: conv-abc
Client:  run_agent("agent-123", "Tell me a joke", conversation_id="conv-abc")
         → Reply: ...
```

---

## Environment variables

All CLI arguments can also be set via environment variables:

| Variable | CLI flag | Description |
|---|---|---|
| `OJ_TOKEN` | `--token` | Backend access token (required) |
| `OJ_BACKEND_URL` | `--backend-url` | Backend URL (default: `http://localhost:8000`) |
| `OJ_TRANSPORT` | `--transport` | Transport type: `stdio` or `sse` (default: `stdio`) |
| `OJ_HOST` | `--host` | SSE server bind host (default: `0.0.0.0`) |
| `OJ_PORT` | `--port` | SSE server port (default: `8080`) |

---

## Troubleshooting

**`ModuleNotFoundError: No module named 'channels'`**
: Make sure `cwd` points to the project root (`agent-studio/`), not a subdirectory.

**`ModuleNotFoundError: No module named 'mcp'`**
: Run `pip install -r connect/mcp_server/requirements.txt` in your Python environment.

**`ERROR: --token is required`**
: Set `--token` in the args list or set the `OJ_TOKEN` environment variable.

**Tools appear in the client but return "Could not reach backend"**
: Verify the OpenJiuwen backend is running and `--backend-url` is correct.
  Test with: `python -m connect.adapters.mcp_server --token YOUR_TOKEN` and watch for connection errors.

**Token expired / 401 errors**
: Log in again via the CLI platform and update the token in your MCP client's config,
  then restart the client.
