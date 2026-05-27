#!/usr/bin/env python3.10
# coding: utf-8
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

from typing import Any, Dict, List

from openjiuwen.core.common.logging import logger
from openjiuwen.core.retrieval.common.config import (
    EmbeddingConfig,
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
    get_vector_store_config,
    get_vector_store_connection_config,
)

from openjiuwen.core.workflow.components.resource.knowledge_retrieval_comp import (
    ComponentKBConfig,
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

        # Retrieval config
        retrieval_config = RetrievalConfig(
            top_k=config.retrieval_config.get("top_k", 5),
            score_threshold=config.retrieval_config.get("score_threshold", 0.5),
            use_graph=config.retrieval_config.get("use_graph", False),
            graph_expansion=config.retrieval_config.get("use_graph", False),
            agentic=config.retrieval_config.get("agentic", False),
        )

        component_kb_configs = self._build_component_kb_configs(config.kb_ids)
        vector_store_connection_config = get_vector_store_connection_config()

        if retrieval_config.agentic:
            try:
                model_config, model_client_config, _ = parse_model_config(config.model_dump())
            except Exception as e:
                raise JiuWenExecuteException(
                    StatusCode.KNOWLEDGE_RETRIEVAL_COMP_COMPILER_ERROR.code,
                    StatusCode.KNOWLEDGE_RETRIEVAL_COMP_COMPILER_ERROR.errmsg.format(
                        msg="Failed to parse model config for agentic retrieval"
                    ),
                    node_id=self.node_id,
                ) from e

            comp_config = KnowledgeRetrievalCompConfig(
                component_kb_configs=component_kb_configs,
                retrieval_config=retrieval_config,
                vector_store_connection_config=vector_store_connection_config,
                model_id=None,  # To skip fetching model from Runner.get_model
                model_client_config=model_client_config,
                model_config=model_config,
            )
        else:
            comp_config = KnowledgeRetrievalCompConfig(
                component_kb_configs=component_kb_configs,
                retrieval_config=retrieval_config,
                vector_store_connection_config=vector_store_connection_config,
            )

        logger.info(
            f"KnowledgeRetrievalCompCompiler compiled component for node {self.node_id} "
            f"with {len(config.kb_ids)} knowledge bases"
        )

        return KnowledgeRetrievalComponent(component_config=comp_config)

    def _build_component_kb_configs(
        self, kb_ids: List[str]
    ) -> List[ComponentKBConfig]:
        component_kb_configs: List[ComponentKBConfig] = []

        for kb_id in kb_ids:
            embed_config = self._get_embed_config(kb_id)
            vector_store_config = self._get_vector_store_config(kb_id)

            component_kb_configs.append(
                ComponentKBConfig(
                    kb_config=KnowledgeBaseConfig(kb_id=kb_id, index_type="vector"),
                    vector_store_config=vector_store_config,
                    embed_config=embed_config,
                )
            )

        return component_kb_configs

    def _get_embed_config(self, kb_id: str) -> EmbeddingConfig:
        try:
            return get_embed_model_config(kb_id=kb_id, space_id=self.space_id)
        except Exception as e:
            raise JiuWenExecuteException(
                StatusCode.KNOWLEDGE_RETRIEVAL_COMP_COMPILER_ERROR.code,
                StatusCode.KNOWLEDGE_RETRIEVAL_COMP_COMPILER_ERROR.errmsg.format(
                    msg=f"Failed to get embed model config for knowledge base {kb_id}"
                ),
                node_id=self.node_id,
            ) from e

    def _get_vector_store_config(self, kb_id: str) -> VectorStoreConfig:
        collection_name = f"kb_{kb_id}_chunks"
        try:
            return get_vector_store_config(collection_name)
        except Exception as e:
            raise JiuWenExecuteException(
                StatusCode.KNOWLEDGE_RETRIEVAL_COMP_COMPILER_ERROR.code,
                StatusCode.KNOWLEDGE_RETRIEVAL_COMP_COMPILER_ERROR.errmsg.format(
                    msg=f"Failed to obtain vector store configs for knowledge base {kb_id}"
                ),
                node_id=self.node_id,
            ) from e
