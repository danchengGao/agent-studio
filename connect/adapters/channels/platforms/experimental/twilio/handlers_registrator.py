"""Wire up all Twilio handler sub-registrators."""
from .auth.handlers_registrator import register as register_auth
from .agents.handlers_registrator import register as register_agents
from .workflows.handlers_registrator import register as register_workflows
from .general.handlers_registrator import register as register_general


def register_handlers() -> None:
    register_auth()
    register_agents()
    register_workflows()
    register_general()
