"""Per-user in-memory state for the Twilio platform."""
from connect.client.platform_state import PlatformState as _PlatformState

_state = _PlatformState()
get_user_data = _state.get_user_data
set_app_config = _state.set_app_config
get_app_config = _state.get_app_config
