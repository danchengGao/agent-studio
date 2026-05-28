from .auth import cmd_login, cmd_logout, cmd_status
from .general import cmd_health
from .workflows import cmd_workflow_list, cmd_workflow_search, cmd_workflow_run, cmd_demo1, cmd_demo2
from .agents import cmd_agent_list, cmd_agent_search, cmd_agent_run, cmd_agent_chat

__all__ = [
    'cmd_login', 'cmd_logout', 'cmd_status', 'cmd_health',
    'cmd_workflow_list', 'cmd_workflow_search', 'cmd_workflow_run',
    'cmd_demo1', 'cmd_demo2',
    'cmd_agent_list', 'cmd_agent_search', 'cmd_agent_run', 'cmd_agent_chat',
]
