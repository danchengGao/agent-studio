from openjiuwen.core.common.logging import logger

from telegram import Update
from telegram.ext import ContextTypes

from connect.client.agents import list_agents
from ...auth import require_login


@require_login
async def agents_list_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """List all agents - /agents"""
    logger.info("agents_list_handler called: user_id=%s", update.effective_user.id)
    backend_client = context.user_data.get('backend_client')
    try:
        await update.message.reply_text("🤖 Fetching agents from backend...")
        result = list_agents(backend_client)
        data = result.get('data', {})
        agents = data.get('agent_items', [])
        total = data.get('pagination', {}).get('total', len(agents))

        if agents:
            message = f"✅ Found {total} agents:\n\n"
            for i, agent in enumerate(agents[:10], 1):
                icon = agent.get('icon', '🤖')
                name = agent.get('agent_name', 'Unnamed')
                agent_id = agent.get('agent_id', 'N/A')
                desc = agent.get('description', 'No description')
                message += f"{i}. {icon} *{name}*\n"
                message += f"   ID: `{agent_id}`\n"
                message += f"   {desc[:60]}{'...' if len(desc) > 60 else ''}\n\n"
            if total > 10:
                message += f"... and {total - 10} more agents\n\n"
            message += "\n💡 To chat with an agent:\n/agent_start_chat <agent_id>\n"
            message += "Or to send a single message:\n/agent_execute <agent_id> <message>"
        else:
            message = "ℹ️ No agents found"

        await update.message.reply_text(message, parse_mode='Markdown')
    except Exception as e:
        await update.message.reply_text(f"❌ Error: {str(e)}")
