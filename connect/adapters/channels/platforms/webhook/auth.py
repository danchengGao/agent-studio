"""
Webhook server authentication and backend client factory.

Two independent auth layers:
  1. Webhook auth  — optional X-API-Key header protects this server's endpoints
  2. Backend auth  — token + space ID, resolved from headers or static config.
     Set once in Swagger's Authorize dialog, not per-request.
"""
from typing import Optional

from fastapi import HTTPException, Depends, Security, Request
from fastapi.security import APIKeyHeader

from connect.client import OpenJiuwenClient

_api_key_header_scheme = APIKeyHeader(name="X-API-Key", auto_error=False)
_token_header_scheme = APIKeyHeader(name="X-Token", auto_error=False,
                                    description="OpenJiuwen access token (plain value, no 'Bearer' prefix). "
                                                "Alternative to the BearerToken HTTP scheme.")
_space_id_header_scheme = APIKeyHeader(name="X-Space-ID", auto_error=False,
                                       description="OpenJiuwen workspace ID.")

# Set once from launcher before the app starts
_api_key: Optional[str] = None
_backend_url: str = 'http://localhost:8000'
_static_token: Optional[str] = None
_static_space_id: Optional[str] = None


def configure(backend_url: str, static_token: Optional[str], api_key: Optional[str],
              static_space_id: Optional[str] = None) -> None:
    """Called once from the launcher to inject runtime configuration."""
    global _backend_url, _static_token, _api_key, _static_space_id
    _backend_url = backend_url
    _static_token = static_token
    _api_key = api_key
    _static_space_id = static_space_id


def get_backend_url() -> str:
    return _backend_url


def set_credentials(token: str, space_id: Optional[str]) -> None:
    """Store credentials obtained at runtime (e.g. from /auth/login).

    Writes into the same module-level variables used by --token / --space-id,
    so make_client picks them up as fallback on every subsequent request.
    """
    global _static_token, _static_space_id
    _static_token = token
    if space_id:
        _static_space_id = space_id


# ── Webhook API key guard ───────────────────────────────────────────────────

def verify_api_key(x_api_key: Optional[str] = Security(_api_key_header_scheme)) -> None:
    """FastAPI dependency — raises 401 if the server is protected and key is wrong."""
    if _api_key is None:
        return  # no key configured → open access
    if x_api_key != _api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key header.")

api_key_dep = Depends(verify_api_key)


# ── Backend client factory (FastAPI dependency) ─────────────────────────────

def _extract_bearer(authorization: Optional[str]) -> Optional[str]:
    if authorization and authorization.lower().startswith('bearer '):
        return authorization[7:].strip()
    return None


def make_client(
    request: Request,
    x_token: Optional[str] = Security(_token_header_scheme),
    x_space_id: Optional[str] = Security(_space_id_header_scheme),
) -> OpenJiuwenClient:
    """FastAPI dependency — builds an authenticated OpenJiuwenClient.

    Token priority (highest to lowest):
      1. Authorization: Bearer <token>  — BearerToken field in Swagger Authorize
      2. X-Token: <token>               — X-Token field in Swagger Authorize
      3. Static --token / ACCESS_TOKEN at startup

    Space ID priority:
      1. X-Space-ID: <id>               — X-Space-ID field in Swagger Authorize
      2. Static --space-id / SPACE_ID at startup
    """
    authorization = request.headers.get("authorization")
    token = _extract_bearer(authorization) or x_token or _static_token
    space_id = x_space_id or _static_space_id
    client = OpenJiuwenClient(base_url=_backend_url)
    if token:
        client.set_token(token)
    if space_id:
        client.set_space_id(space_id)
    return client


client_dep = Depends(make_client)
