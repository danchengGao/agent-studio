"""Print a summary of all available Messenger bot commands."""
from .auth.commands_printer import print_auth_commands
from .general.commands_printer import print_general_commands
from .workflows.commands_printer import print_workflows_commands
from .agents.commands_printer import print_agents_commands


def print_bot_commands() -> None:
    print_general_commands()
    print_auth_commands()
    print_workflows_commands()
    print_agents_commands()
