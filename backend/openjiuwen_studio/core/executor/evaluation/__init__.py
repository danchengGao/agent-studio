#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
"""
Evaluation execution engine package.

Provides:
- EvaluationHarness: Orchestrates evaluation runs
- GraderEngine: Runs deterministic/model-based/code-based graders
- PatternValidator: Validates workflow pattern adherence
- compute_pass_at_k, compute_pass_pow_k: Metrics computation

Imports are lazy to avoid loading heavy runtime dependencies when only
lightweight sub-modules (metrics, pattern_validator) are needed.
"""
