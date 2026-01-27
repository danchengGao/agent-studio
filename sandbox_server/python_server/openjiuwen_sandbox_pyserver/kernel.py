import asyncio
import inspect
import json
import os
import traceback
from multiprocessing import Process, Queue
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv


load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))


# ========== 子进程执行函数 ==========
def _run_code_in_process(code: str, inputs: dict, result_queue: Queue, timeout: float):
    """在独立子进程中执行用户代码，使用完整 Python 环境（无 RestrictedPython）"""
    try:
        # 使用标准 Python 全局命名空间（无限制）
        user_globals = {
            '__builtins__': __builtins__,  # 完整内置函数
            '__name__': '__main__',
            '__file__': '<user_code>',
        }

        # 执行用户代码
        exec(code, user_globals)

        # 检查必要组件
        if 'Args' not in user_globals:
            raise RuntimeError("User code must define a class named 'Args'.")
        if 'main' not in user_globals:
            raise RuntimeError("User code must define a function named 'main'.")

        Args = user_globals['Args']
        main_func = user_globals['main']
        args = Args(inputs)

        # —————— 统一异步/同步执行 + 精确超时 ——————
        async def _run():
            if inspect.iscoroutinefunction(main_func):
                return await main_func(args)
            else:
                loop = asyncio.get_event_loop()
                return await loop.run_in_executor(None, main_func, args)

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(asyncio.wait_for(_run(), timeout=timeout))
        finally:
            loop.close()

        # 验证结果可 JSON 序列化
        json.dumps(result)

        result_queue.put({"return": result, "error": None})

    except Exception as e:
        err_trace = traceback.format_exc()
        result_queue.put({"return": None, "error": err_trace})


# ========== 主执行入口 ==========
def exec_code(code: str, inputs: dict, timeout: float = 10.0):
    if timeout <= 0 or timeout > 3000:
        return {"return": None, "error": "Timeout must be between 0 and 3000 seconds."}

    result_queue = Queue()
    process = Process(
        target=_run_code_in_process,
        args=(code, inputs, result_queue, timeout)
    )
    process.start()
    process.join(timeout=timeout + 0.5)

    if process.is_alive():
        process.terminate()
        process.join()
        return {"return": None, "error": f"Execution timed out (> {timeout} seconds)."}

    if not result_queue.empty():
        return result_queue.get()
    else:
        return {"return": None, "error": "Execution failed silently."}


# ========== FastAPI 接口 ==========
app = FastAPI()


@app.post("/run")
async def run(request: Request):
    data = await request.json()
    if not data:
        return JSONResponse({"return": None, "error": "Invalid JSON payload."}, status_code=400)

    code = data.get("code", "")
    inputs = data.get("inputs", {})
    timeout = data.get("timeout", 10)

    if not isinstance(code, str) or not isinstance(inputs, dict):
        return JSONResponse(
            {
                "return": None,
                "error": "'code' must be string and 'inputs' must be dict.",
            },
            status_code=400,
        )
    if not isinstance(timeout, (int, float)):
        return JSONResponse({"return": None, "error": "'timeout' must be a number."}, status_code=400)

    if not code.strip():
        return JSONResponse({"return": None, "error": "No code provided."})

    try:
        result = exec_code(code, inputs, timeout=float(timeout))
    except Exception as e:
        result = {"return": None, "error": traceback.format_exc()}

    return JSONResponse(result)


@app.get("/health")
def health_check():
    return JSONResponse({"status": "ok"})

def main():
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 5001))
    uvicorn.run(app, host=host, port=port)

if __name__ == "__main__":
    main()