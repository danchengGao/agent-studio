from openjiuwen.core.common.logging import logger

from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler

from connect.client.workflows import ParamCollectionSession

from ._execute_and_reply import _execute_and_reply
from .helpers._state import WF_EXEC_COLLECTING
from ..commands import WORKFLOW_SKIP


async def workflow_exec_collect_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Receive a parameter value and ask for the next one (or execute)."""
    backend_client = context.user_data.get('backend_client')
    text = update.message.text.strip()
    logger.info("workflow_exec_collect_handler called: user_id=%s, text=%r", update.effective_user.id, text)

    session: ParamCollectionSession = context.user_data.get('wf_exec_session')
    if session is None or session.is_done:
        return ConversationHandler.END

    if text == '/' + WORKFLOW_SKIP:
        error, done = session.skip()
    else:
        error, done = session.submit(text)

    if error:
        await update.message.reply_text(f"⚠️ {error}", parse_mode='Markdown')
        return WF_EXEC_COLLECTING

    if done:
        context.user_data.pop('wf_exec_session', None)
        await _execute_and_reply(update, backend_client, session.workflow_id, session.get_collected())
        return ConversationHandler.END

    next_index = session.answered + 1
    await update.message.reply_text(
        session.format_prompt(next_index, session.total),
        parse_mode='Markdown'
    )
    return WF_EXEC_COLLECTING
