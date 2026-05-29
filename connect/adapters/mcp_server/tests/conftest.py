"""
Ensure the project root is on sys.path so that `connect.*` is importable
when pytest collects this package.
"""
import sys
from pathlib import Path

# conftest.py lives at: <root>/connect/adapters/mcp_server/tests/conftest.py
# Five parents up reaches the project root.
_PROJECT_ROOT = str(Path(__file__).parent.parent.parent.parent.parent)
if _PROJECT_ROOT not in sys.path:
    sys.path.append(_PROJECT_ROOT)
