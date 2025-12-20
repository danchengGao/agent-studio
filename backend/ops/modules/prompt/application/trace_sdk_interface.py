#!/usr/bin/python3.10
# -*- coding: utf-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

import asyncio


def observe(*args, **kwargs):
    """空接口，确保无sdk只是不上报trace,不影响执行主流程"""
    def decorator(func):
        # 如果是异步函数，确保正确处理
        if asyncio.iscoroutinefunction(func):
            async def async_wrapper(*args, **kwargs):
                return await func(*args, **kwargs)
            return async_wrapper
        return func
    return decorator


class NullSpan:

    @classmethod
    def __getattr__(cls, name):
        # 对于任何未定义的方法，返回一个空函数
        return lambda *args, **kwargs: None

    def set_attribute(self, key, value):
        """空接口，确保无sdk只是不上报trace,不影响执行主流程"""
        pass

    def set_input_tokens(self, tokens):
        """空接口，确保无sdk只是不上报trace,不影响执行主流程"""
        pass

    def set_prompt_key(self, key):
        """空接口，确保无sdk只是不上报trace,不影响执行主流程"""
        pass

    def set_prompt_version(self, version):
        """空接口，确保无sdk只是不上报trace,不影响执行主流程"""
        pass

    def set_space_id(self, space_id):
        """空接口，确保无sdk只是不上报trace,不影响执行主流程"""
        pass

    def set_stream(self, stream):
        """空接口，确保无sdk只是不上报trace,不影响执行主流程"""
        pass

    def set_input(self, input_data):
        """空接口，确保无sdk只是不上报trace,不影响执行主流程"""
        pass

    async def set_async_stream_output(self, async_gen_or_coroutine, **kwargs):
        """空接口，确保无sdk只是不上报trace,不影响执行主流程"""
        try:
            if asyncio.iscoroutine(async_gen_or_coroutine):
                # 这是一个协程，需要等待它返回生成器
                async_gen = await async_gen_or_coroutine
            else:
                # 这已经是一个异步生成器
                async_gen = async_gen_or_coroutine
            async for item in async_gen:
                yield item
        except Exception as e:
            self.error(e)
            raise


def set_baggage(*args, **kwargs):
    """空接口，确保无sdk只是不上报trace,不影响执行主流程"""
    pass


def get_baggage(*args, **kwargs):
    """空接口，确保无sdk只是不上报trace,不影响执行主流程"""
    return None


def calculate_input_tokens(*args, **kwargs):
    """空接口，确保无sdk只是不上报trace,不影响执行主流程"""
    return 0


def set_attribute(*args, **kwargs):
    """空接口，确保无sdk只是不上报trace,不影响执行主流程"""
    pass


def start_span(*args, **kwargs):
    """空接口，确保无sdk只是不上报trace,不影响执行主流程"""
    return NullSpan()


def end_span(*args, **kwargs):
    """空接口，确保无sdk只是不上报trace,不影响执行主流程"""
    pass


def inject(*args, **kwargs):
    """空接口，确保无sdk只是不上报trace,不影响执行主流程"""
    pass


class SpanType:
    Prompt = "prompt"
    PromptRunner = "prompt_runner"
    ToolCall = "tool_call"
    LLMCall = "llm_call"


class PlatformType:
    Prompt = "prompt"


class TraceModule:
    @classmethod
    def __call__(cls, *args, **kwargs):
        def decorator(func):
            return func
        return decorator

    @classmethod
    def get_current_span(cls):
        """空接口，确保无sdk只是不上报trace,不影响执行主流程"""
        return NullSpan()


# 创建 trace 实例
trace = TraceModule()
