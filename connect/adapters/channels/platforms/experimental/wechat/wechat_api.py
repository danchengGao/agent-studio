"""
WeChat Official Account API utilities.

Handles:
  - Signature verification for incoming webhooks
  - XML message parsing and building
  - Access token management (AppID + AppSecret)
  - Customer Service Message API for async replies
"""
import hashlib
import json
import time
import urllib.request
import urllib.parse
import urllib.error
import xml.etree.ElementTree as ET
from typing import Optional, Tuple

from openjiuwen.core.common.logging import logger


WECHAT_API_BASE = "https://api.weixin.qq.com"

# WeChat Customer Service message limit
_MAX_MSG_LEN = 2048

# Cached access token: (token, expires_at)
_access_token_cache: Tuple[str, float] = ('', 0.0)


def verify_signature(token: str, timestamp: str, nonce: str, signature: str) -> bool:
    """Verify WeChat webhook signature.

    WeChat signs by: sort([token, timestamp, nonce]), join, sha1.
    """
    parts = sorted([token, timestamp, nonce])
    expected = hashlib.sha1(''.join(parts).encode('utf-8')).hexdigest()
    return expected == signature


def parse_xml_message(xml_body: bytes) -> dict:
    """Parse a WeChat XML message body into a dict."""
    try:
        root = ET.fromstring(xml_body)
        return {child.tag: (child.text or '') for child in root}
    except ET.ParseError as e:
        logger.error("Failed to parse WeChat XML: %s", e)
        return {}


def build_text_reply(to_user: str, from_user: str, content: str) -> str:
    """Build a WeChat synchronous text reply XML string."""
    if len(content) > _MAX_MSG_LEN:
        content = content[:_MAX_MSG_LEN - 3] + '...'
    timestamp = int(time.time())
    # Escape content for CDATA
    return (
        f"<xml>"
        f"<ToUserName><![CDATA[{to_user}]]></ToUserName>"
        f"<FromUserName><![CDATA[{from_user}]]></FromUserName>"
        f"<CreateTime>{timestamp}</CreateTime>"
        f"<MsgType><![CDATA[text]]></MsgType>"
        f"<Content><![CDATA[{content}]]></Content>"
        f"</xml>"
    )


def get_access_token(app_id: str, app_secret: str) -> str:
    """Get a valid WeChat API access token, refreshing if expired."""
    global _access_token_cache
    token, expires_at = _access_token_cache
    if token and time.time() < expires_at - 60:
        return token

    url = (
        f"{WECHAT_API_BASE}/cgi-bin/token"
        f"?grant_type=client_credential"
        f"&appid={urllib.parse.quote(app_id)}"
        f"&secret={urllib.parse.quote(app_secret)}"
    )
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        raise RuntimeError(f"Failed to get WeChat access token: {e}") from e

    if 'errcode' in data:
        raise RuntimeError(f"WeChat token error {data.get('errcode')}: {data.get('errmsg')}")

    new_token = data.get('access_token', '')
    expires_in = int(data.get('expires_in', 7200))
    _access_token_cache = (new_token, time.time() + expires_in)
    logger.info("WeChat access token refreshed, expires in %ds", expires_in)
    return new_token


def send_customer_service_message(
    app_id: str,
    app_secret: str,
    open_id: str,
    text: str,
) -> None:
    """Send an async Customer Service text message to a user.

    Used when the synchronous reply window (5s) has already been used.
    Requires AppID + AppSecret to obtain an access token.
    """
    if len(text) > _MAX_MSG_LEN:
        text = text[:_MAX_MSG_LEN - 3] + '...'

    try:
        access_token = get_access_token(app_id, app_secret)
    except Exception as e:
        logger.error("Cannot send customer service message — token error: %s", e)
        return

    url = f"{WECHAT_API_BASE}/cgi-bin/message/custom/send?access_token={urllib.parse.quote(access_token)}"
    payload = {
        "touser": open_id,
        "msgtype": "text",
        "text": {"content": text},
    }
    data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            if result.get('errcode', 0) != 0:
                logger.error(
                    "WeChat customer service API error %s: %s",
                    result.get('errcode'), result.get('errmsg')
                )
    except Exception as e:
        logger.error("Failed to send WeChat customer service message: %s", e)
