# Connect — CLI

The CLI lets you interact with OpenJiuwen workflows and agents directly from your terminal.
No bot account, no third-party service — just Python and your backend.

## Prerequisites

- OpenJiuwen backend running and accessible
- Python 3.9+
- No extra dependencies beyond the standard library (shared client requires `requests`)

## Installation

### For Direct Run (Local Development)

If running the backend directly on your machine, install dependencies first:

```bash
pip install -r connect/adapters/channels/requirements.txt
```

### For Docker Run (Production)

If running OpenJiuwen in Docker, dependencies are already installed via `pyproject.toml` — skip to Step 1.

## Step 1 — Log In

Choose the command based on your deployment mode:

**Direct Run:**
```bash
python -m connect.adapters.channels.run cli login
```

**Docker Run:**
```bash
docker exec -it <container_id> python -m connect.adapters.channels.run cli login
```

Replace `<container_id>` with your actual container ID (find it with `docker ps`).

You will be prompted for your username and password. The session token is saved to
`connect/adapters/channels/platforms/cli/.cli_tokens.json` and reused for all subsequent commands.

**Note:** All examples below show Direct Run commands. For Docker, prefix each command with:
```bash
docker exec -it <container_id> python -m connect.adapters.channels.run ...
```

### Custom backend URL

```bash
python -m connect.adapters.channels.run cli --backend-url http://my-server:8000 login
```

You can also set the environment variable instead of typing the flag every time:

```bash
export BACKEND_URL=http://my-server:8000
python -m connect.adapters.channels.run cli login
```

## Step 2 — Check Status

```bash
python -m connect.adapters.channels.run cli status
```

Shows whether you are logged in and which user the token belongs to.

```bash
python -m connect.adapters.channels.run cli health
```

Checks that the backend is reachable and healthy.

## Step 3 — Work with Workflows

### List all workflows

```bash
python -m connect.adapters.channels.run cli workflow list
```

### Search workflows

```bash
python -m connect.adapters.channels.run cli workflow search "weather"
```

### Run a workflow

```bash
python -m connect.adapters.channels.run cli workflow execute <workflow-id>
```

If the workflow requires input parameters, the CLI will prompt you for each one interactively.

You can also supply parameters directly with `-i`:

```bash
python -m connect.adapters.channels.run cli workflow execute <workflow-id> -i city=London -i days=3
```

`-i` can be repeated for multiple parameters. Any parameter not supplied via `-i` will be prompted interactively.

## Step 4 — Work with Agents

### List all agents

```bash
python -m connect.adapters.channels.run cli agent list
```

### Search agents

```bash
python -m connect.adapters.channels.run cli agent search "support"
```

### Send a single message

```bash
python -m connect.adapters.channels.run cli agent execute <agent-id> "Hello, how can you help me?"
```

### Interactive chat session

```bash
python -m connect.adapters.channels.run cli agent chat <agent-id>
```

Starts an interactive chat session. Type your messages at the `You:` prompt and press Enter.
Type `exit`, `quit`, or `q` to end the session, or press `Ctrl+C`.

```
Starting chat with agent <agent-id>
Type 'exit' or press Ctrl+C to end the chat.

You: What can you do?

Agent: I can help you with...

You: exit

Chat ended.
```

## Step 5 — Log Out

```bash
python -m connect.adapters.channels.run cli logout
```

Removes the saved token for your OS user.

## Command Reference

| Command | Description |
|---------|-------------|
| `cli login` | Log in (prompts for credentials) |
| `cli logout` | Log out |
| `cli status` | Show login status |
| `cli health` | Check backend health |
| `cli workflow list` | List all workflows |
| `cli workflow search <keyword>` | Search workflows |
| `cli workflow execute <id> [-i KEY=VALUE ...]` | Execute a workflow |
| `cli agent list` | List all agents |
| `cli agent search <keyword>` | Search agents |
| `cli agent execute <id> <message>` | Send one message to an agent |
| `cli agent chat <id>` | Start interactive chat session |

Global option available for all commands:

```bash
python -m connect.adapters.channels.run cli --backend-url http://my-server:8000 <command>
```

## Token Storage

Tokens are stored in `connect/adapters/channels/platforms/cli/.cli_tokens.json`, keyed by OS username
(`whoami`). Multiple OS users on the same machine each have their own session. This file is
gitignored and will not be committed.
