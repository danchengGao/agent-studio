# Connect — Email(邮件)

邮件机器人通过轮询**IMAP收件箱**接收命令，并通过**SMTP**回复。
仅使用Python标准库 — 无需额外依赖。

每个发件人的邮件地址用作其持久用户ID，因此每个发邮件给机器人的人都有独立的会话和令牌。

## 工作原理

1. 您创建一个专用邮件账户(如`mybot@gmail.com`)
2. 使用该账户的凭据启动邮件机器人
3. 任何人都可以向`mybot@gmail.com`发送命令
4. 机器人读取邮件、处理命令并回复

**示例流程:**
- 启动机器人: `python -m connect.adapters.channels.run email imap.gmail.com smtp.gmail.com aibot@gmail.com APP_PASSWORD`
- 向`aibot@gmail.com`发送正文为`help`的邮件
- 机器人回复可用命令列表
- 回复机器人的邮件继续下一个命令 — 机器人读取并响应

每封邮件正文的第一个非引用、非空行被视为命令。引用的回复文本(以`>`开头的行)会自动去除，因此直接回复机器人邮件即可。

## 前提条件

- Python 3.9+
- 已启用IMAP的邮件账户(Gmail、Outlook或任何IMAP/SMTP提供商)
- 正在运行的OpenJiuwen后端

## 安装

```bash
pip install -r connect/adapters/channels/requirements.txt
```

邮件机器人仅使用标准库，无需额外安装包。

## 第1步 — 在邮件账户上启用IMAP

### Gmail

1. 打开Gmail → **设置** → **查看所有设置**
2. 进入**转发和POP/IMAP**标签
3. 在**IMAP访问**下，选择**启用IMAP**并点击**保存更改**

**创建应用专用密码(如果开启了两步验证则必须):**

1. 前往 [myaccount.google.com](https://myaccount.google.com) → **安全性**
2. 在"您登录Google的方式"下，点击**两步验证**
3. 滚动到底部 → **应用专用密码**
4. 选择**邮件**和您的设备 → 点击**生成**
5. 复制16位密码 — 将其作为下方的`<PASSWORD>`使用

### Outlook / Microsoft 365

1. 登录 [outlook.com](https://outlook.com) → **设置** → **邮件** → **同步邮件**
2. 启用**IMAP**访问
3. IMAP主机: `outlook.office365.com`，SMTP主机: `smtp-mail.outlook.com`

### 中国邮件提供商(163.com、188.com、QQ邮箱)

中国邮件提供商需要**授权码**而非账户密码:

#### 163.com / 126.com

1. 登录 [mail.163.com](https://mail.163.com) → **设置** → **POP3/SMTP/IMAP**
2. 启用**IMAP/SMTP服务**
3. 点击**生成授权码** — 复制此码(不是账户密码)
4. IMAP主机: `imap.163.com`，SMTP主机: `smtp.163.com`

#### 188.com

1. 登录188.com邮箱 → **设置** → **账户安全**
2. 启用**IMAP/SMTP服务**并生成**授权码**
3. IMAP主机: `imap.188.com`，SMTP主机: `smtp.188.com`

#### QQ邮箱

1. 前往 [mail.qq.com](https://mail.qq.com) → **设置** → **账户**
2. 启用**IMAP/SMTP服务**并生成**授权码**
3. IMAP主机: `imap.qq.com`，SMTP主机: `smtp.qq.com`

## 第2步 — 启动机器人

### Gmail

```bash
python -m connect.adapters.channels.run email \
  imap.gmail.com smtp.gmail.com \
  bot@gmail.com APP_PASSWORD
```

### Outlook

```bash
python -m connect.adapters.channels.run email \
  outlook.office365.com smtp-mail.outlook.com \
  bot@outlook.com YOUR_PASSWORD \
  --smtp-port 587
```

### 163.com

```bash
python -m connect.adapters.channels.run email \
  imap.163.com smtp.163.com \
  yourname@163.com AUTHORIZATION_CODE
```

### 使用自定义后端URL

```bash
python -m connect.adapters.channels.run email \
  imap.gmail.com smtp.gmail.com \
  bot@gmail.com APP_PASSWORD \
  --backend-url http://my-server:8000
```

### 降低轮询频率(减少IMAP负载)

```bash
python -m connect.adapters.channels.run email \
  imap.gmail.com smtp.gmail.com \
  bot@gmail.com APP_PASSWORD \
  --poll-interval 30
```

## 配置选项

| 参数/选项 | 必填 | 默认值 | 说明 |
|----------|------|--------|------|
| `IMAP_HOST` | 是 | — | IMAP服务器主机名 |
| `SMTP_HOST` | 是 | — | SMTP服务器主机名 |
| `EMAIL_ADDRESS` | 是 | — | 机器人监控并回复的邮件地址 |
| `PASSWORD` | 是 | — | 邮件账户密码或授权码 |
| `--imap-port PORT` | 否 | `993` | IMAP SSL端口。环境变量: `IMAP_PORT` |
| `--smtp-port PORT` | 否 | `587` | SMTP STARTTLS端口。环境变量: `SMTP_PORT` |
| `--backend-url URL` | 否 | `http://localhost:8000` | OpenJiuwen后端URL。环境变量: `BACKEND_URL` |
| `--access-token TOKEN` | 否 | — | 静态后端令牌(跳过每用户登录)。环境变量: `ACCESS_TOKEN` |
| `--poll-interval N` | 否 | `10` | 收件箱轮询间隔(秒)。环境变量: `EMAIL_POLL_INTERVAL` |

## 可用命令

将以下命令作为发送给机器人邮件正文的第一行:

| 命令 | 说明 |
|------|------|
| `login` | 登录OpenJiuwen后端 |
| `logout` | 登出 |
| `status` | 检查登录状态 |
| `cancel` | 取消任何活动操作 |
| `health` | 检查后端连接 |
| `help` | 显示所有可用命令 |
| `workflows` | 列出所有工作流 |
| `workflows search <query>` | 按关键词搜索工作流 |
| `workflow execute <id>` | 运行工作流(机器人回复参数提示) |
| `workflow skip` | 跳过可选参数 |
| `workflow cancel` | 取消参数收集 |
| `agents` | 列出所有智能体 |
| `agents search <query>` | 按关键词搜索智能体 |
| `agent execute <id> <message>` | 向智能体发送单条消息 |
| `agent chat <id>` | 开始交互式聊天会话 |

多轮流程(登录、工作流参数收集、智能体聊天)通过回复机器人邮件进行。每次回复都被读取为流程中的下一个输入。

## 生产部署

systemd服务示例:

```ini
[Unit]
Description=OpenJiuwen Email Bot
After=network.target

[Service]
WorkingDirectory=/opt/openjiuwen
ExecStart=python -m connect.adapters.channels.run email \
          imap.gmail.com smtp.gmail.com \
          bot@gmail.com APP_PASSWORD \
          --backend-url http://localhost:8000 \
          --poll-interval 15
Restart=always
EnvironmentFile=/opt/openjiuwen/.env

[Install]
WantedBy=multi-user.target
```

## 令牌存储

用户会话令牌存储在`connect/adapters/channels/platforms/email/.email_tokens.json`中，以发件人邮件地址(小写)为键。此文件已添加到`.gitignore`。

## 故障排除

| 问题 | 解决方案 |
|------|----------|
| `IMAP login failed` | 检查邮箱/密码。Gmail需使用应用专用密码。中国提供商(163.com、188.com、QQ)需使用授权码。 |
| `SELECT INBOX failed: Unsafe Login`(188.com、163.com) | 已通过IMAP ID命令自动处理。请确保在邮箱设置中明确启用了IMAP/SMTP服务，并使用授权码而非账户密码。 |
| `SMTP authentication failed` | Gmail使用应用专用密码；中国提供商使用授权码。 |
| SMTP连接意外关闭 | 机器人自动尝试STARTTLS(587端口)和SSL(465端口)。如果两者均失败，请检查防火墙设置。 |
| 机器人看不到新邮件 | 确认账户设置中已启用IMAP。 |
| 命令无法识别 | 确保命令是邮件正文的第一个非空行，不在引用回复之后。 |
| Gmail拒绝登录 | 启用IMAP并使用应用专用密码。 |
