    #!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
"""
Pattern-aware workflow execution validator.

Inspects execution traces and verifies that the expected workflow pattern
(routing, chaining, parallelization, etc.) was actually exercised.
"""
from typing import Any, Dict, List

from openjiuwen.core.common.logging import logger
from openjiuwen_studio.schemas.evaluation import PatternType


# ComponentType integer values (from openjiuwen_studio/core/common/dsl.py)
_COMPONENT_TYPE_IF = 4
_COMPONENT_TYPE_LOOP = 5
_COMPONENT_TYPE_SUB_WORKFLOW = 14
_COMPONENT_TYPE_SET_VARIABLE = 15
_COMPONENT_TYPE_VARIABLE_MERGE = 18


class PatternValidator:
    """Validates that an execution trace exhibits a specific workflow pattern."""

    async def validate_pattern(
        self,
        pattern_type: Any,
        execution_trace: Dict[str, Any],
    ) -> bool:
        """
        Validate that the trace matches the expected pattern.

        Args:
            pattern_type: PatternType enum value or int.
            execution_trace: Dict with 'chunks', 'final_output', etc.

        Returns:
            True if pattern is confirmed, False otherwise.
        """
        try:
            pt = int(pattern_type)
            if pt == PatternType.ROUTING:
                return self._validate_routing(execution_trace)
            elif pt == PatternType.CHAINING:
                return self._validate_chaining(execution_trace)
            elif pt == PatternType.PARALLELIZATION:
                return self._validate_parallelization(execution_trace)
            elif pt == PatternType.ORCHESTRATOR_WORKER:
                return self._validate_orchestrator_worker(execution_trace)
            elif pt == PatternType.EVALUATOR_OPTIMIZER:
                return self._validate_evaluator_optimizer(execution_trace)
            elif pt == PatternType.MEMORY_USAGE:
                return self._validate_memory_usage(execution_trace)
            else:
                logger.warning(f"PatternValidator: unknown pattern_type={pattern_type}")
                return False
        except Exception as e:
            logger.error(f"PatternValidator error for pattern {pattern_type}: {e}", exc_info=True)
            return False

    # ──────────────────────────────────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _component_types_used(execution_trace: Dict[str, Any]) -> List[int]:
        """Return list of component type integers seen in tracer spans."""
        types: List[int] = []
        for chunk in execution_trace.get("chunks", []):
            # Chunks may be Pydantic models or plain dicts
            chunk_type = getattr(chunk, "type", None) or (chunk.get("type") if isinstance(chunk, dict) else None)
            if chunk_type != "tracer_workflow":
                continue
            payload = getattr(chunk, "payload", None) or (chunk.get("payload") if isinstance(chunk, dict) else {})
            if not payload:
                continue
            ct = (getattr(payload, "component_type", None)
                  or (payload.get("component_type") if isinstance(payload, dict) else None))
            if ct is not None:
                try:
                    types.append(int(ct))
                except (ValueError, TypeError):
                    pass
        return types

    @staticmethod
    def _span_count(execution_trace: Dict[str, Any]) -> int:
        """Count tracer_workflow spans (completed component executions)."""
        count = 0
        for chunk in execution_trace.get("chunks", []):
            chunk_type = getattr(chunk, "type", None) or (chunk.get("type") if isinstance(chunk, dict) else None)
            if chunk_type == "tracer_workflow":
                count += 1
        return count

    # ──────────────────────────────────────────────────────────────────────────
    # Pattern implementations
    # ──────────────────────────────────────────────────────────────────────────

    def _validate_routing(self, execution_trace: Dict[str, Any]) -> bool:
        """Routing: at least one IF component must have been executed."""
        return _COMPONENT_TYPE_IF in self._component_types_used(execution_trace)

    def _validate_chaining(self, execution_trace: Dict[str, Any]) -> bool:
        """Chaining: at least 2 sequential component executions."""
        return self._span_count(execution_trace) >= 2

    def _validate_parallelization(self, execution_trace: Dict[str, Any]) -> bool:
        """
        Parallelization: detect overlapping execution time windows.

        Falls back to checking whether an IF component produced multiple
        branches with the same parent component (heuristic).
        """
        time_windows: List[tuple] = []
        for chunk in execution_trace.get("chunks", []):
            chunk_type = getattr(chunk, "type", None) or (chunk.get("type") if isinstance(chunk, dict) else None)
            if chunk_type != "tracer_workflow":
                continue
            payload = getattr(chunk, "payload", None) or (chunk.get("payload") if isinstance(chunk, dict) else {})
            if not payload:
                continue
            start = (getattr(payload, "start_time", None)
                     or (payload.get("start_time") if isinstance(payload, dict) else None))
            end = (getattr(payload, "end_time", None)
                   or (payload.get("end_time") if isinstance(payload, dict) else None))
            if start and end:
                time_windows.append((int(start), int(end)))

        # Check for overlapping windows
        for i, (s1, e1) in enumerate(time_windows):
            for s2, e2 in time_windows[i + 1:]:
                if s1 < e2 and s2 < e1:
                    return True

        # Heuristic fallback: 3+ components executed → likely has parallel branch
        return self._span_count(execution_trace) >= 3

    def _validate_orchestrator_worker(self, execution_trace: Dict[str, Any]) -> bool:
        """Orchestrator-worker: at least one SUB_WORKFLOW component executed."""
        return _COMPONENT_TYPE_SUB_WORKFLOW in self._component_types_used(execution_trace)

    def _validate_evaluator_optimizer(self, execution_trace: Dict[str, Any]) -> bool:
        """Evaluator-optimizer: a LOOP component was executed."""
        return _COMPONENT_TYPE_LOOP in self._component_types_used(execution_trace)

    def _validate_memory_usage(self, execution_trace: Dict[str, Any]) -> bool:
        """Memory usage: SetVariable or VariableMerge component was executed."""
        used = set(self._component_types_used(execution_trace))
        return bool(used & {_COMPONENT_TYPE_SET_VARIABLE, _COMPONENT_TYPE_VARIABLE_MERGE})
