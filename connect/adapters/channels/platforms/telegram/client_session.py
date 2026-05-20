"""
Telegram-specific per-user client management and @require_login decorator.

The pure token verify/refresh logic lives in client.auth.token_manager.
This module handles the Telegram-specific parts: extracting the user ID
from the Update, storing the per-user OpenJiuwenClient in context.user_data,
and sending Telegram error messages when auth fails.
"""
import asyncio
from functools import wraps

from telegram import Update
from telegram.ext import ContextTypes

from connect.client.auth.token_storage import (
    get_user_token,
    get_user_space_id,
    get_user_refresh_token,
    remove_user_token,
)
from connect.client.auth.token_manager import verify_and_refresh


def require_login(func):
    """Decorator that ensures the user is authenticated before the handler runs.

    For each Telegram user a dedicated OpenJiuwenClient instance is stored in
    context.user_data['backend_client'] so concurrent requests from different
    users never share the same token.

    A per-user asyncio.Lock serialises token-refresh attempts so only one
    refresh happens at a time per user.
    """
    @wraps(func)
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE, *args, **kwargs):
        user_id = update.effective_user.id

        if not get_user_token(user_id):
            await update.message.reply_text(
                "❌ You are not logged in.\n\n"
                "Please use /login to authenticate first."
            )
            return

        if '_refresh_lock' not in context.user_data:
            context.user_data['_refresh_lock'] = asyncio.Lock()

        async with context.user_data['_refresh_lock']:
            create_client = context.bot_data.get('create_user_client')
            if create_client is None:
                await update.message.reply_text("❌ Backend client not initialized")
                return

            if 'backend_client' not in context.user_data:
                context.user_data['backend_client'] = create_client()

            user_client = context.user_data['backend_client']

            # Re-read inside lock — a concurrent request may have refreshed already
            token = get_user_token(user_id)
            user_client.set_token(token)
            user_client.set_space_id(get_user_space_id(user_id))

            ok, _ = verify_and_refresh(user_client, user_id, get_user_refresh_token(user_id))

            if not ok:
                await update.message.reply_text(
                    "❌ Your session has expired.\n\n"
                    "Please use /login to authenticate again."
                )
                remove_user_token(user_id)
                return

        return await func(update, context, *args, **kwargs)

    return wrapper
