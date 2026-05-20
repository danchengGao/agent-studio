# Connect — Webhook

Webhook服务器将OpenJiuwen工作流和智能体公开为普通HTTP端点。
任何可以发出HTTP请求的工具 — n8n、Zapier、Make、curl、CI流水线、自定义脚本 —
都可以触发它们，无需机器人账户。

## 前提条件

- OpenJiuwen后端正在运行且可访问
- Python依赖项: `pip install -r connect/adapters/channels/requirements.txt`

## 第1步 — 启动服务器

```bash
python -m connect.adapters.channels.run webhook
```

服务器默认在`http://0.0.0.0:8080`启动:

```
Connected to OpenJiuwen backend at http://localhost:8000
OpenJiuwen Webhook Server running on http://0.0.0.0:8080
   Docs: http://0.0.0.0:8080/docs
```

### 常用选项

```bash
# 自定义端口
python -m connect.adapters.channels.run webhook --port 9000

# 自定义后端URL
python -m connect.adapters.channels.run webhook --backend-url http://my-server:8000

# 静态后端令牌(调用方无需提供自己的令牌)
python -m connect.adapters.channels.run webhook --token eyJhbGci...

# 使用API密钥保护服务器
python -m connect.adapters.channels.run webhook --api-key mysecret

# 全部组合
python -m connect.adapters.channels.run webhook \
  --port 9000 \
  --backend-url http://my-server:8000 \
  --token eyJhbGci... \
  --api-key mysecret
```

### 环境变量

| 选项 | 环境变量 |
|------|---------|
| `--host` | `WEBHOOK_HOST` |
| `--port` | `WEBHOOK_PORT` |
| `--backend-url` | `BACKEND_URL` |
| `--token` | `ACCESS_TOKEN` |
| `--api-key` | `WEBHOOK_API_KEY` |

## 第2步 — 探索API

在浏览器中打开 **http://localhost:8080/docs**。

FastAPI自动生成交互式Swagger UI文档。您可以查阅请求/响应模式，并直接从浏览器试用每个端点。

## 第3步 — 身份认证

服务器按以下优先顺序解析后端令牌:

1. **`X-Token`请求头**: `curl -H "X-Token: eyJhbGci..."`
2. **`Authorization: Bearer`请求头**: `curl -H "Authorization: Bearer eyJhbGci..."`
3. 启动时通过`--token` / `ACCESS_TOKEN`配置的**静态令牌**

### 通过API登录

如果您没有令牌，调用`/auth/login`一次即可获取:

```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "you@example.com", "password": "yourpassword"}'
```

```json
{
  "success": true,
  "token": "eyJhbGci...",
  "space_id": "your-space-id",
  "refresh_token": "...",
  "error": null
}
```

## 第4步 — 发送请求

### 健康检查

```bash
curl http://localhost:8080/health
```

```json
{"webhook": "ok", "backend": {"status": "healthy"}}
```

### 工作流

**列出所有工作流:**
```bash
curl http://localhost:8080/workflows/list -H "X-Token: eyJhbGci..."
```

**搜索工作流:**
```bash
curl "http://localhost:8080/workflows/search?keyword=天气" -H "X-Token: eyJhbGci..."
```

**获取工作流详情:**
```bash
curl "http://localhost:8080/workflows/get?workflow_id=your-workflow-id" -H "X-Token: eyJhbGci..."
```

**执行工作流:**
```bash
curl -X POST http://localhost:8080/workflows/execute \
  -H "Content-Type: application/json" \
  -H "X-Token: eyJhbGci..." \
  -d '{"workflow_id": "your-workflow-id", "inputs": {"param1": "value1"}}'
```

响应:
```json
{"success": true, "outputs": {"result": "..."}, "error": null}
```

### 智能体

**列出所有智能体:**
```bash
curl http://localhost:8080/agents/list -H "X-Token: eyJhbGci..."
```

**搜索智能体:**
```bash
curl "http://localhost:8080/agents/search?keyword=客服" -H "X-Token: eyJhbGci..."
```

**向智能体发送单条消息:**
```bash
curl -X POST http://localhost:8080/agents/execute \
  -H "Content-Type: application/json" \
  -H "X-Token: eyJhbGci..." \
  -d '{"agent_id": "your-agent-id", "message": "你好，你能帮我做什么？"}'
```

响应:
```json
{
  "success": true,
  "text": "我可以帮您...",
  "conversation_id": "3f2a1b4c-...",
  "error": null
}
```

**继续对话**(传入上一响应中的`conversation_id`以保持上下文):
```bash
curl -X POST http://localhost:8080/agents/execute \
  -H "Content-Type: application/json" \
  -H "X-Token: eyJhbGci..." \
  -d '{"agent_id": "your-agent-id", "message": "请继续", "conversation_id": "3f2a1b4c-..."}'
```

## 所有端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/health` | Webhook服务器和后端健康状态 |
| `POST` | `/auth/login` | 用凭据换取令牌 |
| `GET` | `/workflows/list` | 列出所有工作流 |
| `GET` | `/workflows/search?keyword=...` | 按名称搜索工作流 |
| `GET` | `/workflows/get?workflow_id=...` | 获取工作流详情 |
| `POST` | `/workflows/execute` | 执行工作流并返回输出 |
| `GET` | `/agents/list` | 列出所有智能体 |
| `GET` | `/agents/search?keyword=...` | 按名称搜索智能体 |
| `POST` | `/agents/execute` | 向智能体发送消息并获取回复 |

## 使用API密钥保护服务器

使用`--api-key`启动时，每个请求必须包含`X-API-Key`请求头:

```bash
curl -X POST http://localhost:8080/workflows/execute \
  -H "X-API-Key: mysecret" \
  -H "X-Token: eyJhbGci..." \
  -H "Content-Type: application/json" \
  -d '{"workflow_id": "xyz", "inputs": {}}'
```

## 从外部工具连接

### n8n

1. 添加**HTTP Request**节点
2. 方法: `POST`，URL: `http://your-server:8080/workflows/execute`
3. 正文(JSON): `{"workflow_id": "{{ $json.workflow_id }}", "inputs": {{ $json.inputs }}}`
4. 添加请求头`X-Token: <your-token>`(如使用API密钥保护，还需添加`X-API-Key`)

### curl / 脚本

```bash
#!/bin/bash
RESULT=$(curl -s -X POST http://localhost:8080/workflows/execute \
  -H "Content-Type: application/json" \
  -H "X-Token: $BACKEND_TOKEN" \
  -d "{\"workflow_id\": \"$WORKFLOW_ID\", \"inputs\": {}}")
echo $RESULT | python3 -m json.tool
```

### GitHub Actions

```yaml
- name: 运行OpenJiuwen工作流
  run: |
    curl -X POST ${{ secrets.WEBHOOK_URL }}/workflows/execute \
      -H "X-API-Key: ${{ secrets.WEBHOOK_API_KEY }}" \
      -H "X-Token: ${{ secrets.BACKEND_TOKEN }}" \
      -H "Content-Type: application/json" \
      -d '{"workflow_id": "${{ vars.WORKFLOW_ID }}", "inputs": {}}'
```

## 注意事项

- 服务器每个请求同步阻塞，直到工作流/智能体完成。对于长时间运行的工作流，请设置足够长的HTTP超时。
- 没有每用户会话管理 — 所有请求使用同一后端令牌。
- 若要公开暴露服务器(如用于Zapier webhook)，请将其置于反向代理(nginx、Caddy)后并启用HTTPS，并始终使用`--api-key`。
