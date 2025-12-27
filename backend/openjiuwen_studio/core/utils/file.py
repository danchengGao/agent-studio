#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

def read_file_to_string(file_path: str) -> str:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read().replace('\n', '').replace('\r', '')
    except FileNotFoundError as e:
        raise FileNotFoundError(f"文件不存在: {file_path}") from e
    except UnicodeDecodeError as e:
        raise UnicodeDecodeError(f"编码错误，请检查文件格式") from e
