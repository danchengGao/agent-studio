# Connect — CLI

CLI让您可以直接从终端与OpenJiuwen工作流和智能体交互。
无需机器人账户，无需第三方服务 — 只需Python和您的后端。

## 前提条件

- OpenJiuwen后端正在运行且可访问
- Python 3.9+
- 除标准库外无额外依赖(共享客户端需要`requests`)

## 安装

```bash
pip install -r connect/adapters/channels/requirements.txt
```

## 第1步 — 登录

从项目根目录执行:

```bash
python -m connect.adapters.channels.run cli login
```

系统会提示您输入用户名和密码。会话令牌保存到
`connect/adapters/channels/platforms/cli/.cli_tokens.json`，并在后续所有命令中复用。

### 自定义后端URL

```bash
python -m connect.adapters.channels.run cli --backend-url http://my-server:8000 login
```

也可以设置环境变量，避免每次输入标志:

```bash
export BACKEND_URL=http://my-server:8000
python -m connect.adapters.channels.run cli login
```

## 第2步 — 检查状态

```bash
python -m connect.adapters.channels.run cli status
```

显示您是否已登录以及令牌所属的用户。

```bash
python -m connect.adapters.channels.run cli health
```

检查后端是否可达且健康。

## 第3步 — 使用工作流

### 列出所有工作流

```bash
python -m connect.adapters.channels.run cli workflow list
```

### 搜索工作流

```bash
python -m connect.adapters.channels.run cli workflow search "天气"
```

### 运行工作流

```bash
python -m connect.adapters.channels.run cli workflow execute <workflow-id>
```

如果工作流需要输入参数，CLI会交互式地逐一提示您输入。

也可以通过`-i`直接提供参数:

```bash
python -m connect.adapters.channels.run cli workflow execute <workflow-id> -i city=Beijing -i days=3
```

`-i`可重复使用以提供多个参数。未通过`-i`提供的参数将以交互方式提示输入。

## 第4步 — 使用智能体

### 列出所有智能体

```bash
python -m connect.adapters.channels.run cli agent list
```

### 搜索智能体

```bash
python -m connect.adapters.channels.run cli agent search "客服"
```

### 发送单条消息

```bash
python -m connect.adapters.channels.run cli agent execute <agent-id> "你好，你能帮我做什么？"
```

### 交互式聊天会话

```bash
python -m connect.adapters.channels.run cli agent chat <agent-id>
```

启动交互式聊天会话。在`You:`提示符处输入消息并按Enter。
输入`exit`、`quit`或`q`结束会话，或按`Ctrl+C`。

```
Starting chat with agent <agent-id>
Type 'exit' or press Ctrl+C to end the chat.

You: 你能做什么？

Agent: 我可以帮您...

You: exit

Chat ended.
```

## 第5步 — 登出

```bash
python -m connect.adapters.channels.run cli logout
```

删除当前OS用户保存的令牌。

## 命令参考

| 命令 | 说明 |
|------|------|
| `cli login` | 登录(提示输入凭据) |
| `cli logout` | 登出 |
| `cli status` | 显示登录状态 |
| `cli health` | 检查后端健康状态 |
| `cli workflow list` | 列出所有工作流 |
| `cli workflow search <keyword>` | 搜索工作流 |
| `cli workflow execute <id> [-i KEY=VALUE ...]` | 执行工作流 |
| `cli agent list` | 列出所有智能体 |
| `cli agent search <keyword>` | 搜索智能体 |
| `cli agent execute <id> <message>` | 向智能体发送一条消息 |
| `cli agent chat <id>` | 启动交互式聊天会话 |

所有命令均可使用的全局选项:

```bash
python -m connect.adapters.channels.run cli --backend-url http://my-server:8000 <command>
```

## 令牌存储

令牌存储在`connect/adapters/channels/platforms/cli/.cli_tokens.json`中，以OS用户名(`whoami`)为键。
同一机器上的多个OS用户各有独立的会话。此文件已添加到`.gitignore`，不会被提交。
