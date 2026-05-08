"""Health command."""
from openjiuwen.core.common.logging import logger
from connect.client import OpenJiuwenClient
from connect.client.general.health_check import health_check


def cmd_health(backend_url: str) -> None:
    client = OpenJiuwenClient(base_url=backend_url)
    try:
        result = health_check(client)
        logger.info(f"✅ Backend {backend_url} — status: {result.get('status', 'unknown')}")
    except Exception as e:
        logger.error(f"❌ Backend unreachable: {e}")
