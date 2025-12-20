#!/usr/bin/env python3
import os

import httpx

PYTHON_URL = os.getenv("PYTHON_SANDBOX_URL", "")
JS_URL     = os.getenv("JS_SANDBOX_URL", "")

TIMEOUT = 10   # 建立连接超时

async def remote_python(code, inputs, session, timeout: float = 10.0):
    payload = {"session": session, "code": code, "timeout": timeout, "inputs": inputs or {}}
    async with httpx.AsyncClient() as cli:
        try:
            r = await cli.post(PYTHON_URL, json=payload,
                               timeout=httpx.Timeout(TIMEOUT + timeout, connect=TIMEOUT))
            r.raise_for_status()
            return r.json()
        except Exception as e:
            return {"return": None, "error": str(e)}

async def remote_javascript(code, inputs, session, timeout: float = 10.0):
    payload = {"session": session, "code": code, "inputs": inputs or {}, "timeout": timeout}
    async with httpx.AsyncClient() as cli:
        try:
            r = await cli.post(JS_URL, json=payload,
                               timeout=httpx.Timeout(TIMEOUT + timeout, connect=TIMEOUT))
            r.raise_for_status()
            return r.json()
        except Exception as e:
            return {"return": None, "error": str(e)}