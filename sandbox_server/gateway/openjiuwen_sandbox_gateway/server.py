#!/usr/bin/env python3
import os
import sys
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.sandbox import SandboxConfig, get_sandbox
from openjiuwen_sandbox_gateway.app.gateway import remote_python, remote_javascript

ENABLE_LINUX_SANDBOX = bool(os.getenv("ENABLE_LINUX_SANDBOX", False))

app = FastAPI()

arch = sys.platform
if arch == "linux" and ENABLE_LINUX_SANDBOX:
    config = SandboxConfig()


@app.post("/run")
async def run_code(request: Request):
    data = await request.json() or {}

    if arch == "linux" and ENABLE_LINUX_SANDBOX:
        result = await run_sandbox(data)
    else:
        result = await run_process(data)
    return JSONResponse({"output": result})


async def run_sandbox(data: dict):
    lang = data.get("language", "python")
    code = data.get("code", "")
    inputs = data.get("inputs", {})
    timeout = float(data.get("timeout", 10))
    session = data.get("session", "default")

    if lang != "python" and lang != "javascript":
        result = {"return": None, "error": f"Unsupported language: {lang}"}

    sandbox = get_sandbox(config)
    result = sandbox.run(code, inputs, lang, timeout)
    return result


async def run_process(data: dict):
    lang = data.get("language", "python")
    code = data.get("code", "")
    inputs = data.get("inputs", {})
    timeout = float(data.get("timeout", 10))
    session = data.get("session", "default")

    if lang == "python":
        result = await remote_python(code, inputs, session, timeout)
    elif lang == "javascript":
        result = await remote_javascript(code, inputs, session, timeout)
    else:
        result = {"return": None, "error": f"Unsupported language: {lang}"}
    return result


@app.get("/health")
def health_check():
    return JSONResponse({"status": "ok"})

def main():
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8188))
    uvicorn.run(app, host=host, port=port)

if __name__ == "__main__":
    main()