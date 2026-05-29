#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

import itertools
import sqlite3
from typing import Any, Dict, List

import pandas as pd
from openjiuwen.core.workflow import WorkflowComponent, Input, Output
from openjiuwen.core.context_engine import ModelContext
from openjiuwen.core.workflow.components import Session

from openjiuwen_studio.core.common.dsl import (
    VariMergeConfig, MergeMode, CombineBy, MergeOutputType, MergeGroupConfig
)



class VariableMergeComponent(WorkflowComponent):
    def __init__(self, conf: VariMergeConfig) -> None:
        super().__init__()
        self.conf = conf
        self.groups = self.conf.groups

    @staticmethod
    def _is_empty(value: Any) -> bool:
        """检查组件输出值是否为空"""
        return value in [None, "", [], {}, ()] or (hasattr(value, '__len__') and len(value) == 0)

    @staticmethod
    def _resolve_values(group: MergeGroupConfig, inputs: Input) -> List[Any]:
        return [inputs.get(item) for item in group.items]

    # ── Mode: First Non-Null ────────────────────────────────────────────────

    def _mode_first_non_null(self, group: MergeGroupConfig, inputs: Input) -> Any:
        for item in group.items:
            val = inputs.get(item)
            if not self._is_empty(val):
                return val
        return None

    # ── Mode: Append ────────────────────────────────────────────────────────

    def _mode_append(self, group: MergeGroupConfig, inputs: Input) -> Any:
        values = [v for v in self._resolve_values(group, inputs) if not self._is_empty(v)]
        if not values:
            return None
        first = values[0]
        if isinstance(first, list):
            result: list = []
            for v in values:
                result.extend(v if isinstance(v, list) else [v])
            return result
        elif isinstance(first, dict):
            merged: dict = {}
            for v in values:
                if isinstance(v, dict):
                    merged.update(v)
            return merged
        else:
            return "".join(str(v) for v in values)

    # ── Mode: Combine ────────────────────────────────────────────────────────

    def _combine_by_matching_fields(self, group: MergeGroupConfig, inputs: Input) -> Any:
        arrays = [v for v in self._resolve_values(group, inputs) if isinstance(v, list)]
        if not arrays:
            return []
        if len(arrays) == 1:
            return arrays[0]
        field1 = group.match_field1
        field2 = group.match_field2
        if not field1 or not field2:
            return arrays[0]
        output_type = group.output_type or MergeOutputType.KEEP_MATCHES
        how_map = {
            MergeOutputType.KEEP_MATCHES: "inner",
            MergeOutputType.ENRICH_INPUT1: "left",
            MergeOutputType.KEEP_EVERYTHING: "outer",
        }
        how = how_map.get(output_type, "inner")
        df = pd.DataFrame(arrays[0])
        for arr in arrays[1:]:
            df = pd.merge(df, pd.DataFrame(arr), left_on=field1, right_on=field2, how=how)
        records = df.to_dict(orient="records")
        # Apply clash handling post-merge (pandas suffixes -> custom logic)
        when_clash = group.clash_when_clash or "addInputNumber"
        minimize_empty = group.clash_minimize_empty_fields
        if when_clash != "addInputNumber" or minimize_empty:
            records = [self._merge_pair(r, {}, group, 1, 2) for r in records]
        return records

    @staticmethod
    def _fuzzy_equal(a: Any, b: Any) -> bool:
        """Loose equality: case-insensitive strings, numeric type coercion."""
        if a == b:
            return True
        try:
            if isinstance(a, str) and isinstance(b, str):
                return a.strip().lower() == b.strip().lower()
            return float(a) == float(b)
        except (ValueError, TypeError):
            return False

    def _deep_merge(self, base: dict, override: dict) -> dict:
        result = dict(base)
        for k, v in override.items():
            if k in result and isinstance(result[k], dict) and isinstance(v, dict):
                result[k] = self._deep_merge(result[k], v)
            else:
                result[k] = v
        return result

    def _merge_pair(self, a: dict, b: dict, group: MergeGroupConfig, input_index_a: int, input_index_b: int) -> dict:
        """Merge two records according to clash handling config."""
        when_clash = group.clash_when_clash or "addInputNumber"
        merging_nested = group.clash_merging_nested or "shallowMerge"
        minimize_empty = group.clash_minimize_empty_fields

        clashing_keys = set(a.keys()) & set(b.keys())

        if when_clash == "addInputNumber":
            result = {}
            for k, v in a.items():
                if minimize_empty and self._is_empty(v):
                    continue
                new_k = f"{k}_input{input_index_a}" if k in clashing_keys else k
                result[new_k] = v
            for k, v in b.items():
                if minimize_empty and self._is_empty(v):
                    continue
                new_k = f"{k}_input{input_index_b}" if k in clashing_keys else k
                result[new_k] = v
            return result

        elif when_clash == "preferInput1":
            if merging_nested == "deepMerge":
                base = self._deep_merge(b, a)  # a wins
            else:
                base = {**b, **a}  # a wins via shallow merge
        else:  # preferInput2
            if merging_nested == "deepMerge":
                base = self._deep_merge(a, b)  # b wins
            else:
                base = {**a, **b}  # b wins via shallow merge

        if minimize_empty:
            base = {k: v for k, v in base.items() if not self._is_empty(v)}
        return base

    def _combine_by_position(self, group: MergeGroupConfig, inputs: Input) -> Any:
        arrays = [v for v in self._resolve_values(group, inputs) if isinstance(v, list)]
        if not arrays:
            return []
        fill = {} if group.keep_unpaired else None
        zipper = itertools.zip_longest(*arrays, fillvalue=fill) if group.keep_unpaired else zip(*arrays)
        result = []
        for row_items in zipper:
            dicts = [item for item in row_items if isinstance(item, dict)]
            if not dicts:
                result.append({})
                continue
            merged = dicts[0]
            for idx, other in enumerate(dicts[1:], start=2):
                merged = self._merge_pair(merged, other, group, 1, idx)
            result.append(merged)
        return result

    def _combine_all_combinations(self, group: MergeGroupConfig, inputs: Input) -> Any:
        arrays = [v for v in self._resolve_values(group, inputs) if isinstance(v, list)]
        if not arrays:
            return []
        result = []
        for combo in itertools.product(*arrays):
            merged: dict = {}
            for item in combo:
                if isinstance(item, dict):
                    merged.update(item)
                else:
                    merged[f"value_{len(merged)}"] = item
            result.append(merged)
        return result

    def _mode_combine(self, group: MergeGroupConfig, inputs: Input) -> Any:
        combine_by = group.combine_by or CombineBy.MATCHING_FIELDS
        if combine_by == CombineBy.MATCHING_FIELDS:
            return self._combine_by_matching_fields(group, inputs)
        elif combine_by == CombineBy.POSITION:
            return self._combine_by_position(group, inputs)
        else:  # ALL_COMBINATIONS
            return self._combine_all_combinations(group, inputs)

    # ── Mode: SQL Query ──────────────────────────────────────────────────────

    def _mode_sql_query(self, group: MergeGroupConfig, inputs: Input) -> Any:
        query = group.sql_query or ""
        if not query.strip():
            return None
        values = self._resolve_values(group, inputs)
        conn = sqlite3.connect(":memory:")
        try:
            for idx, val in enumerate(values, start=1):
                table_name = f"input{idx}"
                if isinstance(val, list) and val:
                    df = pd.DataFrame(val)
                elif isinstance(val, dict):
                    df = pd.DataFrame([val])
                else:
                    df = pd.DataFrame()
                df.to_sql(table_name, conn, index=False, if_exists="replace")
            result_df = pd.read_sql_query(query, conn)
            return result_df.to_dict(orient="records")
        finally:
            conn.close()

    # ── Mode: Choose Branch ──────────────────────────────────────────────────

    @staticmethod
    def _mode_choose_branch(group: MergeGroupConfig, inputs: Input) -> Any:
        idx = group.choose_index if group.choose_index is not None else 0
        if idx == -1:
            return {}
        if 0 <= idx < len(group.items):
            return inputs.get(group.items[idx])
        return None

    # ── Dispatch ─────────────────────────────────────────────────────────────

    async def invoke(self, inputs: Input, session: Session, context: ModelContext) -> Output:
        mode_map = {
            MergeMode.FIRST_NON_NULL: self._mode_first_non_null,
            MergeMode.APPEND: self._mode_append,
            MergeMode.COMBINE: self._mode_combine,
            MergeMode.CHOOSE_BRANCH: self._mode_choose_branch,
            MergeMode.SQL_QUERY: self._mode_sql_query,
        }
        result: Dict[str, Any] = {}
        for group in self.groups:
            handler = mode_map.get(group.mode, self._mode_first_non_null)
            result[group.name] = handler(group, inputs)
        return result
