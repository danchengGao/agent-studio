"""
Configuration reader for OpenJiuwen channels bot.
Reads the project .env file and exposes settings mirroring what the frontend uses.
"""

import os
from pathlib import Path

# .env is at the project root, two levels above this channels/ folder
_ENV_PATH = Path(__file__).parent.parent / '.env'


def _read_env() -> dict:
    """Parse the .env file into a dict without requiring python-dotenv"""
    values = {}
    if not _ENV_PATH.exists():
        return values
    with open(_ENV_PATH) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, _, value = line.partition('=')
            values[key.strip()] = value.strip()
    return values


_env = _read_env()


def _get(key: str, default: str = '') -> str:
    """Return env value, preferring real environment variables over .env file"""
    return os.environ.get(key, _env.get(key, default))


# Mirrors frontend: ENV_CONFIG.VITE_ENABLE_NEW_AUTH === 'True'
# True  → login with password  (/user_login page in frontend)
# False → login without password (/login page in frontend)
# Accepts any casing: 'True', 'true', 'TRUE', '1', 'yes' all enable password login.
ENABLE_PASSWORD_LOGIN: bool = _get('VITE_ENABLE_NEW_AUTH').strip().lower() in ('true', '1', 'yes')
