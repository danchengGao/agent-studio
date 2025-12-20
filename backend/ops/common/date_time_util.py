#!/usr/bin/python3.10
# -*- coding: utf-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

from datetime import datetime, timedelta, timezone


def get_china_datetime():
    """获取UTC时间并添加8小时 """
    china_time = (datetime.now(timezone.utc) + timedelta(hours=8)).replace(tzinfo=None)
    return china_time


def calc_run_time(create_time: str) -> int:
    """Calculate the task duration."""
    if not create_time:
        raise ValueError("invalid create_time")
    try:
        # calculate run time, simple calculation here
        create_time = datetime.strptime(create_time, "%Y-%m-%d %H:%M:%S")
        cur_time = datetime.now(tz=timezone(timedelta(hours=8))).strftime("%Y-%m-%d %H:%M:%S")
        cur_time = datetime.strptime(cur_time, "%Y-%m-%d %H:%M:%S")
    except Exception as error:
        raise ValueError("invalid time format") from error
    return int((cur_time - create_time).total_seconds())