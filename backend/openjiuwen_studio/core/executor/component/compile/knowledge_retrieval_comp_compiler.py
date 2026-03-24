#!/usr/bin/env python3.10
# coding: utf-8
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

from typing import Any, Dict

from openjiuwen.core.common.logging import logger
from openjiuwen.core.retrieval.common.config import (
    KnowledgeBaseConfig,
    RetrievalConfig,
    VectorStoreConfig,
)

from openjiuwen_studio.core.common.dsl import KnowledgeRetrievalConfig as KnowledgeRetrievalConfigDL
from openjiuwen_studio.core.common.exceptions import JiuWenExecuteException
from openjiuwen_studio.core.common.status_code import StatusCode
from openjiuwen_studio.core.executor.component.compile.base_comp_compiler import BaseCompCompiler
from openjiuwen_studio.core.executor.component.compile.llm_comp_compiler import parse_model_config
from openjiuwen_studio.core.manager.knowledge_base import (
    get_embed_model_config,
    get_vector_store_configs,
)

from openjiuwen.core.workflow.components.resource.knowledge_retrieval_comp import (
    KnowledgeRetrievalCompConfig,
    KnowledgeRetrievalComponent,
)


class KnowledgeRetrievalCompCompiler(BaseCompCompiler):
    """Compiler that transforms DSL KnowledgeRetrievalComponentConfig into an SDK-compatible component."""

    def __init__(self, node_id: str, comp_config_dict: Dict[str, Any], space_id: str) -> None:
        super().__init__()
        self.comp_config_dict = comp_config_dict
        self.node_id = node_id
        self.space_id = space_id

    def compile(self) -> KnowledgeRetrievalComponent:
        if not self.comp_config_dict:
            raise JiuWenExecuteException(
                StatusCode.KNOWLEDGE_RETRIEVAL_COMP_COMPILER_ERROR.code,
                StatusCode.KNOWLEDGE_RETRIEVAL_COMP_COMPILER_ERROR.errmsg.format(
                    msg="node data <comp_config_dict> is empty"
                ),
                node_id=self.node_id,
            )

        try:
            config = KnowledgeRetrievalConfigDL.model_validate(self.comp_config_dict)
        except Exception as e:
            raise JiuWenExecuteException(
                StatusCode.KNOWLEDGE_RETRIEVAL_COMP_COMPILER_ERROR.code,
                StatusCode.KNOWLEDGE_RETRIEVAL_COMP_COMPILER_ERROR.errmsg.format(
                    msg=f"Failed to parse config: {str(e)}"
                ),
                node_id=self.node_id,
            ) from e

        if not config.kb_ids:
            raise JiuWenExecuteException(
                StatusCode.KNOWLEDGE_RETRIEVAL_COMP_COMPILER_ERROR.code,
                StatusCode.KNOWLEDGE_RETRIEVAL_COMP_COMPILER_ERROR.errmsg.format(
                    msg="kb_ids is empty, at least one knowledge base is required"
                ),
                node_id=self.node_id,
            )

        # Build KB config
        kb_configs = [KnowledgeBaseConfig(
            kb_id=kb_id, index_type="vector") for kb_id in config.kb_ids]

        # Embed config
        first_kb_id = config.kb_ids[0]
        # We use first kb_id due to sdk limitation. It will be updated in future to support multiple KBs.
        try:
            embed_config = get_embed_model_config(kb_id=first_kb_id, space_id=self.space_id)
        except Exception as e:
            raise JiuWenExecuteException(
                StatusCode.KNOWLEDGE_RETRIEVAL_COMP_COMPILER_ERROR.code,
                StatusCode.KNOWLEDGE_RETRIEVAL_COMP_COMPILER_ERROR.errmsg.format(
                    msg="Failed to get embed model config, cannot proceed with compilation"
                ),
                node_id=self.node_id,
            ) from e

        # Retrieval config
        retrieval_config = RetrievalConfig(
            top_k=config.retrieval_config.get("top_k", 5),
            score_threshold=config.retrieval_config.get("score_threshold", 0.5),
            use_graph=config.retrieval_config.get("use_graph", False),
            graph_expansion=config.retrieval_config.get("use_graph", False),
            agentic=config.retrieval_config.get("agentic", False),
        )

        # Vector store config
        # We use first kb_id due to sdk limitation. It will be updated in future to support multiple KBs.
        collection_name = f"kb_{first_kb_id}_chunks"
        try:
            vector_store_config, vector_store_additional_config = get_vector_store_configs(collection_name)
        except Exception as e:
            raise JiuWenExecuteException(
                StatusCode.KNOWLEDGE_RETRIEVAL_COMP_COMPILER_ERROR.code,
                StatusCode.KNOWLEDGE_RETRIEVAL_COMP_COMPILER_ERROR.errmsg.format(
                    msg="Failed to obtain vector store configs, cannot proceed with compilation"
                ),
                node_id=self.node_id,
            ) from e

        # Build the SDK component config
        if retrieval_config.agentic:
            model_config, model_client_config, model_id = parse_model_config(config.model_dump())
            comp_config = KnowledgeRetrievalCompConfig(
                kb_configs=kb_configs,
                retrieval_config=retrieval_config,
                vector_store_config=vector_store_config,
                vector_store_additional_config=vector_store_additional_config,
                embed_config=embed_config,
                model_id=None,  # To skip fetching model from Runner.get_model
                model_client_config=model_client_config,
                model_config=model_config,
                result_separator=config.result_separator,
                include_metadata=config.include_metadata,
            )
        else:
            comp_config = KnowledgeRetrievalCompConfig(
                kb_configs=kb_configs,
                retrieval_config=retrieval_config,
                vector_store_config=vector_store_config,
                vector_store_additional_config=vector_store_additional_config,
                embed_config=embed_config,
                result_separator=config.result_separator,
                include_metadata=config.include_metadata,
            )

        logger.info(
            f"KnowledgeRetrievalCompCompiler compiled component for node {self.node_id} "
            f"with {len(config.kb_ids)} knowledge bases"
        )

        return KnowledgeRetrievalComponent(component_config=comp_config)
