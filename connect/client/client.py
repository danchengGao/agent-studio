"""
OpenJiuwen Backend Client
A Python client for interacting with the OpenJiuwen backend API
"""

from typing import Optional, Dict, Any
import requests


class OpenJiuwenClient:
    """Pure HTTP client for the OpenJiuwen backend API."""

    def __init__(self, base_url: str = "http://localhost:8000", api_prefix: str = "/api/v1"):
        self.base_url = base_url
        self.api_prefix = api_prefix
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        })
        self.token: Optional[str] = None
        self.space_id: Optional[str] = None

    def set_token(self, token: Optional[str]):
        self.token = token
        if token:
            self.session.headers.update({'Authorization': f'Bearer {token}'})
        else:
            self.session.headers.pop('Authorization', None)

    def set_space_id(self, space_id: Optional[str]):
        self.space_id = space_id

    def get_url(self, endpoint: str) -> str:
        endpoint = endpoint if endpoint.startswith('/') else f'/{endpoint}'
        return f"{self.base_url}{self.api_prefix}{endpoint}"

    def get(self, endpoint: str, **kwargs) -> Dict[str, Any]:
        url = self.get_url(endpoint)
        response = self.session.get(url, **kwargs)
        response.raise_for_status()
        return response.json()

    def post(self, endpoint: str, data=None, **kwargs) -> Dict[str, Any]:
        url = self.get_url(endpoint)
        response = self.session.post(url, json=data, **kwargs)
        response.raise_for_status()
        return response.json()

    def put(self, endpoint: str, data=None, **kwargs) -> Dict[str, Any]:
        url = self.get_url(endpoint)
        response = self.session.put(url, json=data, **kwargs)
        response.raise_for_status()
        return response.json()

    def delete(self, endpoint: str, **kwargs) -> Dict[str, Any]:
        url = self.get_url(endpoint)
        response = self.session.delete(url, **kwargs)
        response.raise_for_status()
        return response.json()
