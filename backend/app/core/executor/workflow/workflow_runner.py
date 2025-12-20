#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

from typing import Any, Dict, AsyncGenerator

from fastapi import status
from openjiuwen.core.common.exception.exception import JiuWenBaseException
from openjiuwen.core.common.logging import logger
from openjiuwen.core.workflow.base import Workflow as InvokableWorkflow
from openjiuwen.core.tracer.span import TraceWorkflowSpan
from openjiuwen.core.stream.writer import TraceSchema

import app.core.manager.workflow as mgr
from app.core.executor.workflow.context import Context
from app.core.common.status_code import StatusCode
from app.core.executor.workflow.pregel_graph_adapter import JiuWenGraphException
from app.core.executor.workflow.workflow import Workflow, IWorkflowLoader
from app.core.executor.util.utils import result_convert, save_execution_traces, handle_stream_error
from app.schemas import WorkflowId
from app.core.common.exceptions import JiuWenComponentException, JiuWenExecuteException


async def _fetch_workflow_dl(
    id: str, version: str, space_id: str, current_user: Dict[str, Any]
) -> Any:
    req = {"workflow_id": id, "space_id": space_id, "version": version}
    res = mgr.workflow_convert(WorkflowId(**req), current_user)
    if res.code != status.HTTP_200_OK:
        if isinstance(res.data, dict) and "error_code" in res.data:
            if "component_id" in res.data and "component_type" in res.data:
                raise JiuWenComponentException(
                    error_code=res.data.get("error_code"),
                    message=str(res.message),
                    component_id=res.data.get("component_id"),
                    component_type=res.data.get("component_type"),
                    error_stage=res.data.get("error_stage") or "convert",
                )
            raise JiuWenBaseException(
                error_code=res.data.get("error_code"),
                message=str(res.message),
            )
        raise JiuWenBaseException(
            error_code=StatusCode.WORKFLOW_DL_FETCH_FAILED.code,
            message=StatusCode.WORKFLOW_DL_FETCH_FAILED.errmsg.format(msg=str(res.message)),
        )
    workflow_dl = res.data
    if workflow_dl is None:
        raise JiuWenBaseException(
            error_code=StatusCode.WORKFLOW_DL_FETCH_FAILED.code,
            message=StatusCode.WORKFLOW_DL_FETCH_FAILED.errmsg.format(msg=str("fetch workflow failed"))
        )
    logger.info(f"fetch workflow dl: {workflow_dl.model_dump_json()}")
    return workflow_dl


class WorkflowRunner(IWorkflowLoader):
    def __init__(self) -> None:
        pass

    async def get_flow(
        self, id: str, version: str, space_id: str, current_user: Dict[str, Any]
    ) -> Workflow:
        flow = Workflow(await _fetch_workflow_dl(id, version, space_id, current_user), space_id, current_user)
        return flow

    async def get_compiled_workflow(
        self, context: Context,
        id: str, version: str, space_id: str, current_user: Dict[str, Any]
    ) -> InvokableWorkflow:
        workflow = await self.get_flow(id, version, space_id, current_user)
        compiled = await workflow.compile(context, self)
        return compiled

    async def run(
        self,
        id: str,
        version: str,
        inputs: Any,
        conversation_id: str,
        space_id: str,
        current_user: Dict[str, Any],
    ) -> AsyncGenerator[Any, None]:
        # 收集一次执行的所有 trace log
        trace_logs: list[TraceWorkflowSpan] = []
        flow_index = WorkflowId(
            space_id=space_id,
            workflow_id=id,
            workflow_version=version,
        )
        last_chunk = None  # 用于异常时回溯
        # trace_id = None  # 暂时保留 trace_id 用于 trace_summary 创建

        try:
            flow = await self.get_compiled_workflow(Context(), id, version, space_id, current_user)

            from openjiuwen.core.runtime.workflow import WorkflowRuntime

            runtime = WorkflowRuntime(session_id="default")
            async for chunk in flow.stream(inputs=inputs, runtime=runtime):
                # 检查是否为需要过滤的workflow trace chunk
                if isinstance(chunk, TraceSchema) and chunk.type == "tracer_workflow":
                    wf = TraceWorkflowSpan.model_validate(chunk.payload)
                    # 检查条件：有workflowId字段且invokeId == workflowId
                    if hasattr(wf, 'workflow_id') and wf.invoke_id == wf.workflow_id:
                        continue
                # logger.debug(f"get workflow stream chunk: {chunk}")
                last_chunk = chunk

                rsp, trace_log, _ = result_convert(
                    chunk, business_type="WORKFLOW"
                )
                # if trace_detail:
                #     await save_trace_detail(flow_index, trace_detail)
                #     if trace_id is None:
                #         trace_id = trace_detail.trace_id
                if trace_log:
                    trace_logs.append(trace_log)
                if rsp:
                    logger.debug(f"workflow stream return rsp: {rsp}")
                    yield rsp

            if trace_logs:
                await save_execution_traces(flow_index, trace_logs)
            # if trace_id is not None:
            #     trace_summary_repository.create_trace_summary_by_trace_id(trace_id)
        except JiuWenExecuteException as e:
            await handle_stream_error(trace_logs, last_chunk, e.error_code, e.message, flow_index)
            # if trace_id is not None:
            #     trace_summary_repository.create_trace_summary_by_trace_id(trace_id)
            raise JiuWenExecuteException(e.error_code, e.message, workflow_id=id, node_id=e.node_id, connection=e.connection)
        except (JiuWenBaseException, JiuWenGraphException) as e:
            await handle_stream_error(trace_logs, last_chunk, e.error_code, e.message, flow_index)
            # if trace_id is not None:
            #     trace_summary_repository.create_trace_summary_by_trace_id(trace_id)
            raise JiuWenExecuteException(e.error_code, e.message, workflow_id=id) from e
        except Exception as e:
            await handle_stream_error(trace_logs, last_chunk, -1, str(e), flow_index)
            # if trace_id is not None:
            #     trace_summary_repository.create_trace_summary_by_trace_id(trace_id)
            raise JiuWenExecuteException(
                StatusCode.WORKFLOW_RUNNER_ERROR.code,
                StatusCode.WORKFLOW_RUNNER_ERROR.errmsg.format(msg=str(e)),
                workflow_id=id,
            ) from e

    async def validate(
        self,
        id: str,
        version: str,
        space_id: str,
        current_user: Dict[str, Any]
    ) -> bool:
        Workflow(await _fetch_workflow_dl(id, version, space_id, current_user), space_id, current_user)
        return True


flow_mgr = WorkflowRunner()
