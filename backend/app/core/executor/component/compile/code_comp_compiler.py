#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

from typing import Any, Dict, List

from openjiuwen.core.common.logging import logger

from app.core.common.dsl import CodeConfig, ExceptHandlingMethod, ExceptConfig, Connection
from app.core.executor.component.compile import util
from app.core.executor.component.component_impl.code_comp import CodeComponent, ExceptedCondition, DefaultCondition
from app.core.executor.component.compile.base_comp_compiler import BaseCompCompiler
from app.core.common.exceptions import JiuWenExecuteException
from app.core.common.status_code import StatusCode


class CodeCompCompiler(BaseCompCompiler):
    def __init__(self, node_id: str, comp_config_dict: Dict[str, Any], workflow_connections: List[Connection]) -> None:
        super().__init__()
        self.comp_config_dict: Dict[str, Any] = comp_config_dict
        self.node_id: str = node_id
        self.workflow_connections: List[Connection] = workflow_connections

    def compile(self) -> CodeComponent:
        if not self.comp_config_dict:
            raise JiuWenExecuteException(
                StatusCode.CODE_COMP_COMPILER_ERROR.code,
                StatusCode.CODE_COMP_COMPILER_ERROR.errmsg.format(msg="Node data <comp_config_dict> is empty"),
                node_id=self.node_id
            )
        try:
            code_comp_config = CodeConfig.model_validate(self.comp_config_dict)
        except Exception as e:
            raise JiuWenExecuteException(
                StatusCode.CODE_COMP_COMPILER_ERROR.code,
                StatusCode.CODE_COMP_COMPILER_ERROR.errmsg.format(
                    msg=f"Node parameter configuration validation failed: {str(e)}"),
                node_id=self.node_id
            ) from e
        code_component = CodeComponent(self.node_id, code_comp_config)
        code_component = self._add_except_router(code_comp_config.exception_config, code_component)
        return code_component

    def _add_except_router(self, exception_config: ExceptConfig, code_component: CodeComponent) -> CodeComponent:
        router = exception_config.execute_exception_step
        if not router:
            logger.error(f"The branches in component id: {self.node_id} branchid is empty, please check!")
            raise JiuWenExecuteException(
                StatusCode.CODE_COMP_COMPILER_ERROR.code,
                StatusCode.CODE_COMP_COMPILER_ERROR.errmsg.format(
                    msg=f"Failed to add exception route: Component [{self.node_id}] exception branch configuration is empty"),
                node_id=self.node_id
            )
        excepted_condition = ExceptedCondition()
        default_condition = DefaultCondition(excepted_condition)
        code_component.set_excepted_condition(excepted_condition)

        targets = util.get_targets(self.node_id, router.default_router_id, self.workflow_connections)
        logger.info(f"[DEBUG] 调用 code_component.add_branch: node_id={self.node_id}, condition=default_condition, target={targets}, branch_id={router.default_router_id}")
        code_component.add_branch(default_condition, targets, router.default_router_id)

        if exception_config.except_handling_method == ExceptHandlingMethod.EXECUTE_EXCEPT_STEP:
            targets = util.get_targets(self.node_id, router.error_router_id, self.workflow_connections)
            logger.info(f"[DEBUG] 调用 code_component.add_branch: node_id={self.node_id}, condition=excepted_condition, target={targets}, branch_id={router.error_router_id}")
            code_component.add_branch(excepted_condition, targets, router.error_router_id)
        return code_component

    @staticmethod
    def add_except_router(exception_config: ExceptConfig, node_id: str, component: CodeComponent,
                          workflow_connections: List[Any]) -> CodeComponent:
        router = exception_config.execute_exception_step
        if not router:
            logger.error(f"The branches in component id: {node_id} branchid is empty, please check!")
            raise JiuWenExecuteException(
                StatusCode.CODE_COMP_COMPILER_ERROR.code,
                StatusCode.CODE_COMP_COMPILER_ERROR.errmsg.format(
                    msg=f"Failed to add exception route: Component [{node_id}] exception branch configuration is empty"),
                node_id=node_id
            )
        excepted_condition = ExceptedCondition()
        default_condition = DefaultCondition(excepted_condition)
        component.set_excepted_condition(excepted_condition)

        conn = CodeCompCompiler.get_connection(workflow_connections, router.default_router_id, node_id)
        logger.info(f"[DEBUG] 调用 component.add_branch (static): node_id={node_id}, condition=default_condition, target={[conn.target]}, branch_id={router.default_router_id}")
        component.add_branch(default_condition, [conn.target], router.default_router_id)
        conn = CodeCompCompiler.get_connection(workflow_connections, router.error_router_id, node_id)
        logger.info(f"[DEBUG] 调用 component.add_branch (static): node_id={node_id}, condition=excepted_condition, target={[conn.target]}, branch_id={router.error_router_id}")
        component.add_branch(excepted_condition, [conn.target], router.error_router_id)
        return component

    @staticmethod
    def get_connection(workflow_connections: List[Any], branch_id: str, node_id: str) -> Any:
        for conn in workflow_connections:
            if not conn.branch_id or conn.source != node_id or conn.branch_id != branch_id:
                continue
            # Must have only one, empty node inserted during validation phase
            return conn
        logger.error(f"The branches in component id: {node_id} branchid: {branch_id} is empty, please check!")
        raise JiuWenExecuteException(
            StatusCode.CODE_COMP_COMPILER_ERROR.code,
            StatusCode.CODE_COMP_COMPILER_ERROR.errmsg.format(
                msg=f"Failed to get connection: Component [{node_id}] branch <branch_id>: {branch_id} is empty"),
            node_id=node_id,
        )