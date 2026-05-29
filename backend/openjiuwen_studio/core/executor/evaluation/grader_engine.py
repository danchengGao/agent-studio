#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
"""
Grader engine — runs deterministic, model-based, and code-based graders.

Each grader receives:
    execution_trace: {chunks, final_output, trace_id, token_usage, ...}
    expected_output: the task's expected_output dict

And returns:
    {grader_name, grader_type, passed, score, details}
"""
import json
import re
import traceback
from typing import Any, Dict, List, Optional

from openjiuwen.core.common.logging import logger
from openjiuwen_studio.schemas.evaluation import GraderType


class GraderEngine:
    """Runs graders for a single trial result and aggregates their outputs."""

    async def run_graders(
        self,
        graders_config: List[Dict[str, Any]],
        execution_trace: Dict[str, Any],
        expected_output: Optional[Any],
        space_id: str,
    ) -> List[Dict[str, Any]]:
        """
        Run all configured graders.

        Args:
            graders_config: List of grader config dicts (from task definition).
            execution_trace: The captured execution trace.
            expected_output: The task's expected_outcome dict.
            space_id: Current space ID (for model-based graders).

        Returns:
            List of grader result dicts.
        """
        results: List[Dict[str, Any]] = []

        if not graders_config:
            return results

        for grader_cfg in graders_config:
            grader_name = grader_cfg.get("name", "unnamed_grader")
            try:
                # Accept both "grader_type" (API/DB format) and "type" (YAML benchmark format)
                grader_type = int(
                    grader_cfg.get("grader_type") if grader_cfg.get("grader_type") is not None
                    else grader_cfg.get("type", GraderType.DETERMINISTIC)
                )

                if grader_type == GraderType.DETERMINISTIC:
                    result = self._run_deterministic(grader_cfg, execution_trace, expected_output)
                elif grader_type == GraderType.MODEL_BASED:
                    result = await self._run_model_based(grader_cfg, execution_trace, expected_output, space_id)
                elif grader_type == GraderType.CODE_BASED:
                    result = self._run_code_based(grader_cfg, execution_trace, expected_output)
                else:
                    result = {
                        "grader_name": grader_name,
                        "grader_type": grader_type,
                        "passed": False,
                        "score": 0.0,
                        "error": f"Unknown grader_type: {grader_type}",
                    }
            except Exception as e:
                logger.error(f"Grader '{grader_name}' raised: {e}", exc_info=True)
                result = {
                    "grader_name": grader_name,
                    "grader_type": grader_cfg.get("grader_type"),
                    "passed": False,
                    "score": 0.0,
                    "error": str(e),
                }

            result["weight"] = float(grader_cfg.get("weight", 1.0))
            results.append(result)

        return results

    # ──────────────────────────────────────────────────────────────────────────
    # Deterministic graders
    # ──────────────────────────────────────────────────────────────────────────

    def _run_deterministic(
        self,
        cfg: Dict[str, Any],
        trace: Dict[str, Any],
        expected: Any,
    ) -> Dict[str, Any]:
        grader_name = cfg.get("name", "deterministic")
        inner = cfg.get("config") or {}
        # Accept flat format: fields at top level instead of nested under "config"
        if not inner:
            _top_level_keys = {"name", "type", "grader_type", "weight", "config"}
            inner = {k: v for k, v in cfg.items() if k not in _top_level_keys}
        check_type = inner.get("check_type", "output_check")

        # Normalise short-form aliases used in YAML benchmark files and flat UI format
        _aliases = {
            "output": "output_check",
            "state": "state_check",
            "tool_call": "tool_call_check",
            "pattern": "pattern_check",
            "transcript": "transcript_check",
            # flat UI aliases: check_type="contains" / "regex" → pattern_check
            "contains": "pattern_check",
            "regex": "pattern_check",
        }
        check_type = _aliases.get(check_type, check_type)

        if check_type == "output_check":
            return self._check_output(grader_name, inner, trace, expected)
        elif check_type == "state_check":
            return self._check_state(grader_name, inner, trace)
        elif check_type == "tool_call_check":
            return self._check_tool_calls(grader_name, inner, trace)
        elif check_type == "pattern_check":
            return self._check_pattern_regex(grader_name, inner, trace)
        elif check_type == "transcript_check":
            return self._check_transcript(grader_name, inner, trace)
        else:
            return {
                "grader_name": grader_name,
                "grader_type": "deterministic",
                "passed": False,
                "score": 0.0,
                "error": f"Unknown check_type: {check_type}",
            }

    def _check_output(self, name: str, cfg: Dict, trace: Dict, expected: Any) -> Dict:
        """Compare final_output against expected_output."""
        actual = trace.get("final_output")
        path = cfg.get("path")
        if path:
            actual = self._get_nested(actual, path)
            exp_val = cfg.get("expected_value", expected)
        else:
            exp_val = cfg.get("expected_value", expected)

        condition = cfg.get("condition", "eq")
        passed = self._compare(actual, exp_val, condition)
        return {
            "grader_name": name,
            "grader_type": "deterministic",
            "check_type": "output_check",
            "passed": passed,
            "score": 1.0 if passed else 0.0,
            "details": {"expected": exp_val, "actual": actual, "condition": condition},
        }

    def _check_state(self, name: str, cfg: Dict, trace: Dict) -> Dict:
        """Check a value at a JSON path inside final_output."""
        path = cfg.get("path", "")
        expected_value = cfg.get("expected_value")
        condition = cfg.get("condition", "eq")
        actual = self._get_nested(trace.get("final_output"), path)
        passed = self._compare(actual, expected_value, condition)
        return {
            "grader_name": name,
            "grader_type": "deterministic",
            "check_type": "state_check",
            "passed": passed,
            "score": 1.0 if passed else 0.0,
            "details": {"path": path, "expected": expected_value, "actual": actual},
        }

    def _check_tool_calls(self, name: str, cfg: Dict, trace: Dict) -> Dict:
        """Verify that specified tools were called during execution."""
        expected_tools: List[str] = cfg.get("expected_tools", [])
        actual_tools = self._extract_tool_calls(trace)
        missing = [t for t in expected_tools if t not in actual_tools]
        passed = len(missing) == 0
        return {
            "grader_name": name,
            "grader_type": "deterministic",
            "check_type": "tool_call_check",
            "passed": passed,
            "score": 1.0 if passed else max(0.0, 1.0 - len(missing) / max(len(expected_tools), 1)),
            "details": {"expected_tools": expected_tools, "actual_tools": actual_tools, "missing": missing},
        }

    @staticmethod
    def _check_pattern_regex(name: str, cfg: Dict, trace: Dict) -> Dict:
        """Apply a regex pattern to the serialised trace."""
        pattern = cfg.get("pattern", "")
        serialised = json.dumps(trace, default=str)
        passed = bool(re.search(pattern, serialised)) if pattern else False
        return {
            "grader_name": name,
            "grader_type": "deterministic",
            "check_type": "pattern_check",
            "passed": passed,
            "score": 1.0 if passed else 0.0,
            "details": {"pattern": pattern, "matched": passed},
        }

    def _check_transcript(self, name: str, cfg: Dict, trace: Dict) -> Dict:
        """Count tool calls or component invocations and compare."""
        metric = cfg.get("metric", "tool_call_count")
        expected_value = cfg.get("expected_value", 0)
        condition = cfg.get("condition", "ge")

        if metric == "tool_call_count":
            actual_value = len(self._extract_tool_calls(trace))
        elif metric == "component_count":
            actual_value = 0
            for c in trace.get("chunks", []):
                chunk_type = getattr(c, "type", None) or (c.get("type") if isinstance(c, dict) else None)
                if chunk_type == "tracer_workflow":
                    actual_value += 1
        else:
            actual_value = 0

        passed = self._compare(actual_value, expected_value, condition)
        return {
            "grader_name": name,
            "grader_type": "deterministic",
            "check_type": "transcript_check",
            "passed": passed,
            "score": 1.0 if passed else 0.0,
            "details": {"metric": metric, "expected": expected_value, "actual": actual_value},
        }

    # ──────────────────────────────────────────────────────────────────────────
    # Model-based graders
    # ──────────────────────────────────────────────────────────────────────────

    async def _run_model_based(
        self,
        cfg: Dict,
        trace: Dict,
        expected: Any,
        space_id: str,
    ) -> Dict:
        grader_name = cfg.get("name", "model_based")
        inner = cfg.get("config") or {}
        # Accept flat format (fields at top level instead of nested under "config")
        if not inner:
            _top_level_keys = {"name", "type", "grader_type", "weight", "config"}
            inner = {k: v for k, v in cfg.items() if k not in _top_level_keys}

        try:
            from openjiuwen_studio.core.manager.convertor.components.llm import build_dsl_model_config
            from openjiuwen.core.foundation.llm import Model, ModelClientConfig, ModelRequestConfig, UserMessage

            model_id = inner.get("model_id")
            if not model_id:
                raise ValueError("model_id is required for model-based grader")

            dsl_cfg = build_dsl_model_config(int(model_id), space_id)
            cc = dsl_cfg.model_client_config
            rc = dsl_cfg.request_config

            client_config = ModelClientConfig(
                client_provider=cc.client_provider or "openai",
                api_key=cc.api_key or "",
                api_base=cc.api_base or "",
                timeout=float(cc.timeout or 60.0),
                verify_ssl=False,
            )
            request_config = ModelRequestConfig(
                model=rc.model_name or "",
                temperature=rc.temperature if rc.temperature is not None else 0.0,
                top_p=rc.top_p if rc.top_p is not None else 0.9,
            )

            prompt = self._build_grading_prompt(trace, expected, inner)
            model = Model(model_client_config=client_config, model_config=request_config)
            result = await model.invoke([UserMessage(content=prompt)])
            response_text = result.content or ""

            parsed = self._parse_llm_response(response_text)
            return {
                "grader_name": grader_name,
                "grader_type": "model_based",
                "passed": parsed.get("passed", False),
                "score": float(parsed.get("score", 0.0)),
                "details": parsed,
            }
        except Exception as e:
            logger.error(f"Model-based grader '{grader_name}' failed: {e}", exc_info=True)
            return {
                "grader_name": grader_name,
                "grader_type": "model_based",
                "passed": False,
                "score": 0.0,
                "error": str(e),
            }

    @staticmethod
    def _build_grading_prompt(trace: Dict, expected: Any, cfg: Dict) -> str:
        rubric = cfg.get("rubric", "")
        assertions = cfg.get("assertions", [])
        prompt_template = cfg.get("prompt_template", "")

        if prompt_template:
            return prompt_template.format(
                trace=json.dumps(trace, default=str, indent=2),
                expected=json.dumps(expected, default=str, indent=2),
            )

        lines = ["You are an evaluation judge for an AI workflow system.", ""]
        if rubric:
            lines += ["## Scoring Rubric", rubric, ""]
        if assertions:
            lines += ["## Assertions to verify"]
            lines += [f"- {a}" for a in assertions]
            lines.append("")

        final_output = json.dumps(trace.get("final_output"), default=str, indent=2)
        lines += [
            f"## Actual output\n{final_output}",
            f"## Expected output\n{json.dumps(expected, default=str, indent=2)}",
            "",
            'Respond with JSON only: {"passed": true/false, "score": 0.0-1.0, "feedback": "..."}',
        ]
        return "\n".join(lines)

    @staticmethod
    def _parse_llm_response(text: str) -> Dict:
        try:
            m = re.search(r"\{.*\}", text, re.DOTALL)
            if m:
                return json.loads(m.group())
        except ValueError as parse_err:
            logger.debug(f"Failed to parse LLM response JSON: {parse_err}")
        return {"passed": False, "score": 0.0, "feedback": text[:500]}

    # ──────────────────────────────────────────────────────────────────────────
    # Code-based graders
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _run_code_based(cfg: Dict, trace: Dict, expected: Any) -> Dict:
        grader_name = cfg.get("name", "code_based")
        inner = cfg.get("config", {})
        code = inner.get("code", "")
        fn_name = inner.get("function_name", "grade")

        if not code:
            return {
                "grader_name": grader_name,
                "grader_type": "code_based",
                "passed": False,
                "score": 0.0,
                "error": "No code provided",
            }

        try:
            namespace: Dict[str, Any] = {}
            exec(compile(code, "<grader>", "exec"), namespace)  # nosec B102
            grade_fn = namespace.get(fn_name)
            if not callable(grade_fn):
                raise ValueError(f"Function '{fn_name}' not found or not callable")
            result = grade_fn(trace, expected)
            if not isinstance(result, dict):
                result = {"passed": bool(result), "score": 1.0 if result else 0.0}
            return {
                "grader_name": grader_name,
                "grader_type": "code_based",
                "passed": bool(result.get("passed", False)),
                "score": float(result.get("score", 0.0)),
                "details": result,
            }
        except Exception as e:
            logger.error(f"Code-based grader '{grader_name}' failed: {e}")
            return {
                "grader_name": grader_name,
                "grader_type": "code_based",
                "passed": False,
                "score": 0.0,
                "error": str(e),
                "traceback": traceback.format_exc(),
            }

    # ──────────────────────────────────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _get_nested(data: Any, path: str) -> Any:
        """Retrieve a value at a dot-separated path."""
        if not path:
            return data
        for key in path.split("."):
            if isinstance(data, dict):
                data = data.get(key)
            else:
                return None
        return data

    @staticmethod
    def _compare(actual: Any, expected: Any, condition: str) -> bool:
        try:
            try:
                actual = int(actual)
            except (ValueError, TypeError):
                pass

            try:
                expected = int(expected)
            except (ValueError, TypeError):
                pass

            if condition == "eq":
                return actual == expected
            elif condition == "ne":
                return actual != expected
            elif condition == "gt":
                return actual > expected
            elif condition == "lt":
                return actual < expected
            elif condition == "ge":
                return actual >= expected
            elif condition == "le":
                return actual <= expected
            elif condition == "contains":
                return str(expected) in str(actual)
            elif condition == "not_contains":
                return str(expected) not in str(actual)
            elif condition == "regex":
                return bool(re.search(str(expected), str(actual)))
            elif condition == "is_not_empty":
                return actual is not None and actual != "" and actual != [] and actual != {}
            else:
                return False
        except (TypeError, ValueError):
            return False

    @staticmethod
    def _extract_tool_calls(trace: Dict) -> List[str]:
        """Extract tool names from trace chunks."""
        tools: List[str] = []
        for chunk in trace.get("chunks", []):
            chunk_type = getattr(chunk, "type", None) or (chunk.get("type") if isinstance(chunk, dict) else None)
            if chunk_type not in ("tool_call", "tool_result"):
                continue
            payload = getattr(chunk, "payload", None) or (chunk.get("payload") if isinstance(chunk, dict) else {})
            if payload:
                name = (getattr(payload, "tool_name", None)
                        or (payload.get("tool_name") if isinstance(payload, dict) else None))
                if name and name not in tools:
                    tools.append(name)
        return tools
