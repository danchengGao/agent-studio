# Connect — Slack

Slack机器人使用**Socket Mode** — 无需公共URL或服务器暴露。
用户通过直接消息或频道中的斜杠命令与机器人交互。

## 前提条件

- Slack账户及可安装应用的工作区访问权限(免费工作区即可)
- OpenJiuwen后端正在运行且可访问

## 第1步 — 创建Slack应用

1. 前往 [api.slack.com/apps](https://api.slack.com/apps)
2. 点击**Create New App** → **From scratch**
3. 填写:
   - **App Name**: 例如`OpenJiuwen`
   - **Pick a workspace**: 选择目标工作区
4. 点击**Create App**

## 第2步 — 启用Socket Mode

Socket Mode让机器人无需公共URL即可连接到Slack。

1. 在左侧边栏，点击**Socket Mode**
2. 将**Enable Socket Mode**切换为ON
3. 当提示创建App-Level Token时:
   - **Token Name**: 例如`socket-token`
   - **Scopes**: 添加`connections:write`
4. 点击**Generate**并复制令牌 — 以`xapp-`开头

**将此保存为您的`APP_TOKEN`。**

## 第3步 — 添加Bot Token权限范围

1. 在左侧边栏，点击**OAuth & Permissions**
2. 滚动到**Bot Token Scopes**并逐一添加:

   | 权限范围 | 用途 |
   |---------|------|
   | `commands` | 接收斜杠命令调用 |
   | `chat:write` | 发送消息 |
   | `im:history` | 读取私信 |
   | `im:read` | 查看私信频道 |
   | `im:write` | 发起私信对话 |

## 第4步 — 添加斜杠命令

1. 在左侧边栏，点击**Slash Commands**
2. 对下表中的每个命令点击**Create New Command**
   - **Request URL**: 任意占位URL，如`https://example.com`(Socket Mode中不使用)
   - **Short Description**: 复制下表中的说明

   | 命令 | 简短说明 |
   |------|---------|
   | `/login` | 登录OpenJiuwen后端 |
   | `/logout` | 登出 |
   | `/auth_status` | 检查登录状态 |
   | `/workflows` | 列出所有工作流 |
   | `/workflows_search` | 按关键词搜索工作流 |
   | `/workflow_run` | 运行工作流 |
   | `/workflow_cancel` | 取消工作流参数收集 |
   | `/agents` | 列出所有智能体 |
   | `/agents_search` | 按关键词搜索智能体 |
   | `/agent_run` | 向智能体发送单条消息 |
   | `/agent_chat` | 与智能体开始交互式聊天 |
   | `/agent_end_chat` | 结束当前智能体聊天会话 |
   | `/health` | 检查后端健康状态 |
   | `/help` | 显示所有可用命令 |

   > 继续之前创建全部14个命令 — Slack会逐一保存。

## 第5步 — 启用私信

机器人使用私信进行多步骤流程(登录、工作流参数收集、智能体聊天)。

1. 在左侧边栏，点击**App Home**
2. 滚动到**Show Tabs**
3. 将**Allow users to send Slash commands and messages from the messages tab**切换为ON

## 第6步 — 将应用安装到工作区

1. 在左侧边栏，点击**OAuth & Permissions**
2. 向上滚动并点击**Install to Workspace**
3. 查看权限并点击**Allow**
4. 复制**Bot User OAuth Token** — 以`xoxb-`开头

**将此保存为您的`BOT_TOKEN`。**

## 安装

### 直接运行(本地开发)

如果直接在您的机器上运行后端，请先安装依赖:

```bash
pip install -r connect/adapters/channels/requirements.txt
```

### Docker运行(生产部署)

如果在Docker中运行OpenJiuwen，依赖已通过`pyproject.toml`安装 — 跳到下一步。

## 第7步 — 运行机器人

**直接运行:**
```bash
python -m connect.adapters.channels.run slack <BOT_TOKEN> <APP_TOKEN>
```

**Docker运行:**
```bash
docker exec -it <container_id> python -m connect.adapters.channels.run slack <BOT_TOKEN> <APP_TOKEN>
```

将`<container_id>`替换为实际的容器ID(使用`docker ps`查找)。

**注意:** 下面所有示例展示的是直接运行命令。对于Docker，请在每个命令前加上`docker exec -it <container_id>`。

**使用自定义后端URL:**
```bash
python -m connect.adapters.channels.run slack <BOT_TOKEN> <APP_TOKEN> http://your-server:8000
```

**使用静态访问令牌**(所有用户共享一个后端会话 — 无需每用户登录):
```bash
python -m connect.adapters.channels.run slack <BOT_TOKEN> <APP_TOKEN> http://your-server:8000 <ACCESS_TOKEN>
```

应看到:
```
Connected to OpenJiuwen backend at http://localhost:8000
OpenJiuwen Slack Bot is running! (Socket Mode)
```

## 第8步 — 测试机器人

1. 打开Slack工作区 → 在边栏**Apps**下找到机器人
2. 在**Messages**标签中输入`/help` — 应看到命令列表
3. 输入`/health` — 机器人应报告后端状态
4. 输入`/login`并按提示进行身份认证

对于多步骤流程(登录、工作流参数收集、智能体聊天)，机器人会要求您在私信对话中回复纯文本。

## 注意事项

- 两个令牌都很敏感 — 像密码一样对待。切勿公开分享。
- 用户会话存储在`connect/adapters/channels/platforms/slack/.slack_bot_tokens.json`中(已gitignore)。
- 机器人必须保持运行状态，用户才能与其交互。使用`Ctrl+C`停止。
- 重新安装应用(如添加新权限范围)后会获得新的`BOT_TOKEN` — 更新运行命令。
- 若要从频道使用斜杠命令，通过**Integrations** → **Add apps**将机器人添加到该频道。
