from openjiuwen.core.common.logging import logger

from telegram import Update
from telegram.ext import ContextTypes

from connect.client.workflows import list_workflows
from ...auth import require_login


@require_login
async def workflows_list_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """List all workflows - /workflows"""
    logger.info("workflows_list_handler called: user_id=%s", update.effective_user.id)
    backend_client = context.user_data.get('backend_client')
    try:
        await update.message.reply_text("📋 Fetching workflows from backend...")
        result = list_workflows(backend_client)
        workflows = result.get('data', {}).get('workflow_list', [])
        total = result.get('data', {}).get('total', len(workflows))

        if workflows:
            message = f"✅ Found {total} workflows:\n\n"
            for i, wf in enumerate(workflows[:10], 1):
                icon = wf.get('icon_uri', '')
                name = wf.get('name', 'Unnamed')
                wf_id = wf.get('workflow_id', 'N/A')
                desc = wf.get('desc', 'No description')
                message += f"{i}. {icon + ' ' if icon else ''}*{name}*\n"
                message += f"   ID: `{wf_id}`\n"
                message += f"   {desc[:80]}{'...' if len(desc) > 80 else ''}\n\n"
            if total > 10:
                message += f"_...and {total - 10} more workflows_\n\n"
            message += "💡 To execute: /workflow\\_execute `<workflow_id>`"
        else:
            message = "ℹ️ No workflows found"

        await update.message.reply_text(message, parse_mode='Markdown')
    except Exception as e:
        await update.message.reply_text(f"❌ Error: {str(e)}")
