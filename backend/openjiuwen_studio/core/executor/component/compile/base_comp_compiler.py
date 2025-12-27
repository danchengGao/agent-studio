#!/usr/bin/env python3.10
# coding: utf-8
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

from abc import ABC, abstractmethod


class BaseCompCompiler(ABC):
    """
    组件编译器基类

    提供所有编译器的通用接口：
    - 抽象编译接口
    """

    def __init__(self) -> None:
        """初始化编译器（由子类重写）"""
        pass

    @abstractmethod
    def compile(self):
        """
        编译组件（抽象方法，由子类实现）

        Returns:
            编译后的组件实例
        """
        pass