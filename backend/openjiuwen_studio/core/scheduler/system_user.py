"""
Synthetic current_user dict for trigger-fired executions.
Matches the shape expected by agent_mgr.run() and flow_mgr.run().

IMPORTANT: The manager's internal execution path must skip check_user_space()
when user_id_str == "system_trigger". See manager/trigger.py for how
_internal_run() bypasses the space check.
"""
from fastapi import status as http_status


_BASE: dict = {
    "code": http_status.HTTP_200_OK,
    "message": "Get dl successfully.",
    "data": {
        "user_id_str": "system_trigger",
        "username": "System Trigger",
        "user_unique_name": "system_trigger",
        "email": "trigger@system.internal",
        "role_type": "super_user",
        "is_active": True,
        "session_key": "__trigger_system__",
        "space_id": None,  # overridden per-trigger
    },
}


def make_system_user(space_id: str) -> dict:
    return {
        **_BASE,
        "data": {**_BASE["data"], "space_id": space_id},
    }
