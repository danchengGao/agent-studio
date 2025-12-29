#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

import os
from collections import OrderedDict

import yaml


def ordered_yaml_load(stream, yaml_loader=yaml.SafeLoader,
                      object_pairs_hook=OrderedDict):
    class OrderedLoader(yaml_loader):
        pass

    def _construct_mapping(loader, node):
        loader.flatten_mapping(node)
        return object_pairs_hook(loader.construct_pairs(node))

    OrderedLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,
                                  _construct_mapping)

    return yaml.load(stream, Loader=OrderedLoader)


class DictConfig:
    def __init__(self, **kwargs):
        self.update(**kwargs)

    def update(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)

    def __getattr__(self, name):
        return None


class ExecutorConfig():
    def __init__(self, config_path):
        if not os.path.exists(config_path):
            raise FileNotFoundError(f"Config file '{config_path}' not found")
        abs_path = os.path.abspath(os.path.realpath(config_path))
        if os.path.isdir(abs_path):
            raise ValueError(f"Config path '{abs_path}' must be a file, not a directory")

        with open(abs_path, "r", encoding='utf-8') as file:
            config_dict = ordered_yaml_load(file, yaml_loader=yaml.SafeLoader)

        self._config = self._dict_to_config(config_dict)

    def _dict_to_config(self, config_dict):
        _config = DictConfig()
        setattr(_config, "raw_config", config_dict)

        for key, value in config_dict.items():
            if isinstance(value, dict):
                setattr(_config, key, self._dict_to_config(value))
            else:
                setattr(_config, key, value)

        return _config

    def __getattr__(self, name):
        return getattr(self._config, name)


config = ExecutorConfig(os.path.join(os.path.dirname(__file__), "../../conf/config.yaml"))

from openjiuwen.extensions.common.configs.config_manager import configure
from openjiuwen.extensions.common.configs.log_config import configure_log

configure(os.path.join(os.path.dirname(__file__), "../../conf/config.yaml"))
configure_log(os.path.join(os.path.dirname(__file__), "../../conf/config.yaml"))
