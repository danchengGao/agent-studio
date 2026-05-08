from connect.client import OpenJiuwenClient
from connect.client.general import health_check
from ...state import get_app_config


def handle_health(ack, respond, command):
    ack()
    backend_url = get_app_config().get('backend_url', 'http://localhost:8000')
    client = OpenJiuwenClient(base_url=backend_url)
    try:
        health = health_check(client)
        status = health.get('status', 'unknown')
        respond(f"✅ Backend Status: `{status}`")
    except Exception as e:
        respond(f"❌ Backend is not healthy: {e}")
