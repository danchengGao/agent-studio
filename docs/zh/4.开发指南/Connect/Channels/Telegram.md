# Connect — Telegram

Telegram机器人通过python-telegram-bot使用长轮询。用户通过私信对话中的斜杠命令与其交互。

## 前提条件

- Telegram账户([telegram.org](https://telegram.org))
- OpenJiuwen后端正在运行且可访问

## 第1步 — 通过BotFather创建机器人

BotFather是Telegram官方的机器人创建和管理工具。

1. 打开Telegram，搜索**@BotFather**(蓝色认证勾)
2. 开始对话: 点击**Start**
3. 发送`/newbot`
4. BotFather询问**显示名称** — 这是用户在聊天中看到的名称。
   示例: `OpenJiuwen Assistant`
5. BotFather询问**用户名** — 必须以`bot`结尾，无空格。
   示例: `openjiuwen_assistant_bot`
6. BotFather回复您的**Bot Token**:
   ```
   Done! Use this token to access the HTTP API:
   123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   **复制并保存此令牌。**

## 第2步 — (可选)配置机器人

仍在BotFather对话中:

**设置描述**(用户首次打开机器人时显示):
```
/setdescription
```
选择您的机器人，然后输入描述，例如:
> 直接从Telegram与OpenJiuwen工作流和智能体交互。

**设置头像:**
```
/setuserpic
```
选择您的机器人，然后发送图片。

**设置命令列表**(在Telegram中启用自动补全):
```
/setcommands
```
选择您的机器人，然后粘贴:
```
login - 登录OpenJiuwen后端
logout - 登出
status - 检查登录状态
workflows - 列出所有工作流
workflow_search - 搜索工作流
workflow_execute - 运行工作流
agents - 列出所有智能体
agent_search - 搜索智能体
agent_execute - 向智能体发送单条消息
agent_start_chat - 与智能体开始交互式聊天
health - 检查后端健康状态
help - 显示所有命令
```

## 第3步 — 运行机器人

```bash
python -m connect.adapters.channels.run telegram <BOT_TOKEN>
```

**使用自定义后端URL:**
```bash
python -m connect.adapters.channels.run telegram <BOT_TOKEN> http://your-server:8000
```

**使用静态访问令牌**(所有用户共享一个后端会话 — 无需每用户登录):
```bash
python -m connect.adapters.channels.run telegram <BOT_TOKEN> http://your-server:8000 <ACCESS_TOKEN>
```

应看到:
```
Connected to OpenJiuwen backend at http://localhost:8000
OpenJiuwen Telegram Bot is running!
```

## 第4步 — 测试机器人

1. 打开Telegram，搜索您选择的机器人用户名(如`@openjiuwen_assistant_bot`)
2. 点击**Start**
3. 发送`/help` — 应看到可用命令列表
4. 发送`/health` — 机器人应报告后端状态
5. 发送`/login`并按提示进行身份认证

## 可用命令

| 命令 | 说明 |
|------|------|
| `/login` | 登录OpenJiuwen后端 |
| `/logout` | 登出 |
| `/status` | 检查登录状态 |
| `/workflows` | 列出所有工作流 |
| `/workflow_search <query>` | 按关键词搜索工作流 |
| `/workflow_execute <id>` | 运行工作流 |
| `/agents` | 列出所有智能体 |
| `/agent_search <query>` | 按关键词搜索智能体 |
| `/agent_execute <id> <message>` | 向智能体发送单条消息 |
| `/agent_start_chat <id>` | 与智能体开始交互式聊天 |
| `/health` | 检查后端健康状态 |
| `/help` | 显示所有命令 |

## 注意事项

- 机器人令牌很敏感 — 像密码一样对待。切勿公开分享。
- 用户会话存储在`connect/adapters/channels/platforms/telegram/.telegram_bot_tokens.json`中(已gitignore)。
- 机器人必须保持运行状态，用户才能与其交互。使用`Ctrl+C`停止。
- 若要获取新令牌，在BotFather中使用`/revoke`，然后使用`/newbot`或`/mybots`。
