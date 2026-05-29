#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
"""
Perturbation modules for reliability evaluation.

Implements three types of perturbations:
1. Prompt perturbation: paraphrasing, rephrasings
2. Environment perturbation: JSON field changes, schema tweaks
3. Fault injection: tool timeouts, errors, malformed responses
"""
import copy
import random
import re
from typing import Any, Dict, List, Optional


# ==================== Prompt Perturbation ====================

class PromptPerturber:
    """
    Generates semantically equivalent paraphrased prompts.

    Strategies:
    - LLM-based paraphrasing (preferred, when model_id and space_id provided)
    - Rule-based paraphrasing (fallback)
    """

    def __init__(self, model_id: Optional[str] = None, space_id: Optional[str] = None):
        self.model_id = model_id
        self.space_id = space_id

    async def paraphrase(self, prompt: str, num_variants: int = 3) -> List[str]:
        """
        Generate paraphrased variants of a prompt.

        Args:
            prompt: Original prompt text
            num_variants: Number of paraphrases to generate

        Returns:
            List of paraphrased prompts (semantically equivalent)
        """
        if self.model_id and self.space_id:
            try:
                return await self._llm_paraphrase(prompt, num_variants)
            except Exception as e:  # noqa: BLE001
                import logging
                logging.getLogger(__name__).debug(f"LLM paraphrase failed, falling back to rule-based: {e}")
        return self._rule_based_paraphrase(prompt, num_variants)

    async def _llm_paraphrase(self, prompt: str, num_variants: int) -> List[str]:
        """Generate paraphrases using LLM (using existing codebase pattern)."""
        from openjiuwen_studio.core.manager.convertor.components.llm import build_dsl_model_config
        from openjiuwen.core.foundation.llm import Model, ModelClientConfig, ModelRequestConfig, UserMessage

        paraphrase_prompt = (
            f"Generate {num_variants} semantically equivalent paraphrases of the following text. "
            f"Each paraphrase should have the same meaning but use different wording. "
            f"Output only the paraphrases, one per line, without numbering.\n\n"
            f"Original text:\n{prompt}"
        )

        try:
            dsl_cfg = build_dsl_model_config(int(self.model_id), self.space_id)
            cc = dsl_cfg.model_client_config
            rc = dsl_cfg.request_config
            client_config = ModelClientConfig(
                client_provider=cc.client_provider or "openai",
                api_key=cc.api_key or "",
                api_base=cc.api_base or "",
                timeout=float(cc.timeout or 60.0),
            )
            request_config = ModelRequestConfig(
                model=rc.model_name or "",
                temperature=0.7,
                top_p=rc.top_p if rc.top_p is not None else 0.9,
            )
        except Exception:
            return self._rule_based_paraphrase(prompt, num_variants)

        model = Model(model_client_config=client_config, model_config=request_config)
        result = await model.invoke([UserMessage(content=paraphrase_prompt)])
        response_text = result.content or ""

        # Parse paraphrases
        lines = [re.sub(r'^\d+[\.\)]\s*', '', ln.strip()) for ln in response_text.strip().split('\n')]
        cleaned = [ln for ln in lines if ln and ln != prompt]
        return cleaned[:num_variants] if cleaned else [prompt]

    @staticmethod
    def _rule_based_paraphrase(prompt: str, num_variants: int) -> List[str]:
        """Generate paraphrases using rule-based transformations."""
        paraphrases = []

        # Strategy 1: Synonym substitution
        synonyms = {
            'get': ['retrieve', 'fetch', 'obtain'],
            'find': ['locate', 'search for', 'identify'],
            'create': ['generate', 'produce', 'make'],
            'analyze': ['examine', 'evaluate', 'assess'],
            'please': ['kindly', ''],
            'could you': ['can you', 'would you'],
        }

        variant = prompt
        for original, replacements in synonyms.items():
            if original in variant.lower():
                replacement = random.choice(replacements)
                variant = re.sub(
                    rf'\b{re.escape(original)}\b',
                    replacement,
                    variant,
                    flags=re.IGNORECASE
                )
        paraphrases.append(variant)

        # Strategy 2: Sentence reordering
        sentences = re.split(r'[.!?]', prompt)
        if len(sentences) > 1:
            sentences = [s.strip() for s in sentences if s.strip()]
            shuffled = sentences.copy()
            random.shuffle(shuffled)
            paraphrases.append('. '.join(shuffled) + '.')

        # Strategy 3: Active/passive voice (simple heuristic)
        if ' the ' in prompt.lower():
            variant = re.sub(r'([A-Z][a-z]+) the', r'The \1', prompt)
            paraphrases.append(variant)

        # Ensure uniqueness and limit to num_variants
        paraphrases = list(dict.fromkeys([p for p in paraphrases if p != prompt]))
        paraphrases = paraphrases[:num_variants]

        # Pad with original if not enough variants
        while len(paraphrases) < num_variants:
            paraphrases.append(prompt)

        return paraphrases


# ==================== Environment Perturbation ====================

class EnvironmentPerturber:
    """
    Applies perturbations to task input data and environment.

    Transformations:
    - JSON field reordering
    - Field name changes (snake_case ↔ camelCase)
    - Date format changes
    - Optional field addition/removal
    """

    def perturb_input(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply environment perturbations to input data.

        Args:
            input_data: Original input data

        Returns:
            Perturbed input data
        """
        data = copy.deepcopy(input_data)

        # Apply random subset of perturbations
        perturbations = [
            self._reorder_fields,
            self._rename_fields,
            self._change_date_formats,
            self._add_optional_fields,
        ]

        # Apply 1-2 random perturbations
        num_perturbations = random.randint(1, 2)
        selected = random.sample(perturbations, num_perturbations)

        for perturb_fn in selected:
            data = perturb_fn(data)

        return data

    @staticmethod
    def _reorder_fields(data: Dict[str, Any]) -> Dict[str, Any]:
        """Randomly reorder JSON fields."""
        if not isinstance(data, dict):
            return data

        keys = list(data.keys())
        random.shuffle(keys)
        return {k: data[k] for k in keys}

    def _rename_fields(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Rename fields between snake_case and camelCase."""
        if not isinstance(data, dict):
            return data

        renamed = {}
        for key, value in data.items():
            # Convert snake_case to camelCase
            if '_' in key:
                parts = key.split('_')
                new_key = parts[0] + ''.join(p.capitalize() for p in parts[1:])
            # Convert camelCase to snake_case
            elif re.search(r'[a-z][A-Z]', key):
                new_key = re.sub(r'([a-z])([A-Z])', r'\1_\2', key).lower()
            else:
                new_key = key

            # Recursively apply to nested dicts
            if isinstance(value, dict):
                renamed[new_key] = self._rename_fields(value)
            else:
                renamed[new_key] = value

        return renamed

    def _change_date_formats(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Change date formats between ISO, US, EU styles."""
        if not isinstance(data, dict):
            return data

        date_patterns = [
            (r'(\d{4})-(\d{2})-(\d{2})', r'\1/\2/\3'),  # ISO to slash format
            (r'(\d{2})-(\d{2})-(\d{4})', r'\2/\1/\4'),  # DD-MM-YYYY to MM/DD/YYYY
        ]

        transformed = {}
        for key, value in data.items():
            if isinstance(value, str):
                for pattern, replacement in date_patterns:
                    value = re.sub(pattern, replacement, value)
            elif isinstance(value, dict):
                value = self._change_date_formats(value)
            transformed[key] = value

        return transformed

    @staticmethod
    def _add_optional_fields(data: Dict[str, Any]) -> Dict[str, Any]:
        """Add benign optional fields."""
        if not isinstance(data, dict):
            return data

        # Add 0-2 optional metadata fields
        optional_fields = {
            '_metadata': {'source': 'evaluation', 'version': '1.0'},
            '_timestamp': '2025-01-01T00:00:00Z',
            '_request_id': f'req_{random.randint(1000, 9999)}',
        }

        num_to_add = random.randint(0, 2)
        to_add = random.sample(list(optional_fields.items()), num_to_add)

        result = data.copy()
        for key, value in to_add:
            if key not in result:
                result[key] = value

        return result


# ==================== Fault Injection ====================

class FaultInjector:
    """
    Injects faults into tool/component execution.

    Fault types:
    - Timeout
    - Error response
    - Malformed data
    - Slow response
    """

    def __init__(self, fault_probability: float = 0.2):
        """
        Args:
            fault_probability: Probability of injecting a fault (0.0-1.0)
        """
        self.fault_probability = fault_probability

    def should_inject_fault(self) -> bool:
        """Determine if a fault should be injected."""
        return random.random() < self.fault_probability

    @staticmethod
    def generate_fault() -> Dict[str, Any]:
        """
        Generate a fault response.

        Returns:
            Fault configuration with type and details
        """
        fault_types = [
            'timeout',
            'error',
            'malformed',
            'slow',
        ]

        fault_type = random.choice(fault_types)

        if fault_type == 'timeout':
            return {
                'type': 'timeout',
                'message': 'Request timeout after 30 seconds',
                'code': 'TIMEOUT',
            }
        elif fault_type == 'error':
            error_codes = [500, 502, 503, 504]
            code = random.choice(error_codes)
            return {
                'type': 'error',
                'message': f'HTTP {code}: Internal Server Error',
                'code': code,
            }
        elif fault_type == 'malformed':
            return {
                'type': 'malformed',
                'message': 'Malformed response data',
                'data': '{"incomplete": "json"',  # Intentionally broken JSON
            }
        else:  # slow
            return {
                'type': 'slow',
                'message': 'Slow response',
                'delay_ms': random.randint(5000, 15000),
            }

    @staticmethod
    def apply_fault_to_result(result: Any, fault: Dict[str, Any]) -> Any:
        """
        Apply fault to execution result.

        Args:
            result: Original execution result
            fault: Fault configuration

        Returns:
            Faulted result
        """
        fault_type = fault['type']

        if fault_type == 'timeout':
            raise TimeoutError(fault['message'])
        elif fault_type == 'error':
            raise RuntimeError(fault['message'])
        elif fault_type == 'malformed':
            # Return malformed data
            return {'error': 'malformed', 'data': fault['data']}
        else:  # slow
            # In real implementation, would add delay
            # For evaluation, we just mark it
            if isinstance(result, dict):
                result['_injected_delay_ms'] = fault['delay_ms']
            return result


# ==================== Perturbation Coordinator ====================

class PerturbationCoordinator:
    """
    Coordinates all perturbation types for reliability evaluation.
    """

    def __init__(
        self,
        model_id: Optional[str] = None,
        space_id: Optional[str] = None,
        fault_probability: float = 0.2
    ):
        self.prompt_perturber = PromptPerturber(model_id, space_id)
        self.env_perturber = EnvironmentPerturber()
        self.fault_injector = FaultInjector(fault_probability)

    async def generate_prompt_variants(
        self,
        prompt: str,
        num_variants: int = 3
    ) -> List[str]:
        """Generate prompt paraphrases."""
        return await self.prompt_perturber.paraphrase(prompt, num_variants)

    def perturb_environment(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Apply environment perturbations."""
        return self.env_perturber.perturb_input(input_data)

    def inject_fault(self) -> Optional[Dict[str, Any]]:
        """Potentially inject a fault."""
        if self.fault_injector.should_inject_fault():
            return self.fault_injector.generate_fault()
        return None
