from openjiuwen.core.common.logging import logger

from telegram import Update
from telegram.ext import ContextTypes

from connect.client.agents import search_agents
from ...auth import require_login


@require_login
async def agents_search_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Search agents - /agents_search <keyword>"""
    logger.info("agents_search_handler called: user_id=%s, args=%s", update.effective_user.id, context.args)
    backend_client = context.user_data.get('backend_client')
    try:
        if not context.args:
            await update.message.reply_text(
                "❌ Usage: /agents_search <keyword>\n"
                "Example: /agents_search customer support"
            )
            return

        keyword = ' '.join(context.args)
        await update.message.reply_text(f"🔍 Searching agents for: '{keyword}'...")
        result = search_agents(backend_client, keyword)
        data = result.get('data', {})
        agents = data.get('agent_items', [])

        if agents:
            message = f"🔍 Found {len(agents)} agents matching '{keyword}':\n\n"
            for i, agent in enumerate(agents[:10], 1):
                icon = agent.get('icon', '🤖')
                name = agent.get('agent_name', 'Unnamed')
                agent_id = agent.get('agent_id', 'N/A')
                message += f"{i}. {icon} *{name}*\n   ID: `{agent_id}`\n\n"
        else:
            message = f"ℹ️ No agents found matching '{keyword}'"

        await update.message.reply_text(message, parse_mode='Markdown')
    except Exception as e:
        await update.message.reply_text(f"❌ Error: {str(e)}")
