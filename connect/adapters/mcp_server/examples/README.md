# OpenJiuwen Studio MCP Client Examples

Example MCP clients that connect to the OpenJiuwen Studio MCP server, organized by **transport** (SSE / Stdio) and **integration pattern** (4 patterns).

## Directory Structure

```
examples/
├── README.md
├── _shared.py                              # Base utilities (parser, logging helpers, ID extraction)
├── _shared_for_core_mcp.py                 # Demo runner — direct client pattern
├── _shared_for_core_tool.py                # Demo runner — MCPTool wrapper pattern
├── _shared_for_fast_mcp.py                 # Demo runner — raw MCP protocol pattern
├── sse/
│   ├── _shared.py                          # SSE constants + extends base parser (--server-url)
│   ├── client_as_core_mcp.py               # Direct SseClient usage
│   ├── client_as_core_tool.py              # MCPTool wrapper with SseClient
│   ├── client_as_core_tool_with_resource_manager.py  # Runner + ResourceMgr
│   └── client_as_fastmcp.py               # Raw MCP protocol over SSE
└── stdio/
    ├── _shared.py                          # Stdio constants + extends base parser (--token, --backend-url)
    ├── client_as_core_mcp.py               # Direct StdioClient usage
    ├── client_as_core_tool.py              # MCPTool wrapper with StdioClient
    ├── client_as_core_tool_with_resource_manager.py  # Runner + ResourceMgr
    └── client_as_fastmcp.py               # Raw MCP protocol over Stdio
```

## Prerequisites

1. Install openjiuwen-core:
   ```bash
   pip install openjiuwen-core
   ```

2. Set your backend token:
   ```bash
   export OJ_TOKEN=your_token_here
   ```

3. (Optional) Set backend URL if not using default:
   ```bash
   export OJ_BACKEND_URL=http://localhost:8000
   ```

### For SSE Examples Only

Start the MCP server in SSE mode before running any `sse/` client:
```bash
python -m connect.adapters.mcp_server --transport sse --port 8080
```

For Stdio examples the server subprocess is launched automatically — no manual start needed.

## Running the Examples

Run as modules from the **project root** (required for absolute imports to resolve):

### SSE Transport

```bash
python -m connect.adapters.mcp_server.examples.sse.client_as_core_mcp
python -m connect.adapters.mcp_server.examples.sse.client_as_core_tool
python -m connect.adapters.mcp_server.examples.sse.client_as_core_tool_with_resource_manager
python -m connect.adapters.mcp_server.examples.sse.client_as_fastmcp [--no-interactive]
```

### Stdio Transport

```bash
python -m connect.adapters.mcp_server.examples.stdio.client_as_core_mcp --token YOUR_TOKEN
python -m connect.adapters.mcp_server.examples.stdio.client_as_core_tool --token YOUR_TOKEN
python -m connect.adapters.mcp_server.examples.stdio.client_as_core_tool_with_resource_manager --token YOUR_TOKEN
python -m connect.adapters.mcp_server.examples.stdio.client_as_fastmcp --token YOUR_TOKEN [--no-interactive]
```

All scripts accept `--help` for full option listing.

## Integration Patterns

### 1. Direct Client (`client_as_core_mcp.py`)

Uses `SseClient` / `StdioClient` from openjiuwen-core directly.

**Use when:** You need low-level control and want to call tools by name without any wrapper.

```python
from openjiuwen.core.foundation.tool.mcp.client.sse_client import SseClient

client = SseClient(McpServerConfig(...))
await client.connect()
result = await client.call_tool("health_check", {})
await client.disconnect()
```

### 2. MCPTool Wrapper (`client_as_core_tool.py`)

Wraps each discovered tool card in `MCPTool`, giving it the standard `Tool.invoke()` interface.

**Use when:** You want MCP tools to be interchangeable with any other openjiuwen `Tool`.

```python
from openjiuwen.core.foundation.tool.mcp.base import MCPTool

tool_cards = await client.list_tools()
tools = {card.name: MCPTool(mcp_client=client, tool_info=card) for card in tool_cards}
result = await tools["health_check"].invoke({})
```

### 3. Resource Manager (`client_as_core_tool_with_resource_manager.py`)

Registers the server with `Runner.resource_mgr` for full framework integration.

**Use when:** You want automatic lifecycle management and centralized tool registry.

```python
from openjiuwen.core.runner import Runner

await Runner.start()
await Runner.resource_mgr.add_mcp_server(config, tag=["mcp", "studio"])
tool = await Runner.resource_mgr.get_mcp_tool(name="health_check", server_name=SERVER_NAME)
result = await tool.invoke({})
await Runner.resource_mgr.remove_mcp_server(server_name=SERVER_NAME)
await Runner.stop()
```

### 4. FastMCP — Raw Protocol (`client_as_fastmcp.py`)

Uses `mcp.ClientSession` directly, with no openjiuwen-core abstractions. This is how Claude Desktop and other standard MCP clients work.

**Use when:** You want to test the MCP server from a protocol-level perspective, or implement a custom client.

Additional features: lists all tools with signatures, supports interactive multi-turn conversations (`--no-interactive` to skip).

```python
from mcp import ClientSession
from mcp.client.sse import sse_client

async with sse_client(server_url) as (read, write):
    async with ClientSession(read, write) as session:
        await session.initialize()
        result = await session.call_tool("health_check", arguments=None)
```

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `health_check` | Check backend connectivity and health |
| `list_agents` | List available agents (pagination) |
| `search_agents` | Search agents by keyword |
| `get_agent` | Get details for a specific agent |
| `run_agent` | Run an agent with a message (conversation support) |
| `reset_agent` | Reset agent conversation state |
| `list_workflows` | List available workflows (pagination) |
| `search_workflows` | Search workflows by keyword |
| `get_workflow` | Get details for a specific workflow |
| `run_workflow` | Execute a workflow with inputs |

## Transport Comparison

| | SSE | Stdio |
|---|---|---|
| **Connection** | HTTP to running server | Subprocess over stdin/stdout |
| **Server start** | Manual (`python -m connect.adapters.mcp_server --transport sse`) | Automatic |
| **Lifetime** | Server independent of client | Server tied to client process |
| **Use case** | Production, remote access, multiple clients | Development, testing, single client |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OJ_TOKEN` | Backend access token | *(required for Stdio)* |
| `OJ_BACKEND_URL` | OpenJiuwen backend URL | `http://localhost:8000` |
| `OJ_SERVER_URL` | SSE server URL | `http://127.0.0.1:8080/sse` |

## Troubleshooting

**SSE connection refused** — start the server first:
```bash
python -m connect.adapters.mcp_server --transport sse --port 8080
```

**Stdio `--token` missing** — set `OJ_TOKEN` or pass `--token YOUR_TOKEN`.

**Tool invocation errors** — verify the backend is running at `OJ_BACKEND_URL` and the token has the necessary permissions.

**Agent/workflow not found** — IDs change per environment; omit `--agent-id` / `--workflow-id` to use the first available.
