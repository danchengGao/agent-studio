# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

"""
天气查询插件路由
"""

from fastapi import HTTPException, Query

from . import BasePluginRouter

demo_router = BasePluginRouter(
    name="demo",
    description="your_demo_tool_description",
)

@demo_router.router.get("/run")
async def run_demo(
    query: str = Query(..., description="query parameter description")
):
    try:
        return {
            "result": "success",
            "query": query,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"run failed: {str(e)}"
        ) from e

# 注册端点信息
demo_router.register_endpoint("GET", "/run", run_demo, "run demo")