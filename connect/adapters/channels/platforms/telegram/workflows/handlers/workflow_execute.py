from openjiuwen.core.common.logging import logger

from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler

from connect.client.workflows.get_workflow import get_workflow
from connect.client.workflows import ParamCollectionSession

from ._execute_and_reply import _execute_and_reply
from .helpers._state import WF_EXEC_COLLECTING
from ..commands import WORKFLOW_CANCEL
from ...auth import require_login


@require_login
async def workflow_execute_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start workflow execution - /workflow_execute <workflow_id>"""
    logger.info("workflow_execute_handler called: user_id=%s, args=%s", update.effective_user.id, context.args)
    backend_client = context.user_data.get('backend_client')

    if not context.args:
        await update.message.reply_text(
            "❌ Usage: /workflow\\_execute `<workflow_id>`",
            parse_mode='Markdown'
        )
        return ConversationHandler.END

    workflow_id = context.args[0]

    try:
        result = get_workflow(backend_client, workflow_id)
        wf_data = result.get('data', {}).get('workflow', {})
        params = wf_data.get('input_parameters', [])
    except Exception as e:
        await update.message.reply_text(f"❌ Could not fetch workflow info: {e}")
        return ConversationHandler.END

    if not params:
        await _execute_and_reply(update, backend_client, workflow_id, {})
        return ConversationHandler.END

    session = ParamCollectionSession(workflow_id, params)
    context.user_data['wf_exec_session'] = session

    wf_name = wf_data.get('name', workflow_id)
    text = (f"⚙️ *{wf_name}* needs {session.total} input parameter(s).\n"
           f"Type /{WORKFLOW_CANCEL} to abort.\n\n"
            + session.format_prompt(1, session.total))
    text = text.replace('_', '\_')
    await update.message.reply_text(text, parse_mode='Markdown')
    return WF_EXEC_COLLECTING
