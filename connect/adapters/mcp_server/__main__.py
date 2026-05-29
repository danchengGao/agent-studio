"""Package entry point — delegates to server.py.

To start the server, run server.py directly or use the -m flag:

    python connect/adapters/mcp_server/server.py --token YOUR_TOKEN
    python -m connect.adapters.mcp_server --token YOUR_TOKEN
"""
from connect.adapters.mcp_server.server import main

main()
