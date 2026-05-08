"""
BasePlatform — documentation interface for new channels.

To add a new platform (e.g. Slack, Discord, webhook server):

1. Create  platforms/<name>/
2. Write a launcher.py that sets up the platform's framework and calls
   register_handlers(app).
3. Write thin event handlers that:
      a. Extract user_id and message text from the platform event
      b. Call the relevant client.* functions (auth, workflows, agents)
      c. Translate results back to platform-specific messages
4. Use channels.client.auth.token_storage for persistent session storage.
5. Use channels.client.workflows.ParamCollectionSession for multi-step
   parameter collection (store the session object in your platform's
   conversation context).
6. Create a top-level operate_from_<name>.py entry point.

Key shared modules (no platform imports):
    client.auth           — login, logout, token verify/refresh
    client.workflows      — list, search, get, execute, result_parser, param_collector
    client.agents         — list, search, execute, response_parser
    client.general        — health check
    client.auth.token_storage — per-user token persistence (file-based)
    client.client         — HTTP client for the backend
"""
