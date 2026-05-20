# MCP客户端如何连接到OpenJiuwen

本文档详细说明每个阶段发生的事情 — 从获取令牌到AI客户端代您执行工作流。适合首次设置的开发者，或任何希望了解完整连接流程的人。

本文档中的示例使用**Claude Desktop**作为MCP客户端，因为它是最常见的设置。同样的流程适用于任何其他兼容MCP的客户端，包括**JiuwenClaw**(与OpenJiuwen同产品系列的个人AI助手)。

---

## 整体架构

支持两种传输方式 — AI工具和OpenJiuwen后端调用在两种情况下完全相同:

```
  stdio(默认) — 客户端将服务器作为子进程启动
  ─────────────────────────────────────────────────────
  您(开发者)
       │  一次性配置(command + args + cwd)
       ▼
  MCP客户端配置  →  启动mcp_server子进程  →  OpenJiuwen后端
                          (stdio管道 / MCP)      (HTTP + Bearer令牌)


  SSE — 服务器持久运行；客户端通过HTTP连接
  ─────────────────────────────────────────────────────
  您(开发者)
       │  一次性启动服务器 (python -m ... --transport sse --port 8080)
       ▼
  mcp_server HTTP进程  ←────────────────  MCP客户端
       │                    SSE / HTTP      (连接到http://host:port/sse)
       ▼
  OpenJiuwen后端  (HTTP + Bearer令牌)
```

MCP的方向是: **AI客户端 → 我们的服务器 → OpenJiuwen后端**。
AI客户端是消费者。OpenJiuwen是被暴露的系统。
这与渠道相反——渠道中，人类通过消息平台连接到OpenJiuwen。

---

## 完整步骤流程

```
┌─────────────────────────────────────────────────────────────────────┐
│ 第1步 — 获取令牌  (一次性，由开发者完成)                              │
│                                                                     │
│  令牌是您在OpenJiuwen上的身份。AI通过MCP采取的每个操作都             │
│  以您的身份、在您的账户和空间中执行。没有单独的"AI身份"。            │
│                                                                     │
│  路径A — 通过CLI平台(推荐):                                         │
│                                                                     │
│    1a. 启动CLI平台:                                                 │
│          python -m connect.adapters.channels.run cli                │
│                --backend-url http://localhost:8000 login            │
│                                                                     │
│    1b. 输入您的用户名和密码。                                        │
│          → CLI调用OpenJiuwen认证端点。                              │
│          → OpenJiuwen返回Bearer令牌。                               │
│          → CLI自动将其保存到:                                       │
│               connect/adapters/channels/platforms/cli/              │
│               .cli_tokens.json                                      │
│                                                                     │
│    1c. 打开该文件。复制"token"的值。                                 │
│                                                                     │
│  路径B — 通过OpenJiuwen Web UI:                                     │
│                                                                     │
│    1a. 在浏览器中登录OpenJiuwen。                                   │
│    1b. 前往设置 → API令牌。                                         │
│    1c. 生成或复制您的令牌。                                         │
│                                                                     │
│  ⚠ 令牌有效期                                                       │
│    会话令牌会过期。过期后，每次MCP工具调用都将                       │
│    返回错误(HTTP 401 Unauthorized)。您必须重新登录，                 │
│    复制新令牌，更新配置，然后重启客户端。                            │
│    如果OpenJiuwen提供长期API密钥，在这里优先使用。                   │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │  您复制令牌
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 第2步 — 配置您的MCP客户端  (一次性，由开发者完成)                     │
│                                                                     │
│  每个MCP客户端都有自己的方式来注册MCP服务器。                        │
│  所需信息始终相同:                                                   │
│    - command: 运行什么(python3.12 -m connect.adapters.mcp_server)   │
│    - args: --token, --backend-url                                   │
│    - cwd: 项目根目录(使connect.*可导入)                             │
│                                                                     │
│  ── Claude Desktop — stdio ────────────────────────────────────────  │
│                                                                     │
│  配置文件位置:                                                       │
│    macOS:    ~/Library/Application Support/Claude/                  │
│              claude_desktop_config.json                             │
│    Linux:    ~/.config/claude/claude_desktop_config.json            │
│    Windows:  %APPDATA%\Claude\claude_desktop_config.json            │
│                                                                     │
│  添加以下块(调整路径和令牌):                                        │
│                                                                     │
│    {                                                                │
│      "mcpServers": {                                                │
│        "openjiuwen": {                                              │
│          "command": "/usr/local/bin/python3.12",  ← 您的python     │
│          "args": [                                                  │
│            "-m", "connect.adapters.mcp_server",                     │
│            "--backend-url", "http://localhost:8000",                │
│            "--token", "eyJhbGc..."   ← 粘贴令牌到此处             │
│          ],                                                         │
│          "cwd": "/path/to/michael-agent-studio"  ← 项目根目录      │
│        }                                                            │
│      }                                                              │
│    }                                                                │
│                                                                     │
│  ── Claude Desktop — SSE ──────────────────────────────────────────  │
│                                                                     │
│  先启动服务器(令牌在服务器启动时提供):                               │
│    python -m connect.adapters.mcp_server                            │
│      --token TOKEN --transport sse --port 8080                      │
│                                                                     │
│  然后将Claude Desktop指向URL(此处不需要令牌):                       │
│                                                                     │
│    {                                                                │
│      "mcpServers": {                                                │
│        "openjiuwen": {                                              │
│          "url": "http://localhost:8080/sse"                         │
│        }                                                            │
│      }                                                              │
│    }                                                                │
│                                                                     │
│  保存后重启Claude Desktop。                                         │
│                                                                     │
│  ── JiuwenClaw ────────────────────────────────────────────────────  │
│                                                                     │
│  JiuwenClaw支持stdio和SSE两种传输方式。在JiuwenClaw的               │
│  MCP设置中注册OpenJiuwen，使用与上述Claude Desktop                  │
│  相同的配置格式。具体配置格式请参阅JiuwenClaw文档。                  │
│  连接后，JiuwenClaw发现相同的工具，可以在任何对话或                  │
│  计划任务中调用它们。                                               │
│                                                                     │
│  ── 其他客户端 ─────────────────────────────────────────────────────  │
│                                                                     │
│  stdio: 以--token、--backend-url、cwd将服务器作为子进程启动。       │
│  SSE:   以--transport sse启动服务器，连接到/sse URL。               │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │  客户端重启/启动
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 第3步 — 服务器启动  (stdio: 每次客户端启动自动进行;                   │
│                     SSE: 手动，持久运行)                             │
│                                                                     │
│  ── stdio ─────────────────────────────────────────────────────────  │
│                                                                     │
│  MCP客户端在启动时读取配置并启动子进程:                              │
│                                                                     │
│    python3.12 -m connect.adapters.mcp_server                        │
│      --backend-url http://localhost:8000                            │
│      --token eyJhbGc...          ← 令牌作为argv到达此处            │
│                                                                     │
│    mcp.run(transport="stdio")                                       │
│      → 进程阻塞，在stdin上监听                                      │
│      → stdout保留用于MCP协议响应                                    │
│      → stderr用于我们的启动日志行                                   │
│                                                                     │
│  只要MCP客户端在运行，进程就保持存活。                               │
│  当客户端退出时，子进程被终止。                                      │
│                                                                     │
│  ── SSE ────────────────────────────────────────────────────────────  │
│                                                                     │
│  您手动启动服务器一次(例如作为服务):                                  │
│                                                                     │
│    python3.12 -m connect.adapters.mcp_server                        │
│      --token eyJhbGc... --transport sse --host 0.0.0.0 --port 8080 │
│                                                                     │
│    mcp.run(transport="sse", host="0.0.0.0", port=8080)              │
│      → HTTP服务器绑定到0.0.0.0:8080                                │
│      → 客户端通过GET http://host:8080/sse连接                       │
│      → 每个客户端获得自己的SSE流                                    │
│                                                                     │
│  服务器独立于任何客户端连接持续运行。                                │
│                                                                     │
│  ── 两种传输的通用启动序列 ─────────────────────────────────────────  │
│                                                                     │
│  mcp_server/server.py内部:                                          │
│                                                                     │
│    argparse从sys.argv读取--token                                    │
│      ↓                                                              │
│    创建OpenJiuwenClient(base_url=...)                               │
│      ↓                                                              │
│    client.set_token("eyJhbGc...")                                   │
│      → 存储在requests.Session请求头中:                              │
│           { "Authorization": "Bearer eyJhbGc..." }                  │
│      → 每次HTTP调用自动携带此请求头                                  │
│      ↓                                                              │
│    调用get_spaces() → 自动选择第一个空间                             │
│      ↓                                                              │
│    register_all(mcp, client) — 工具与客户端引用一起注册             │
│      ↓                                                              │
│    mcp.run(transport=...)                                           │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │  stdio管道  或  SSE HTTP流
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 第4步 — 工具发现  (自动，启动后立即进行)                              │
│                                                                     │
│  MCP客户端通过stdin管道发送tools/list请求。                         │
│                                                                     │
│  FastMCP响应所有9个已注册工具的完整模式:                             │
│                                                                     │
│    health_check                                                     │
│      → 描述: "检查与OpenJiuwen后端的连接"                           │
│      → 参数: 无                                                     │
│                                                                     │
│    list_agents                                                      │
│      → 描述: "列出连接空间中的智能体"                               │
│      → 参数: page(int, 可选), page_size(int, 可选)                  │
│                                                                     │
│    search_agents                                                    │
│      → 参数: keyword(string, 必填)                                  │
│                                                                     │
│    run_agent                                                        │
│      → 参数: agent_id(必填), message(必填),                         │
│              conversation_id(可选)                                  │
│                                                                     │
│    reset_agent                                                      │
│      → 参数: conversation_id(必填)                                  │
│                                                                     │
│    list_workflows, search_workflows, get_workflow, run_workflow      │
│      → 工作流操作的类似模式                                         │
│                                                                     │
│  AI助手现在知道:                                                    │
│    - 这9个工具的存在                                               │
│    - 每个工具的用途(来自描述)                                       │
│    - 每个工具接受哪些参数                                           │
│  它将根据用户的询问自主决定何时以及是否调用它们。                    │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 第5步 — 对话 + 工具调用  (每次用户聊天时)                             │
│                                                                     │
│  示例: 用户输入"为Alice运行我的入职工作流"                            │
│  (在Claude Desktop、JiuwenClaw或任何其他MCP兼容客户端中工作方式相同) │
│                                                                     │
│  5a. AI推理请求。                                                   │
│      它还不知道工作流ID。                                           │
│      决定先搜索。                                                   │
│      调用: search_workflows(keyword="入职")                         │
│                                                                     │
│  5b. MCP客户端编码调用并写入stdin:                                  │
│        {                                                            │
│          "method": "tools/call",                                    │
│          "params": {                                                │
│            "name": "search_workflows",                              │
│            "arguments": { "keyword": "入职" }                       │
│          }                                                          │
│        }                                                            │
│                                                                     │
│  5c. mcp_server接收并执行调用:                                      │
│        search_workflows_tool(client, keyword="入职")                │
│          → client.session.post("/api/v1/workflows/search",          │
│              json={"space_id": "...", "search_term": "入职"})       │
│               ↑                                                     │
│               HTTP POST到OpenJiuwen后端                             │
│               Authorization: Bearer eyJhbGc... ← 第3步存储的令牌，  │
│               静默附加到每个请求，不再需要重新输入                   │
│          ← OpenJiuwen认证请求并返回JSON                             │
│          format_workflows(data)将JSON转换为可读字符串               │
│                                                                     │
│  5d. mcp_server将结果写入stdout:                                    │
│        {                                                            │
│          "result": {                                                │
│            "content": [{                                            │
│              "type": "text",                                        │
│              "text": "找到1个工作流:\n  • [wf-99] 入职流程"         │
│            }]                                                       │
│          }                                                          │
│        }                                                            │
│                                                                     │
│  5e. AI读取结果。看到工作流ID"wf-99"。                              │
│      现在调用: run_workflow(workflow_id="wf-99",                    │
│                             inputs={"user": "Alice"})               │
│      步骤5b–5d为第二次工具调用重复。                                │
│                                                                     │
│  5f. AI获得工作流输出。                                             │
│      组织自然语言回复。                                             │
│      用户看到: "完成！入职工作流已为Alice运行。                      │
│      输出: ..."                                                     │
│                                                                     │
│  AI可以在一个用户回合内链式调用多个工具。                            │
│  它自主决定顺序 — 除非明确要求澄清，否则工具调用之间不需要用户输入。 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 用户看到的vs实际发生的

```
用户输入:  "为Alice运行我的入职工作流"

                    AI推理(用户不可见)
                            │
              ┌─────────────▼────────────────┐
              │  search_workflows("入职")     │  ← 工具调用1
              │  → 找到: [wf-99] 入职流程    │
              └─────────────┬────────────────┘
                            │
              ┌─────────────▼────────────────┐
              │  run_workflow("wf-99",        │  ← 工具调用2
              │    inputs={"user":"Alice"})   │
              │  → "入职完成"                 │
              └─────────────┬────────────────┘
                            │
用户看到:   "完成！入职工作流已为Alice成功运行。"
```

工具调用静默进行。用户只与AI的最终回复交互。
无论AI客户端是Claude Desktop、JiuwenClaw还是其他任何客户端，这都是一样的。

---

## 令牌过期时发生什么

```
任何工具调用到达mcp_server
        ↓
HTTP POST到OpenJiuwen后端
        ↓
OpenJiuwen返回HTTP 401 Unauthorized (令牌过期)
        ↓
requests.Session抛出HTTPError异常
        ↓
工具函数捕获它 → 返回"ERROR: 401 Client Error..."
        ↓
mcp_server通过stdout将错误字符串发送回AI客户端
        ↓
AI读取错误并告知用户:
  "我无法完成该操作 — OpenJiuwen连接返回了
   授权错误。您的凭据可能已过期。"

修复方法:
  1. 重新登录OpenJiuwen (CLI login 或 Web UI)
  2. 复制新令牌
  3. 更新MCP客户端配置中的令牌
  4. 重启MCP客户端
     → 第3步以新令牌重新执行
     → 后续所有请求再次成功
```

---

## 令牌在每个阶段的位置

| 阶段 | 令牌所在位置 |
|------|------------|
| 第1步之后 | 磁盘上的`.cli_tokens.json`，或您的剪贴板 |
| 第2步之后 | MCP客户端配置 — 服务器参数中的纯字符串 |
| 第3步之后 | 内存中的`requests.Session`请求头 — `Authorization: Bearer …` |
| 第5步期间 | 静默附加到每个HTTP请求 — 不再从磁盘读取 |
| 从不 | 在AI的上下文窗口/聊天历史/工具参数/日志中 |

令牌只移动一次: 您将其粘贴到配置中。
之后它作为进程参数传递并保存在内存中。
AI永远看不到它。
