from .agents import handlers_registrator as agents_handlers_registrator
from .auth import handlers_registrator as auth_handlers_registrator
from .general import handlers_registrator as general_handlers_registrator
from .workflows import handlers_registrator as workflows_handlers_registrator


def register_handlers(app):
    agents_handlers_registrator.register_handlers(app)
    auth_handlers_registrator.register_handlers(app)
    general_handlers_registrator.register_handlers(app)
    workflows_handlers_registrator.register_handlers(app)
