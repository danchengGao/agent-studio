"""
Shared per-user state store for platform adapters.

Each platform instantiates its own PlatformState so the dicts are
completely independent between platforms.  The module-level helpers
in each platforms/<name>/state.py delegate to a single instance.

Usage in each platform's state.py:

    from ...client.platform_state import PlatformState as _PlatformState

    _state = _PlatformState()

    get_user_data = _state.get_user_data
    set_app_config = _state.set_app_config
    get_app_config = _state.get_app_config
"""


class PlatformState:
    """Independent per-user in-memory state store for one platform."""

    def __init__(self) -> None:
        self._user_data: dict = {}
        self._app_config: dict = {}

    def get_user_data(self, user_id: str) -> dict:
        """Return the mutable state dict for the given user ID.

        Creates an empty dict on first access — never returns None.
        """
        if user_id not in self._user_data:
            self._user_data[user_id] = {}
        return self._user_data[user_id]

    def set_app_config(self, **kwargs) -> None:
        """Store app-wide config key/value pairs (called once from launcher)."""
        self._app_config.update(kwargs)

    def get_app_config(self) -> dict:
        """Return the full app-wide config dict."""
        return self._app_config
