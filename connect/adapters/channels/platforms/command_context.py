"""Shared context object passed to every platform handle_command handler."""
from dataclasses import dataclass
from typing import Any, Callable, List

__all__ = ['CommandContext']


@dataclass
class CommandContext:
    """Encapsulates all per-message routing data for a single command dispatch.

    Attributes:
        cmd1: Primary command keyword (e.g. 'agent', 'workflow').
        cmd2: Secondary sub-command keyword (e.g. 'run', 'search').
        parts: Full tokenised message (split on whitespace, max 4 tokens).
        user_id: Platform-specific identifier of the user who sent the message.
        say: Callable used to send a reply back to the user.
        user_data: Mutable per-user state dictionary managed by the platform.
    """

    cmd1: str
    cmd2: str
    parts: List[str]
    user_id: str
    say: Callable[..., Any]
    user_data: dict
