# Connect — MCP服务端

MCP服务端将您的OpenJiuwen智能体和工作流公开为**MCP(模型上下文协议)工具**，
使任何兼容MCP的AI客户端 — 如**Claude Desktop**或**JiuwenClaw** —
能够自主发现并调用它们。

## 工作原理

```
# stdio(默认) — 客户端将服务器作为子进程启动
MCP客户端  ──stdio──►  mcp_server  ──HTTP──►  OpenJiuwen后端

# SSE — 服务器持久运行；客户端通过HTTP连接
MCP客户端  ──SSE───►  mcp_server  ──HTTP──►  OpenJiuwen后端
```

- **stdio传输**(默认): MCP客户端将服务器作为子进程启动。设置最简单；适合Claude Desktop等桌面客户端。
- **SSE传输**: 服务器作为持久HTTP进程运行；客户端通过URL连接。适合远程或共享部署。
- 认证: 启动时一次性配置**静态令牌**。无每用户登录；一个共享客户端处理所有请求。

## 前提条件

1. Python 3.10+
2. OpenJiuwen后端正在运行(默认: `http://localhost:8000`)
3. 后端的有效访问令牌

### 获取令牌

使用CLI登录并获取令牌:

```bash
python -m connect.adapters.channels.run cli --backend-url http://localhost:8000 login
```

令牌保存在`connect/adapters/channels/platforms/cli/.cli_tokens.json`中。复制`"token": "..."`的值。

## 安装

```bash
pip install -r connect/adapters/mcp_server/requirements.txt
```

## 手动运行(用于测试)

```bash
# stdio传输(默认) — 进程在stdin上等待MCP消息
python -m connect.adapters.mcp_server \
  --token YOUR_TOKEN \
  --backend-url http://localhost:8000

# SSE传输 — 启动HTTP服务器，客户端通过URL连接
python -m connect.adapters.mcp_server \
  --token YOUR_TOKEN \
  --backend-url http://localhost:8000 \
  --transport sse \
  --host 0.0.0.0 \
  --port 8080
# → 监听 http://0.0.0.0:8080/sse
```

## 连接MCP客户端

### Claude Desktop

将以下内容添加到Claude Desktop配置文件:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**stdio传输**(Claude Desktop启动服务器):

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

> 将`command`替换为您的Python解释器路径(`which python3.12`)。
> `cwd`必须指向项目根目录。编辑配置后重启Claude Desktop。

**SSE传输**(服务器必须已使用`--transport sse`运行):

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

JiuwenClaw是一个具有持久记忆的个人AI助手(与OpenJiuwen同产品系列)，支持MCP服务端连接。连接OpenJiuwen后，JiuwenClaw可以将您的智能体和工作流作为自身推理的一部分进行调用 — 使用结构化工作流处理原本需要逐步解决的任务。

在JiuwenClaw的MCP客户端设置中注册此服务器，使用与Claude Desktop示例相同的`command`、`args`和`cwd`。具体配置格式请参阅JiuwenClaw文档。

### 任何其他兼容MCP的客户端

- **stdio**: 以`--token`和`--backend-url`将服务器作为子进程启动；将`cwd`设置为项目根目录。
- **SSE**: 使用`--transport sse`启动服务器，然后将客户端指向`http://HOST:PORT/sse`。

## 可用工具

| 工具 | 说明 |
|------|------|
| `health_check()` | 验证后端连接 |
| `list_agents(page?, page_size?)` | 分页列出智能体 |
| `search_agents(keyword)` | 按名称/描述搜索智能体 |
| `get_agent(agent_id)` | 显示智能体定义(描述、模型、工具) |
| `run_agent(agent_id, message, conversation_id?)` | 与智能体对话；返回回复和conversation_id |
| `reset_agent(conversation_id)` | 丢弃对话(下次调用重新开始) |
| `list_workflows(page?, page_size?)` | 分页列出工作流 |
| `search_workflows(keyword)` | 按名称/描述搜索工作流 |
| `get_workflow(workflow_id)` | 显示工作流定义和所需输入 |
| `run_workflow(workflow_id, inputs?)` | 执行工作流并返回输出 |

### 多轮智能体对话

```
客户端:  run_agent("agent-123", "你好!")
         → 回复: 你好！我能帮您什么？
           对话ID: conv-abc
客户端:  run_agent("agent-123", "讲个笑话", conversation_id="conv-abc")
         → 回复: ...
```

将每次响应中的`conversation_id`传回下一次`run_agent`调用以保持上下文。

## 环境变量

所有CLI参数也可通过环境变量设置:

| 变量 | CLI标志 | 说明 |
|------|---------|------|
| `OJ_TOKEN` | `--token` | 后端访问令牌(必填) |
| `OJ_BACKEND_URL` | `--backend-url` | 后端URL(默认: `http://localhost:8000`) |
| `OJ_TRANSPORT` | `--transport` | 传输类型: `stdio`或`sse`(默认: `stdio`) |
| `OJ_HOST` | `--host` | SSE服务器绑定主机(默认: `0.0.0.0`) |
| `OJ_PORT` | `--port` | SSE服务器端口(默认: `8080`) |

## 故障排除

**`ModuleNotFoundError: No module named 'channels'`**
: 确保`cwd`指向项目根目录(`agent-studio/`)，而非子目录。

**`ModuleNotFoundError: No module named 'mcp'`**
: 在您的Python环境中运行`pip install -r connect/adapters/mcp_server/requirements.txt`。

**`ERROR: --token is required`**
: 在args列表中设置`--token`或设置`OJ_TOKEN`环境变量。

**工具在客户端中出现但返回"Could not reach backend"**
: 验证OpenJiuwen后端正在运行且`--backend-url`正确。
  测试方法: `python -m connect.adapters.mcp_server --token YOUR_TOKEN`并观察连接错误。

**令牌过期 / 401错误**
: 通过CLI重新登录并更新MCP客户端配置中的令牌，然后重启客户端。
