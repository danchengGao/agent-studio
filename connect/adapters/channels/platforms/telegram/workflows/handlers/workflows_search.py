from openjiuwen.core.common.logging import logger

from telegram import Update
from telegram.ext import ContextTypes

from connect.client.workflows import search_workflows
from ...auth import require_login


@require_login
async def workflows_search_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Search workflows - /workflows_search <keyword>"""
    logger.info("workflows_search_handler called: user_id=%s, args=%s", update.effective_user.id, context.args)
    backend_client = context.user_data.get('backend_client')
    try:
        if not context.args:
            await update.message.reply_text(
                "❌ Usage: /workflow\\_search `<keyword>`",
                parse_mode='Markdown'
            )
            return

        keyword = ' '.join(context.args)
        await update.message.reply_text(f"🔍 Searching workflows for: '{keyword}'...")
        result = search_workflows(backend_client, keyword)
        data = result.get('data', {})
        workflows = data.get('workflow_list', data.get('workflows', []))

        if workflows:
            message = f"🔍 Found {len(workflows)} workflows matching '{keyword}':\n\n"
            for i, wf in enumerate(workflows[:10], 1):
                icon = wf.get('icon_uri', '')
                name = wf.get('name', 'Unnamed')
                wf_id = wf.get('workflow_id', 'N/A')
                desc = wf.get('desc', '')
                message += f"{i}. {icon + ' ' if icon else ''}*{name}*\n"
                message += f"   ID: `{wf_id}`\n"
                if desc:
                    message += f"   {desc[:80]}{'...' if len(desc) > 80 else ''}\n"
                message += "\n"
        else:
            message = f"ℹ️ No workflows found matching '{keyword}'"

        await update.message.reply_text(message, parse_mode='Markdown')
    except Exception as e:
        await update.message.reply_text(f"❌ Error: {str(e)}")
