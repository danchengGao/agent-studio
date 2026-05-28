"""Registers all slash commands and the central message router with the Slack Bolt app."""
from .agents import handlers_registrator as agents_handlers_registrator
from .auth import handlers_registrator as auth_handlers_registrator
from .general import handlers_registrator as general_handlers_registrator
from .workflows import handlers_registrator as workflows_handlers_registrator
from .state import get_user_data
from .auth.handlers import on_login_username, on_login_password
from .workflows.handlers import on_collect_param
from .agents.handlers import on_agent_message


def register_handlers(app) -> None:
    agents_handlers_registrator.register_handlers(app)
    auth_handlers_registrator.register_handlers(app)
    general_handlers_registrator.register_handlers(app)
    workflows_handlers_registrator.register_handlers(app)

    # Central message router — dispatches DMs based on per-user state
    @app.message('')
    def message_router(message, say):
        user_id = message.get('user')
        if not user_id:
            return
        text = (message.get('text') or '').strip()
        if not text:
            return

        user_data = get_user_data(user_id)
        state = user_data.get('state', 'idle')

        if state == 'login_username':
            # Slack sometimes auto-formats emails as <mailto:email|email>; handle both
            if 'mailto:' in text:
                email = text.split("mailto:")[1].split("|")[0].strip("<> ")
            else:
                email = text.strip("<> ")
            on_login_username(user_id, email, say)
        elif state == 'login_password':
            on_login_password(user_id, text, say)
        elif state == 'wf_collecting':
            on_collect_param(user_id, text, say, user_data)
        elif state == 'agent_chat':
            on_agent_message(user_id, text, say, user_data)
        else:
            say("ℹ️ Use slash commands to interact. Type `/help` for available commands.")
