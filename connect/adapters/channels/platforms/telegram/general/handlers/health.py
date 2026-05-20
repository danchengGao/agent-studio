from openjiuwen.core.common.logging import logger

from telegram import Update
from telegram.ext import ContextTypes

from connect.client.general.health_check import health_check


async def health_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Check backend health - /health"""
    logger.info(f"health_handler called: user_id=%s", update.effective_user.id)
    backend_client = context.bot_data.get('backend_client')
    try:
        await update.message.reply_text("🏥 Checking backend health...")
        health = health_check(backend_client)
        status = health.get('status', 'unknown')
        await update.message.reply_text(f"✅ Backend Status: {status}\n")
    except Exception as e:
        await update.message.reply_text(f"❌ Backend is not healthy: {str(e)}")
