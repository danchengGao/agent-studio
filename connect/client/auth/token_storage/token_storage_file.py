# Token storage file
# Override path via OJ_TOKEN_STORAGE env var (set by each platform launcher before imports).
import os
from pathlib import Path

_default = Path(__file__).parent.parent.parent.parent / ".tokens.json"
TOKEN_STORAGE_FILE = Path(os.environ.get('OJ_TOKEN_STORAGE', str(_default)))
