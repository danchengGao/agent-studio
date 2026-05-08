"""
Response formatters — convert raw API dicts into human-readable strings.
No MCP or OJ client dependency; pure data transformation.
"""
from typing import Dict, Any


def format_agents(data: Dict[str, Any]) -> str:
    """Format a list_agents / search_agents API response."""
    inner = data.get('data', {})
    items = inner.get('agent_items', inner.get('agent_list', inner.get('list', [])))
    pagination = inner.get('pagination', {})
    total = pagination.get('total', inner.get('total', len(items)))
    if not items:
        return "No agents found."
    lines = [f"Found {total} agent(s):\n"]
    for agent in items:
        agent_id = agent.get('agent_id', agent.get('id', 'unknown'))
        name = agent.get('agent_name', agent.get('name', '(unnamed)'))
        desc = agent.get('description', agent.get('desc', '')).strip()
        line = f"  • [{agent_id}] {name}"
        if desc:
            line += f"\n      {desc}"
        lines.append(line)
    return "\n".join(lines)


def format_agent_detail(data: Dict[str, Any]) -> str:
    """Format a single agent's full definition (name, description, model, tools)."""
    agent = data.get('data', data)
    name = agent.get('agent_name', agent.get('name', '(unnamed)'))
    desc = agent.get('description', agent.get('desc', '')).strip()
    agent_id = agent.get('agent_id', agent.get('id', 'unknown'))

    lines = [f"Agent: {name}  (ID: {agent_id})"]
    if desc:
        lines.append(f"Description: {desc}")

    model = agent.get('model', agent.get('model_name', ''))
    if model:
        lines.append(f"Model: {model}")

    tools = agent.get('tools', agent.get('tool_list', []))
    if tools:
        lines.append("\nTools:")
        for t in tools:
            tname = t.get('name', t) if isinstance(t, dict) else str(t)
            lines.append(f"  • {tname}")

    return "\n".join(lines)
