"""Per-user in-memory state for the Discord platform adapter.

Delegates to a PlatformState instance so the logic lives once in client/.
Each platform has its own independent _state instance.
"""
from connect.client.platform_state import PlatformState as _PlatformState

_state = _PlatformState()

get_user_data = _state.get_user_data
set_app_config = _state.set_app_config
get_app_config = _state.get_app_config
