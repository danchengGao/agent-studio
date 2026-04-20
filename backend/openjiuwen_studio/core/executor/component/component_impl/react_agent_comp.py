# coding: utf-8
# Copyright (c) Huawei Technologies Co., Ltd. 2025. All rights reserved.

"""
Custom ReActAgentComp that supports plugin tools.

This extends the base ReActAgentComp to add support for registering and using
plugin tools in workflow contexts.
"""

from typing import List, Any
from openjiuwen.core.workflow.components.component import ComponentComposable
from openjiuwen.core.graph.base import Graph
from openjiuwen.core.workflow.components.llm.react import (
    ReActAgentCompConfig,
    ReActAgentCompExecutable,
)
from openjiuwen.core.single_agent.schema.agent_card import AgentCard
from openjiuwen.core.foundation.tool import Tool
from openjiuwen.core.common.logging import logger


class ReActAgentCompWithTools(ComponentComposable):
    """
    ReAct Agent component with plugin tool support.

    This component extends the standard ReActAgentComp to support plugin tools
    by adding them to the ability_manager during initialization.
    """

    def __init__(self, config: ReActAgentCompConfig, tools: List[Tool] = None):
        super().__init__()
        self._config = config
        self._tools = tools or []
        self._executable = None

    @property
    def executable(self) -> "ReActAgentCompWithToolsExecutable":
        if self._executable is None:
            self._executable = self.to_executable()
        return self._executable

    def to_executable(self) -> "ReActAgentCompWithToolsExecutable":
        return ReActAgentCompWithToolsExecutable(self._config, self._tools)

    def add_component(self, graph: Graph, node_id: str, wait_for_all: bool = False) -> None:
        """Add this component to a workflow graph."""
        graph.add_node(node_id, self.to_executable(), wait_for_all=wait_for_all)


class ReActAgentCompWithToolsExecutable(ReActAgentCompExecutable):
    """
    ReAct Agent executable with plugin tool support.

    This extends the base ReActAgentCompExecutable to add plugin tools to the
    ability_manager so they are available to the ReAct agent.
    """

    def __init__(self, config: ReActAgentCompConfig, tools: List[Tool] = None):
        # Create the ReAct agent
        self._config = config
        self._tools = tools or []

        # Create a ReActAgent instance
        from openjiuwen.core.single_agent.agents.react_agent import ReActAgent

        self._react_agent = ReActAgent(
            card=AgentCard(
                id="react_agent_workflow_executable",
                name="ReAct Agent Workflow Executable",
                description="ReAct agent for workflow execution with plugin tools",
            )
        )

        # Configure the agent
        self._react_agent.configure(config)

        # Add tools to both ability_manager AND Runner.resource_mgr
        if self._tools:
            logger.warning(f"Adding {len(self._tools)} tools to ReAct agent")
            # Track added tool names to avoid duplicates within this batch
            added_tool_names = set()
            for tool in self._tools:
                try:
                    tool_name = tool.card.name

                    # Skip if already added in this batch
                    if tool_name in added_tool_names:
                        logger.warning(f"Skipping duplicate tool in batch: {tool_name}")
                        continue

                    # Add tool card to ability_manager using the proper add() method
                    # This will check for duplicates and skip if already exists.
                    result = self._react_agent._ability_manager.add(tool.card)
                    if hasattr(result, "added") and not result.added:
                        logger.warning(
                            f"Tool already exists in ability_manager: {tool_name}, "
                            f"reason: {getattr(result, 'reason', 'unknown')}"
                        )
                    else:
                        logger.warning(f"Added tool card to ability_manager: {tool_name}")

                    # ReAct workflow components do not always pass through agent.py add_tools(),
                    # so we must ensure tool instances are present in Runner.resource_mgr.
                    from openjiuwen.core.runner import Runner

                    try:
                        Runner.resource_mgr.add_tool(tool)
                        logger.warning(f"Registered tool instance in resource_mgr: {tool_name}")
                    except Exception as add_err:
                        # Duplicate registration may occur when cache is reused; keep execution path alive.
                        logger.warning(
                            f"Skip resource_mgr add_tool for {tool_name}, reason: {add_err}"
                        )

                    added_tool_names.add(tool_name)
                except Exception as e:
                    logger.error(f"Failed to add tool {tool.card.name}: {e}")

    @staticmethod
    def _map_inputs_to_query(inputs):
        """
        Map inputs to 'query' key expected by the underlying ReActAgent.

        The underlying ReActAgent expects a 'query' key in inputs. This method
        maps the first input value to 'query' if it doesn't already exist.

        Args:
            inputs: Input dictionary or other type

        Returns:
            Mapped inputs with 'query' key if inputs is a dict
        """
        if isinstance(inputs, dict):
            mapped = dict(inputs)
            if "query" not in inputs and len(inputs) > 0:
                first_key = next(iter(inputs.keys()))
                mapped["query"] = inputs[first_key]
            elif len(inputs) == 0:
                mapped["query"] = ""
            return mapped
        return inputs

    async def invoke(self, inputs, session, context):
        """Execute ReAct loop with the configured agent."""
        try:
            mapped_inputs = self._map_inputs_to_query(inputs)
            result = await self._react_agent.invoke(mapped_inputs, session)
            return result
        except Exception as e:
            return {"output": f"Error in ReAct execution: {str(e)}", "result_type": "error"}

    async def stream(self, inputs, session, context):
        """Execute ReAct loop with streaming output."""
        try:
            mapped_inputs = self._map_inputs_to_query(inputs)
            async for chunk in self._react_agent.stream(mapped_inputs, session):
                yield chunk
        except Exception as e:
            yield {
                "type": "error",
                "payload": {
                    "output": f"Error in ReAct streaming: {str(e)}",
                    "result_type": "error",
                },
            }

    async def collect(self, inputs, session, context):
        """Execute ReAct loop with streaming input aggregated to batch output."""
        try:
            if hasattr(inputs, "__aiter__"):
                collected_inputs = []
                async for input_chunk in inputs:
                    collected_inputs.append(input_chunk)

                if len(collected_inputs) == 1:
                    final_inputs = collected_inputs[0]
                else:
                    final_inputs = collected_inputs[-1]
            else:
                final_inputs = inputs

            mapped_inputs = self._map_inputs_to_query(final_inputs)
            result = await self._react_agent.invoke(mapped_inputs, session)
            return result
        except Exception as e:
            return {"output": f"Error in ReAct collect: {str(e)}", "result_type": "error"}

    async def transform(self, inputs, session, context):
        """Execute ReAct loop with streaming input/output."""
        try:
            async for input_chunk in inputs:
                mapped_inputs = self._map_inputs_to_query(input_chunk)
                result = await self._react_agent.invoke(mapped_inputs, session)
                yield result
        except Exception as e:
            yield {
                "type": "error",
                "payload": {
                    "output": f"Error in ReAct transform: {str(e)}",
                    "result_type": "error",
                },
            }
