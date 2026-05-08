import hashlib
import hmac


def verify_webhook_signature(payload: bytes, signature_header: str, secret: str) -> bool:
    """
    Validate a GitHub-style HMAC-SHA256 signature.
    Expected header format: "sha256=<hex_digest>"
    Uses hmac.compare_digest for timing-safe comparison.
    """
    expected = "sha256=" + hmac.new(
        secret.encode("utf-8"), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)
