#!/usr/bin/python3.10
# coding: utf-8
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved
"""json util"""

import json


def convert_json(input_data) -> str:
    """
    不同数据类型数据转成json串
    :param input_data:
    :return:
    """
    result = input_data
    if isinstance(input_data, dict):
        # 如果已经是字典，直接序列化
        result = json.dumps(input_data)
    elif hasattr(input_data, 'dict'):
        # 如果是 Pydantic 模型，转换为字典再序列化
        result = json.dumps(input_data.dict())
    elif isinstance(input_data, str):
        # 如果是字符串，尝试解析以确保它是有效的 JSON
        try:
            json.loads(input_data)
        except json.JSONDecodeError:
            # 如果不是有效的 JSON，可能需要特殊处理
            result = json.dumps(input_data)

    return result
