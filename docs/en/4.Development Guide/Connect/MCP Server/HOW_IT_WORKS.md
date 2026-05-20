# How an MCP Client Connects to OpenJiuwen

This document explains exactly what happens at every stage — from getting a token to
an AI client executing a workflow on your behalf. Intended for developers setting this up
for the first time, or anyone wanting to understand the full connection flow.

Examples in this document use **Claude Desktop** as the MCP client, since it is the most
common setup. The same flow applies to any other MCP-compatible client, including
**JiuwenClaw** (a personal AI assistant from the same product family as OpenJiuwen).

---

## The big picture

Two supported transports — the AI tools and OpenJiuwen backend calls are identical in both cases:

```
  stdio (default) — client spawns server as subprocess
  ─────────────────────────────────────────────────────
  You (developer)
       │  configure once (command + args + cwd)
       ▼
  MCP client config  →  spawns mcp_server subprocess  →  OpenJiuwen backend
                              (stdio pipe / MCP)           (HTTP + Bearer token)


  SSE — server runs persistently; clients connect over HTTP
  ─────────────────────────────────────────────────────────
  You (developer)
       │  start server once  (python -m ... --transport sse --port 8080)
       ▼
  mcp_server HTTP process  ←────────────────  MCP client
       │                        SSE / HTTP        (connects to http://host:port/sse)
       ▼
  OpenJiuwen backend  (HTTP + Bearer token)
```

MCP direction is: **AI client → our server → OpenJiuwen backend**.
The AI client is the consumer. OpenJiuwen is the system being exposed.
This is the opposite of Channels, where humans connect to OpenJiuwen through messaging platforms.

---

## Full step-by-step flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1 — GET A TOKEN  (one-time, done by the developer)             │
│                                                                     │
│  The token is your identity on OpenJiuwen. Every action the AI     │
│  takes via MCP is performed as you, on your account, in your space. │
│  There is no separate "AI identity".                                │
│                                                                     │
│  Path A — via the CLI platform (recommended):                       │
│                                                                     │
│    1a. Start the CLI platform:                                      │
│          python -m channels.run cli                                 │
│                --backend-url http://localhost:8000                  │
│                                                                     │
│    1b. Type /login at the prompt.                                   │
│          → You are asked for your OpenJiuwen username and password. │
│          → The CLI calls the OpenJiuwen auth endpoint.              │
│          → OpenJiuwen returns a Bearer token.                       │
│          → The CLI saves it automatically to:                       │
│               connect/channels/platforms/cli/.cli_tokens.json       │
│                                                                     │
│    1c. Open that file. Copy the value of "token".                   │
│                                                                     │
│  Path B — via the OpenJiuwen web UI:                                │
│                                                                     │
│    1a. Log in to OpenJiuwen in your browser.                        │
│    1b. Go to Settings → API Tokens.                                 │
│    1c. Generate or copy your token.                                 │
│                                                                     │
│  ⚠ Token lifetime                                                   │
│    Session tokens expire. When they do, every MCP tool call will    │
│    return an ERROR (HTTP 401 Unauthorized). You must log in again,  │
│    copy a new token, update the config, and restart the client.     │
│    If OpenJiuwen offers long-lived API keys, prefer those here.     │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │  you copy the token
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2 — CONFIGURE YOUR MCP CLIENT  (one-time, done by developer)   │
│                                                                     │
│  Every MCP client has its own way to register MCP servers.          │
│  The information it needs is always the same:                       │
│    - command: what to run (python3.12 -m connect.adapters.mcp_server)│
│    - args: --token, --backend-url                                   │
│    - cwd: the project root (so channels.* is importable)            │
│                                                                     │
│  ── Claude Desktop — stdio ────────────────────────────────────────  │
│                                                                     │
│  Config file location:                                              │
│    macOS:    ~/Library/Application Support/Claude/                  │
│              claude_desktop_config.json                             │
│    Linux:    ~/.config/claude/claude_desktop_config.json            │
│    Windows:  %APPDATA%\Claude\claude_desktop_config.json            │
│                                                                     │
│  Add this block (adjust paths and token):                           │
│                                                                     │
│    {                                                                │
│      "mcpServers": {                                                │
│        "openjiuwen": {                                              │
│          "command": "/usr/local/bin/python3.12",  ← your python    │
│          "args": [                                                  │
│            "-m", "connect.adapters.mcp_server",                     │
│            "--backend-url", "http://localhost:8000",                │
│            "--token", "eyJhbGc..."   ← paste token here            │
│          ],                                                         │
│          "cwd": "/path/to/michael-agent-studio"  ← project root    │
│        }                                                            │
│      }                                                              │
│    }                                                                │
│                                                                     │
│  ── Claude Desktop — SSE ──────────────────────────────────────────  │
│                                                                     │
│  Start the server first (token is provided at server startup):      │
│    python -m connect.adapters.mcp_server                            │
│      --token TOKEN --transport sse --port 8080                      │
│                                                                     │
│  Then point Claude Desktop at the URL (no token needed here):       │
│                                                                     │
│    {                                                                │
│      "mcpServers": {                                                │
│        "openjiuwen": {                                              │
│          "url": "http://localhost:8080/sse"                         │
│        }                                                            │
│      }                                                              │
│    }                                                                │
│                                                                     │
│  Restart Claude Desktop after saving.                               │
│                                                                     │
│  ── JiuwenClaw ────────────────────────────────────────────────────  │
│                                                                     │
│  JiuwenClaw supports both stdio and SSE transports. Register        │
│  OpenJiuwen as an MCP server in JiuwenClaw's MCP settings using    │
│  the same config format as Claude Desktop above.                    │
│  See the JiuwenClaw documentation for the exact config format.      │
│  Once connected, JiuwenClaw discovers the same tools and can call   │
│  them during any conversation or scheduled task.                    │
│                                                                     │
│  ── Other clients ─────────────────────────────────────────────────  │
│                                                                     │
│  stdio: launch as subprocess with --token, --backend-url, cwd.     │
│  SSE:   start server with --transport sse, connect to /sse URL.     │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │  client restarts / starts
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3 — SERVER STARTUP  (stdio: automatic each client start;       │
│                           SSE: manual, runs persistently)           │
│                                                                     │
│  ── stdio ─────────────────────────────────────────────────────────  │
│                                                                     │
│  The MCP client reads its config at startup and spawns a subprocess:│
│                                                                     │
│    python3.12 -m connect.adapters.mcp_server                        │
│      --backend-url http://localhost:8000                            │
│      --token eyJhbGc...          ← token arrives here as argv      │
│                                                                     │
│    mcp.run(transport="stdio")                                       │
│      → process blocks, listening on stdin                           │
│      → stdout is reserved for MCP protocol responses               │
│      → stderr is used for our startup log lines                    │
│                                                                     │
│  The process stays alive for as long as the MCP client is running.  │
│  When the client exits, the subprocess is terminated.               │
│                                                                     │
│  ── SSE ────────────────────────────────────────────────────────────  │
│                                                                     │
│  You start the server once manually (e.g. as a service):            │
│                                                                     │
│    python3.12 -m connect.adapters.mcp_server                        │
│      --token eyJhbGc... --transport sse --host 0.0.0.0 --port 8080 │
│                                                                     │
│    mcp.run(transport="sse", host="0.0.0.0", port=8080)              │
│      → HTTP server binds to 0.0.0.0:8080                           │
│      → clients connect via GET http://host:8080/sse                 │
│      → each client gets its own SSE stream                          │
│                                                                     │
│  The server stays alive independently of any client connection.     │
│                                                                     │
│  ── Common startup sequence (both transports) ─────────────────────  │
│                                                                     │
│  Inside mcp_server/server.py:                                       │
│                                                                     │
│    argparse reads --token from sys.argv                             │
│      ↓                                                              │
│    OpenJiuwenClient(base_url=...) created                           │
│      ↓                                                              │
│    client.set_token("eyJhbGc...")                                   │
│      → stores in requests.Session headers:                          │
│           { "Authorization": "Bearer eyJhbGc..." }                  │
│      → every HTTP call carries this header automatically            │
│      ↓                                                              │
│    get_spaces() called → first space auto-selected                  │
│      ↓                                                              │
│    register_all(mcp, client) — tools registered with client ref     │
│      ↓                                                              │
│    mcp.run(transport=...)                                           │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │  stdio pipe  or  SSE HTTP stream
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4 — TOOL DISCOVERY  (automatic, immediately after startup)     │
│                                                                     │
│  The MCP client sends a tools/list request over the stdin pipe.     │
│                                                                     │
│  FastMCP responds with the full schema of all 9 registered tools:   │
│                                                                     │
│    health_check                                                     │
│      → description: "Check connectivity to the OpenJiuwen backend"  │
│      → parameters: none                                             │
│                                                                     │
│    list_agents                                                      │
│      → description: "List agents in the connected space"            │
│      → parameters: page (int, optional), page_size (int, optional)  │
│                                                                     │
│    search_agents                                                    │
│      → parameters: keyword (string, required)                       │
│                                                                     │
│    run_agent                                                        │
│      → parameters: agent_id (required), message (required),         │
│                    conversation_id (optional)                        │
│                                                                     │
│    reset_agent                                                      │
│      → parameters: conversation_id (required)                       │
│                                                                     │
│    list_workflows, search_workflows, get_workflow, run_workflow      │
│      → similar schemas for workflow operations                      │
│                                                                     │
│  The AI assistant now knows:                                        │
│    - that these 9 tools exist                                       │
│    - what each one is for (from the description)                    │
│    - what arguments each one takes                                  │
│  It will autonomously decide when and whether to call any of them   │
│  based on what the user asks.                                       │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5 — CONVERSATION + TOOL CALLS  (every time the user chats)     │
│                                                                     │
│  Example: user types "Run my Onboarding workflow for Alice"         │
│  (this works the same way in Claude Desktop, JiuwenClaw, or any     │
│  other MCP-compatible client)                                       │
│                                                                     │
│  5a. The AI reasons about the request.                              │
│      It does not know the workflow ID yet.                          │
│      Decides to search first.                                       │
│      Calls: search_workflows(keyword="Onboarding")                  │
│                                                                     │
│  5b. The MCP client encodes the call and writes it to stdin:        │
│        {                                                            │
│          "method": "tools/call",                                    │
│          "params": {                                                │
│            "name": "search_workflows",                              │
│            "arguments": { "keyword": "Onboarding" }                 │
│          }                                                          │
│        }                                                            │
│                                                                     │
│  5c. mcp_server receives and executes the call:                     │
│        search_workflows_tool(client, keyword="Onboarding")          │
│          → client.session.post("/api/v1/workflows/search",          │
│              json={"space_id": "...", "search_term": "Onboarding"}) │
│               ↑                                                     │
│               HTTP POST to OpenJiuwen backend                       │
│               Authorization: Bearer eyJhbGc...  ← the token that    │
│               was stored in step 3, silently attached to every      │
│               request, never typed again                            │
│          ← OpenJiuwen authenticates the request and returns JSON    │
│          format_workflows(data) converts JSON to readable string    │
│                                                                     │
│  5d. mcp_server writes the result to stdout:                        │
│        {                                                            │
│          "result": {                                                │
│            "content": [{                                            │
│              "type": "text",                                        │
│              "text": "Found 1 workflow:\n  • [wf-99] Onboarding"    │
│            }]                                                       │
│          }                                                          │
│        }                                                            │
│                                                                     │
│  5e. The AI reads the result. Sees workflow ID "wf-99".             │
│      Now calls: run_workflow(workflow_id="wf-99",                   │
│                              inputs={"user": "Alice"})              │
│      Steps 5b–5d repeat for this second tool call.                  │
│                                                                     │
│  5f. The AI has the workflow output.                                │
│      Composes a natural-language reply.                             │
│      User sees: "Done! The Onboarding workflow ran for Alice.       │
│      Output: ..."                                                   │
│                                                                     │
│  The AI may chain multiple tool calls within one user turn.         │
│  It decides the sequence autonomously — no user input between       │
│  tool calls unless it explicitly asks for clarification.            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## What the user sees vs. what actually happens

```
User types:  "Run my Onboarding workflow for Alice"

                    AI reasons (not visible to user)
                            │
              ┌─────────────▼────────────────┐
              │  search_workflows("Onboard") │  ← tool call 1
              │  → Found: [wf-99] Onboarding │
              └─────────────┬────────────────┘
                            │
              ┌─────────────▼────────────────┐
              │  run_workflow("wf-99",        │  ← tool call 2
              │    inputs={"user":"Alice"})   │
              │  → "Onboarding complete"      │
              └─────────────┬────────────────┘
                            │
User sees:   "Done! The Onboarding workflow completed for Alice."
```

The tool calls happen silently. The user interacts only with the AI's final response.
This is true whether the AI client is Claude Desktop, JiuwenClaw, or any other.

---

## What happens when the token expires

```
Any tool call arrives at mcp_server
        ↓
HTTP POST to OpenJiuwen backend
        ↓
OpenJiuwen returns HTTP 401 Unauthorized  (token expired)
        ↓
requests.Session raises an HTTPError exception
        ↓
tool function catches it → returns "ERROR: 401 Client Error..."
        ↓
mcp_server sends the error string back to the AI client via stdout
        ↓
The AI reads the error and tells the user:
  "I couldn't complete that — the OpenJiuwen connection returned
   an authorization error. Your credentials may have expired."

To fix:
  1. Log in to OpenJiuwen again  (CLI /login or web UI)
  2. Copy the new token
  3. Update the token in your MCP client's config
  4. Restart the MCP client
     → Step 3 repeats with the new token
     → all subsequent requests succeed again
```

---

## Where the token is at each stage

| Stage | Where the token lives |
|---|---|
| After Step 1 | `.cli_tokens.json` on disk, or your clipboard |
| After Step 2 | MCP client config — plain string in the server args |
| After Step 3 | `requests.Session` headers in memory — `Authorization: Bearer …` |
| During Step 5 | Attached silently to every HTTP request — never re-read from disk |
| Never | In the AI's context window / chat history / tool arguments / logs |

The token moves exactly once: you paste it into the config.
After that it travels as a process argument and is held in memory.
The AI never sees it.
