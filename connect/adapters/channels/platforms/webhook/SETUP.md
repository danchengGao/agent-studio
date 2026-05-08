# Webhook Server Setup Guide

The webhook server exposes OpenJiuwen workflows and agents as plain HTTP endpoints.
Any tool that can make an HTTP request — n8n, Zapier, Make, curl, CI pipelines,
custom scripts — can trigger them without a bot account.

---

## Prerequisites

- OpenJiuwen backend running and accessible
- Python dependencies installed: `pip install -r channels/requirements.txt`

---

## Step 1 — Start the Server

From the project root:

```bash
python -m channels.run webhook
```

The server starts on `http://0.0.0.0:8080` by default. You should see:

```
✅ Connected to OpenJiuwen backend at http://localhost:8000
🌐 OpenJiuwen Webhook Server running on http://0.0.0.0:8080
   Docs: http://0.0.0.0:8080/docs
```

### Common options

```bash
# Custom port
python -m channels.run webhook --port 9000

# Custom backend URL
python -m channels.run webhook --backend-url http://my-server:8000

# Static backend token (requests don't need to supply their own)
python -m channels.run webhook --token eyJhbGci...

# Protect the server with an API key
python -m channels.run webhook --api-key mysecret

# All together
python -m channels.run webhook --port 9000 --backend-url http://my-server:8000 --token eyJhbGci... --api-key mysecret
```

All options can also be set via environment variables:

| Option | Env var |
|---|---|
| `--host` | `WEBHOOK_HOST` |
| `--port` | `WEBHOOK_PORT` |
| `--backend-url` | `BACKEND_URL` |
| `--token` | `ACCESS_TOKEN` |
| `--api-key` | `WEBHOOK_API_KEY` |

---

## Step 2 — Explore the API

Open **http://localhost:8080/docs** in your browser.

FastAPI generates interactive documentation (Swagger UI) automatically.
You can read the request/response schemas and try every endpoint directly from the browser.

---

## Step 3 — Make Your First Request

### Health check

```bash
curl http://localhost:8080/health
```

```json
{"webhook": "ok", "backend": {"status": "healthy"}}
```

### List workflows

```bash
curl -X POST http://localhost:8080/workflow/list \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Run a workflow

```bash
curl -X POST http://localhost:8080/workflow/run \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "your-workflow-id",
    "inputs": {
      "param1": "value1"
    }
  }'
```

Response:
```json
{
  "success": true,
  "outputs": {
    "result": "..."
  },
  "error": null
}
```

### Run an agent

```bash
curl -X POST http://localhost:8080/agent/run \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "your-agent-id",
    "message": "Hello, how can you help me?"
  }'
```

Response:
```json
{
  "success": true,
  "text": "I can help you with...",
  "conversation_id": "abc123",
  "error": null
}
```

### Continue a conversation

Pass `conversation_id` from the previous response to maintain context:

```bash
curl -X POST http://localhost:8080/agent/run \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "your-agent-id",
    "message": "Tell me more",
    "conversation_id": "abc123"
  }'
```

---

## Authentication

### Protecting the server with an API key

If started with `--api-key`, every request must include the header:

```bash
curl -X POST http://localhost:8080/workflow/run \
  -H "X-API-Key: mysecret" \
  -H "Content-Type: application/json" \
  -d '{"workflow_id": "xyz", "inputs": {}}'
```

### Providing the backend token

The server resolves the backend token from (highest priority first):

1. **`token` field in the request body**
   ```json
   {"workflow_id": "xyz", "inputs": {}, "token": "eyJhbGci..."}
   ```

2. **`Authorization: Bearer` header**
   ```bash
   curl -H "Authorization: Bearer eyJhbGci..."
   ```

3. **Static token** configured at startup via `--token` / `ACCESS_TOKEN`

---

## Connecting from External Tools

### n8n

1. Add an **HTTP Request** node
2. Method: `POST`
3. URL: `http://your-server:8080/workflow/run`
4. Body (JSON):
   ```json
   {
     "workflow_id": "{{ $json.workflow_id }}",
     "inputs": {{ $json.inputs }}
   }
   ```
5. Add header `X-API-Key: <your-key>` if using API key protection

### curl / scripts

```bash
#!/bin/bash
RESULT=$(curl -s -X POST http://localhost:8080/workflow/run \
  -H "Content-Type: application/json" \
  -d "{\"workflow_id\": \"$WORKFLOW_ID\", \"inputs\": {}}")
echo $RESULT | python3 -m json.tool
```

### GitHub Actions

```yaml
- name: Run OpenJiuwen workflow
  run: |
    curl -X POST ${{ secrets.WEBHOOK_URL }}/workflow/run \
      -H "X-API-Key: ${{ secrets.WEBHOOK_API_KEY }}" \
      -H "Content-Type: application/json" \
      -d '{"workflow_id": "${{ vars.WORKFLOW_ID }}", "inputs": {}}'
```

---

## Notes

- The server is **synchronous per request** — it blocks until the workflow/agent completes.
  Set generous HTTP timeouts for long-running workflows.
- There is no per-user session management — all requests use the same backend token.
- To expose the server publicly (e.g. for Zapier webhooks), put it behind a reverse proxy
  (nginx, Caddy) with HTTPS. Always use `--api-key` when exposed publicly.
