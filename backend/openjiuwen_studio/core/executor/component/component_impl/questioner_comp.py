#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

import json
from typing import AsyncIterator

from openjiuwen.core.workflow import QuestionerConfig, QuestionerComponent
from openjiuwen.core.workflow.components.llm.questioner_comp import (
    QuestionerDirectReplyHandler,
    QuestionerExecutable,
    QuestionerState,
)
from openjiuwen.core.graph.executable import Executable, Input, Output
from openjiuwen.core.context_engine import ModelContext
from openjiuwen.core.workflow.components import Session
from openjiuwen.core.foundation.llm import AssistantMessage, UserMessage
from openjiuwen.core.common.logging import logger


class QuestionerDirectReplyHandlerWrapper(QuestionerDirectReplyHandler):
    """Normalize dict content before writing messages into context."""

    @staticmethod
    def _normalize_message_content(content):
        if isinstance(content, dict):
            return json.dumps(content, ensure_ascii=False)
        return content

    async def _write_user_message_to_context(self, content, context):
        """Write user message to context with safe content normalization."""
        if context is None or not self._config.with_chat_history:
            return

        if not content:
            return

        user_message = UserMessage(
            role="user",
            content=self._normalize_message_content(content),
        )
        await context.add_messages([user_message])

    async def _write_assistant_message_to_context(self, content, context):
        """Write assistant message to context with safe content normalization."""
        if context is None or not self._config.with_chat_history:
            return

        if not content:
            return

        assistant_message = AssistantMessage(
            role="assistant",
            content=self._normalize_message_content(content),
        )
        await context.add_messages([assistant_message])


class QuestionerExecutableWrapper(QuestionerExecutable):
    """
    Wrapper for QuestionerExecutable that adds stream() method support.
    
    The original QuestionerExecutable only implements invoke() method,
    but when End node has stream_output=true, the system tries to call
    stream() method on upstream components. This wrapper delegates
    stream() calls to invoke() method.
    """
    
    async def stream(self, inputs: Input, session: Session, context: ModelContext) -> AsyncIterator[Output]:
        """
        Stream method that delegates to invoke.
        
        Since Questioner doesn't actually produce streaming output,
        we just invoke it and yield the result as a single chunk.
        """
        logger.debug(f"QuestionerExecutableWrapper stream method called, delegating to invoke")
        result = await self.invoke(inputs, session, context)
        yield result

    async def _handle_questioner_direct_reply(self, inputs: Input, session: Session, context):
        handler = (
            QuestionerDirectReplyHandlerWrapper()
            .config(self._config)
            .model(self._llm)
            .state(self._state)
            .prompt(self._prompt)
        )
        result = await handler.handle(inputs, session, context)
        self._state = handler.get_state()
        return result

    async def _handle_questioner_direct_reply_safe(
            self, inputs: Input, session: Session, context, current_state: QuestionerState
    ):
        handler = (
            QuestionerDirectReplyHandlerWrapper()
            .config(self._config)
            .model(self._llm)
            .state(current_state)
            .prompt(self._prompt)
        )
        result = await handler.handle(inputs, session, context)
        result['_state'] = handler.get_state()
        return result


class QuestionerComponentWrapper(QuestionerComponent):
    """
    Wrapper for QuestionerComponent that creates QuestionerExecutableWrapper
    instead of the original QuestionerExecutable.
    """
    
    def __init__(self, questioner_comp_config: QuestionerConfig = None):
        super().__init__(questioner_comp_config)
        self._questioner_config = questioner_comp_config
    
    def to_executable(self) -> Executable:
        """Return wrapped executable with stream support"""
        return QuestionerExecutableWrapper(self._questioner_config).state(QuestionerState())
