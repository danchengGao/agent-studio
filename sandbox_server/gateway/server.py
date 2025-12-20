#!/usr/bin/env python3
import asyncio, json, sys, os
from quart import Quart, request, jsonify
from app.gateway import remote_python, remote_javascript

app = Quart(__name__)

@app.route("/run", methods=["POST"])
async def run_code():
    data = await request.get_json() or {}
    lang   = data.get("language", "python")
    code   = data.get("code", "")
    inputs = data.get("inputs", {})
    timeout = float(data.get("timeout", 10))
    session = data.get("session", "default")

    if lang == "python":
        result = await remote_python(code, inputs, session, timeout)
    elif lang == "javascript":
        result = await remote_javascript(code, inputs, session, timeout)
    else:
        result = {"return": None, "error": f"Unsupported language: {lang}"}
    return jsonify({"output": result})

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok"})

def main():
    app.run(host=os.getenv("HOST", "0.0.0.0"), port=os.getenv("PORT", 8188))

if __name__ == "__main__":
    main()