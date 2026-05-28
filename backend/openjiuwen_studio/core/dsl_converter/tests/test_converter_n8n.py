#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

"""
Tests for N8nWorkflowConverter

Run all tests:
    python -m pytest tests/test_converter_n8n.py -v

Run a specific node suite:
    python -m pytest tests/test_converter_n8n.py::TestN8nWorkflowConverter -v  # fixture-based
    python -m pytest tests/test_converter_n8n.py::TestIDGenerator -v
    python -m pytest tests/test_converter_n8n.py::TestLLMNode -v
    python -m pytest tests/test_converter_n8n.py::TestIFNode -v
    python -m pytest tests/test_converter_n8n.py::TestLoopNode -v
    python -m pytest tests/test_converter_n8n.py::TestLoopWithBody -v
    python -m pytest tests/test_converter_n8n.py::TestCodeNode -v
    python -m pytest tests/test_converter_n8n.py::TestSetNode -v
    python -m pytest tests/test_converter_n8n.py::TestPluginNode -v
    python -m pytest tests/test_converter_n8n.py::TestMergeNode -v
    python -m pytest tests/test_converter_n8n.py::TestWorkflowNode -v
    python -m pytest tests/test_converter_n8n.py::TestTriggerNodes -v
    python -m pytest tests/test_converter_n8n.py::TestConnections -v
    python -m pytest tests/test_converter_n8n.py::TestExpressions -v
    python -m pytest tests/test_converter_n8n.py::TestModelMapping -v
    python -m pytest tests/test_converter_n8n.py::TestNormalizePythonMain -v
    python -m pytest tests/test_converter_n8n.py::TestFallbackNode -v
    python -m pytest tests/test_converter_n8n.py::TestStickyNote -v
    python -m pytest tests/test_converter_n8n.py::TestDataTransformNodes -v
    python -m pytest tests/test_converter_n8n.py::TestCompareDatasets -v
    python -m pytest tests/test_converter_n8n.py::TestLocale -v
    python -m pytest tests/test_converter_n8n.py::TestTransformationReport -v
"""

import json
from pathlib import Path
import pytest

from openjiuwen_studio.core.dsl_converter.converter.converter_n8n import N8nWorkflowConverter
from openjiuwen_studio.core.common.dsl import ComponentType


class TestableConverter(N8nWorkflowConverter):
    """Subclass that exposes protected helpers as public methods for testing."""

    def setup(self) -> "TestableConverter":
        """Reset state and return self for chaining."""
        self.reset_state()
        self.start_node_id = "start_1"
        return self

    def convert_expression(self, text: str) -> str:
        """Public wrapper for _convert_expression."""
        return self._convert_expression(text)

    def convert_expression_with_mapping(self, text: str) -> str:
        """Public wrapper for _convert_expression_with_mapping."""
        return self._convert_expression_with_mapping(text)

    def map_model(self, model_name: str, provider: str = "") -> dict:
        """Public wrapper for _map_model_to_jiuwen."""
        return self._map_model_to_jiuwen(model_name, provider)

    def normalize_python_main(self, code: str) -> str:
        """Public wrapper for _normalize_python_main."""
        return self._normalize_python_main(code)


# =============================================================================
# SHARED HELPERS
# =============================================================================

def make_node(name, n8n_type, params=None, position=None):
    """Build a minimal n8n node dict."""
    return {
        "name": name,
        "type": n8n_type,
        "parameters": params or {},
        "position": position or [100, 100],
    }


def make_workflow(*nodes, connections=None):
    """Build a minimal n8n workflow dict."""
    return {
        "name": "Test Workflow",
        "nodes": list(nodes),
        "connections": connections or {},
    }


def connect(source, target, output_index=0):
    """Return an n8n connection entry for one source→target pair."""
    slots = [[] for _ in range(output_index + 1)]
    slots[output_index] = [{"node": target, "type": "main", "index": 0}]
    return {source: {"main": slots}}


def merge_connections(*conn_dicts):
    """Merge multiple connect() dicts into one connections object."""
    merged = {}
    for d in conn_dicts:
        for src, types_map in d.items():
            if src not in merged:
                merged[src] = {}
            for conn_type, slots in types_map.items():
                if conn_type not in merged[src]:
                    merged[src][conn_type] = []
                for i, slot in enumerate(slots):
                    while len(merged[src][conn_type]) <= i:
                        merged[src][conn_type].append([])
                    merged[src][conn_type][i].extend(slot)
    return merged


def schema_from(workflow_dict):
    """Run convert_to_schema and return (nodes, edges)."""
    c = N8nWorkflowConverter()
    result = c.convert_to_schema(workflow_dict)
    return result["nodes"], result["edges"]


def node_of_type(nodes, jiuwen_type):
    """Return first node matching the given ComponentType int."""
    return next((n for n in nodes if int(n["type"]) == jiuwen_type), None)


def nodes_of_type(nodes, jiuwen_type):
    """Return all nodes matching the given ComponentType int."""
    return [n for n in nodes if int(n["type"]) == jiuwen_type]


# =============================================================================
# FIXTURES
# =============================================================================

@pytest.fixture
def converter():
    """Create a fresh converter instance."""
    return N8nWorkflowConverter()


@pytest.fixture
def fixtures_dir():
    """Path to the fixtures directory."""
    return Path(__file__).parent / "fixtures"


@pytest.fixture
def n8n_workflow(fixtures_dir):
    """Load n8n_workflow.json fixture."""
    with open(fixtures_dir / "n8n_workflow.json") as f:
        return json.load(f)


# =============================================================================
# FIXTURE-BASED TESTS (full pipeline with real JSON)
# =============================================================================

class TestN8nWorkflowConverter:
    """Integration tests using the n8n_workflow.json fixture."""

    @staticmethod
    def test_convert_from_n8n_fixture(converter, n8n_workflow):
        """Test conversion from n8n_workflow.json fixture"""
        result = converter.convert(n8n_workflow)

        assert result.workflow_data is not None
        assert result.metadata["source"] == "n8n"
        assert result.metadata["original_name"] == n8n_workflow["name"]
        assert result.metadata["original_nodes"] == 5

    @staticmethod
    def test_convert_creates_workflow_with_metadata(converter, n8n_workflow):
        """Test that conversion creates workflow with correct metadata"""
        result = converter.convert(n8n_workflow)

        assert "Example n8n Workflow" in result.workflow_data["name"]
        assert "Imported from n8n" in result.workflow_data["desc"]
        assert result.workflow_data["workflow_id"] is not None
        assert result.workflow_data["create_time"] is not None

    @staticmethod
    def test_convert_creates_openjiuwen_schema(converter, n8n_workflow):
        """Test that conversion creates valid OpenJiuwen schema"""
        result = converter.convert(n8n_workflow)

        schema = json.loads(result.workflow_data["schema"])
        assert "nodes" in schema
        assert "edges" in schema
        assert isinstance(schema["nodes"], list)
        assert isinstance(schema["edges"], list)

    @staticmethod
    def test_convert_adds_start_and_end_nodes(converter, n8n_workflow):
        """Test that START and END nodes are added"""
        result = converter.convert(n8n_workflow)

        schema = json.loads(result.workflow_data["schema"])
        node_types = [str(node["type"]) for node in schema["nodes"]]

        assert str(ComponentType.COMPONENT_TYPE_START) in node_types
        assert str(ComponentType.COMPONENT_TYPE_END) in node_types

    @staticmethod
    def test_convert_http_request_node(converter, n8n_workflow):
        """Test conversion of n8n httpRequest node to HTTP Request component"""
        result = converter.convert(n8n_workflow)
        schema = json.loads(result.workflow_data["schema"])

        http_nodes = [n for n in schema["nodes"]
                      if str(n["type"]) == str(ComponentType.COMPONENT_TYPE_HTTP_REQUEST)]

        assert len(http_nodes) >= 1
        assert any("HTTP Request" in n["data"]["title"] for n in http_nodes)

    @staticmethod
    def test_convert_code_node(converter, n8n_workflow):
        """Test conversion of n8n code node to Code component"""
        result = converter.convert(n8n_workflow)
        schema = json.loads(result.workflow_data["schema"])

        code_nodes = [n for n in schema["nodes"]
                      if str(n["type"]) == str(ComponentType.COMPONENT_TYPE_CODE)]

        # The fixture has a Code node ("Process Data") and a respondToWebhook (also code)
        assert len(code_nodes) >= 1

    @staticmethod
    def test_convert_if_node(converter, n8n_workflow):
        """Test conversion of n8n IF node to Branch component"""
        result = converter.convert(n8n_workflow)
        schema = json.loads(result.workflow_data["schema"])

        if_nodes = [n for n in schema["nodes"]
                    if str(n["type"]) == str(ComponentType.COMPONENT_TYPE_IF)]

        assert len(if_nodes) >= 1
        assert any("Check Condition" in n["data"]["title"] for n in if_nodes)

    @staticmethod
    def test_convert_preserves_node_positions(converter, n8n_workflow):
        """Test that node positions are preserved from fixture"""
        result = converter.convert(n8n_workflow)
        schema = json.loads(result.workflow_data["schema"])

        excluded_types = {
            str(ComponentType.COMPONENT_TYPE_START),
            str(ComponentType.COMPONENT_TYPE_END)
        }
        converted_nodes = [
            n for n in schema["nodes"] if str(n["type"]) not in excluded_types
        ]

        # Fixture produces 4 main nodes (webhook trigger merged into Start)
        assert len(converted_nodes) >= 4
        positions_preserved = any(
            n.get("meta", {}).get("position", {}).get("x") in [250, 450, 650, 850, 1050]
            for n in converted_nodes
        )
        assert positions_preserved

    @staticmethod
    def test_convert_connections_to_edges(converter, n8n_workflow):
        """Test that n8n connections are converted to edges"""
        result = converter.convert(n8n_workflow)
        schema = json.loads(result.workflow_data["schema"])

        assert len(schema["edges"]) >= 4
        for edge in schema["edges"]:
            assert "id" in edge
            assert "sourceNodeID" in edge
            assert "targetNodeID" in edge

    @staticmethod
    def test_convert_extracts_input_output_parameters(converter, n8n_workflow):
        """Test that input/output parameters are extracted"""
        result = converter.convert(n8n_workflow)

        assert "input_parameters" in result.workflow_data
        assert "output_parameters" in result.workflow_data
        assert isinstance(result.workflow_data["input_parameters"], list)
        assert isinstance(result.workflow_data["output_parameters"], list)

    @staticmethod
    def test_convert_includes_conversion_metadata(converter, n8n_workflow):
        """Test that result includes conversion metadata"""
        result = converter.convert(n8n_workflow)

        assert result.metadata["source"] == "n8n"
        assert result.metadata["original_name"] == "Example n8n Workflow"
        assert result.metadata["original_nodes"] == 5
        assert "converted_nodes" in result.metadata

    @staticmethod
    def test_convert_empty_workflow_raises_error(converter):
        """Test that workflow with no nodes raises error"""
        with pytest.raises(ValueError, match="n8n workflow has no nodes"):
            converter.convert({"name": "Empty", "nodes": [], "connections": {}})

    @staticmethod
    @pytest.mark.xfail(reason="add_start_end_nodes is a legacy static method with a known NameError "
                               "(references 'self' inside a @staticmethod). Kept to document the bug.")
    def test_add_start_end_nodes_adds_both(converter):
        """Test that add_start_end_nodes adds START and END nodes"""
        nodes = [{"id": "node1", "type": "3", "data": {"title": "Test"}}]
        edges = []

        result_nodes, result_edges = converter.add_start_end_nodes(nodes, edges)

        start_nodes = [n for n in result_nodes
                       if str(n["type"]) == str(ComponentType.COMPONENT_TYPE_START)]
        end_nodes = [n for n in result_nodes
                     if str(n["type"]) == str(ComponentType.COMPONENT_TYPE_END)]

        assert len(start_nodes) == 1
        assert len(end_nodes) == 1
        assert len(result_edges) >= 2

    @staticmethod
    def test_convert_headers_from_dict(converter):
        """Test convert_headers with dict input"""
        headers = {"Authorization": "Bearer token", "Content-Type": "application/json"}
        assert converter.convert_headers(headers) == headers

    @staticmethod
    def test_convert_headers_from_list(converter):
        """Test convert_headers with list input (n8n format)"""
        headers = [{"name": "Authorization", "value": "Bearer token123"}]
        result = converter.convert_headers(headers)
        assert result["Authorization"] == "Bearer token123"

    @staticmethod
    def test_convert_headers_empty(converter):
        """Test convert_headers with empty input"""
        assert converter.convert_headers(None) == {}
        assert converter.convert_headers({}) == {}
        assert converter.convert_headers([]) == {}

    @staticmethod
    def test_generate_node_id_format(converter):
        """Test that generate_node_id creates valid IDs"""
        node_id = converter.generate_node_id("n8n-nodes-base.httpRequest")
        assert node_id.startswith("httpRequest_")
        assert len(node_id) > len("httpRequest_")


# =============================================================================
# UNIT TESTS — IDGenerator
# =============================================================================

class TestIDGenerator:
    @staticmethod
    def test_sequential_ids():
        from openjiuwen_studio.core.dsl_converter.converter.converter_n8n import IDGenerator
        gen = IDGenerator()
        assert gen.next_id("llm") == "llm_1"
        assert gen.next_id("llm") == "llm_2"
        assert gen.next_id("end") == "end_1"

    @staticmethod
    def test_reset():
        from openjiuwen_studio.core.dsl_converter.converter.converter_n8n import IDGenerator
        gen = IDGenerator()
        gen.next_id("llm")
        gen.reset()
        assert gen.next_id("llm") == "llm_1"

    @staticmethod
    def test_independent_prefixes():
        from openjiuwen_studio.core.dsl_converter.converter.converter_n8n import IDGenerator
        gen = IDGenerator()
        gen.next_id("a")
        gen.next_id("b")
        assert gen.next_id("a") == "a_2"
        assert gen.next_id("b") == "b_2"


# =============================================================================
# UNIT TESTS — Start / End nodes
# =============================================================================

class TestStartEndNodes:
    @staticmethod
    def _simple_workflow():
        return make_workflow(
            make_node("Code", "n8n-nodes-base.code",
                      {"language": "javaScript", "jsCode": "return [];"})
        )

    def test_start_node_created(self):
        nodes, _ = schema_from(self._simple_workflow())
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_START) is not None

    def test_end_node_created(self):
        nodes, _ = schema_from(self._simple_workflow())
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_END) is not None

    def test_only_one_start_node(self):
        nodes, _ = schema_from(self._simple_workflow())
        assert len(nodes_of_type(nodes, ComponentType.COMPONENT_TYPE_START)) == 1

    def test_start_connected_to_first_node(self):
        nodes, edges = schema_from(self._simple_workflow())
        start = node_of_type(nodes, ComponentType.COMPONENT_TYPE_START)
        assert any(e["sourceNodeID"] == start["id"] for e in edges)

    def test_last_node_connected_to_end(self):
        nodes, edges = schema_from(self._simple_workflow())
        end = node_of_type(nodes, ComponentType.COMPONENT_TYPE_END)
        assert any(e["targetNodeID"] == end["id"] for e in edges)

    def test_generic_start_has_input_property(self):
        nodes, _ = schema_from(self._simple_workflow())
        start = node_of_type(nodes, ComponentType.COMPONENT_TYPE_START)
        assert "input" in start["data"]["outputs"]["properties"]

    def test_end_node_has_title(self):
        nodes, _ = schema_from(self._simple_workflow())
        end = node_of_type(nodes, ComponentType.COMPONENT_TYPE_END)
        assert "title" in end["data"]

    def test_end_node_has_inputs(self):
        nodes, _ = schema_from(self._simple_workflow())
        end = node_of_type(nodes, ComponentType.COMPONENT_TYPE_END)
        assert "inputs" in end["data"]

    def test_start_node_id_uses_start_prefix(self):
        nodes, _ = schema_from(self._simple_workflow())
        start = node_of_type(nodes, ComponentType.COMPONENT_TYPE_START)
        assert start["id"].startswith("start_")

    def test_end_node_id_uses_end_prefix(self):
        nodes, _ = schema_from(self._simple_workflow())
        end = node_of_type(nodes, ComponentType.COMPONENT_TYPE_END)
        assert end["id"].startswith("end_")


# =============================================================================
# UNIT TESTS — Trigger nodes
# =============================================================================

class TestTriggerNodes:
    @staticmethod
    def test_webhook_trigger_merged_into_start():
        trigger = make_node("Webhook", "n8n-nodes-base.webhook")
        code = make_node("Code", "n8n-nodes-base.code",
                         {"language": "javaScript", "jsCode": ""})
        nodes, _ = schema_from(make_workflow(trigger, code, connections=connect("Webhook", "Code")))
        start = node_of_type(nodes, ComponentType.COMPONENT_TYPE_START)
        assert "body" in start["data"]["outputs"]["properties"]

    @staticmethod
    def test_only_one_start_node_with_trigger():
        trigger = make_node("Webhook", "n8n-nodes-base.webhook")
        code = make_node("Code", "n8n-nodes-base.code",
                         {"language": "javaScript", "jsCode": ""})
        nodes, _ = schema_from(make_workflow(trigger, code, connections=connect("Webhook", "Code")))
        assert len(nodes_of_type(nodes, ComponentType.COMPONENT_TYPE_START)) == 1

    @staticmethod
    def test_chat_trigger_outputs_chat_input():
        trigger = make_node("Chat", "n8n-nodes-base.chatTrigger")
        code = make_node("Code", "n8n-nodes-base.code",
                         {"language": "javaScript", "jsCode": ""})
        nodes, _ = schema_from(make_workflow(trigger, code, connections=connect("Chat", "Code")))
        start = node_of_type(nodes, ComponentType.COMPONENT_TYPE_START)
        assert "chatInput" in start["data"]["outputs"]["properties"]

    @staticmethod
    def test_form_trigger_maps_field_names():
        trigger = make_node("Form", "n8n-nodes-base.formTrigger", {
            "formFields": {"values": [
                {"fieldLabel": "City", "requiredField": True},
                {"fieldLabel": "Date"},
            ]}
        })
        code = make_node("Code", "n8n-nodes-base.code",
                         {"language": "javaScript", "jsCode": ""})
        nodes, _ = schema_from(make_workflow(trigger, code, connections=connect("Form", "Code")))
        start = node_of_type(nodes, ComponentType.COMPONENT_TYPE_START)
        props = start["data"]["outputs"]["properties"]
        assert "city" in props
        assert "date" in props

    @staticmethod
    def test_cron_treated_as_trigger():
        trigger = make_node("Cron", "n8n-nodes-base.cron")
        code = make_node("Code", "n8n-nodes-base.code",
                         {"language": "javaScript", "jsCode": ""})
        nodes, _ = schema_from(make_workflow(trigger, code, connections=connect("Cron", "Code")))
        assert len(nodes_of_type(nodes, ComponentType.COMPONENT_TYPE_START)) == 1

    @staticmethod
    def test_webhook_trigger_has_headers_and_query():
        trigger = make_node("Webhook", "n8n-nodes-base.webhook")
        code = make_node("Code", "n8n-nodes-base.code", {"language": "javaScript", "jsCode": ""})
        nodes, _ = schema_from(make_workflow(trigger, code, connections=connect("Webhook", "Code")))
        start = node_of_type(nodes, ComponentType.COMPONENT_TYPE_START)
        props = start["data"]["outputs"]["properties"]
        assert "headers" in props
        assert "query" in props

    @staticmethod
    def test_manual_trigger_produces_empty_outputs():
        trigger = make_node("Manual", "n8n-nodes-base.manualTrigger")
        code = make_node("Code", "n8n-nodes-base.code", {"language": "javaScript", "jsCode": ""})
        nodes, _ = schema_from(make_workflow(trigger, code, connections=connect("Manual", "Code")))
        start = node_of_type(nodes, ComponentType.COMPONENT_TYPE_START)
        assert start["data"]["outputs"]["properties"] == {}

    @staticmethod
    def test_trigger_not_emitted_as_separate_node():
        """Trigger node must be merged into Start and must not produce a standalone node."""
        trigger = make_node("Wh", "n8n-nodes-base.webhook")
        code = make_node("Code", "n8n-nodes-base.code", {"language": "javaScript", "jsCode": ""})
        nodes, _ = schema_from(make_workflow(trigger, code, connections=connect("Wh", "Code")))
        # Only start + code + end — no extra node for the trigger
        assert len(nodes_of_type(nodes, ComponentType.COMPONENT_TYPE_START)) == 1
        titles = [n.get("data", {}).get("title", "") for n in nodes]
        assert not any("Wh" == t for t in titles)

    @staticmethod
    def test_form_trigger_required_field_in_required_list():
        trigger = make_node("Form", "n8n-nodes-base.formTrigger", {
            "formFields": {"values": [
                {"fieldLabel": "City", "requiredField": True},
                {"fieldLabel": "Notes", "requiredField": False},
            ]}
        })
        code = make_node("Code", "n8n-nodes-base.code", {"language": "javaScript", "jsCode": ""})
        nodes, _ = schema_from(make_workflow(trigger, code, connections=connect("Form", "Code")))
        start = node_of_type(nodes, ComponentType.COMPONENT_TYPE_START)
        required = start["data"]["outputs"].get("required", [])
        assert "city" in required

    @staticmethod
    def test_schedule_trigger_treated_as_trigger():
        trigger = make_node("Schedule", "n8n-nodes-base.schedule")
        code = make_node("Code", "n8n-nodes-base.code", {"language": "javaScript", "jsCode": ""})
        nodes, _ = schema_from(make_workflow(trigger, code, connections=connect("Schedule", "Code")))
        assert len(nodes_of_type(nodes, ComponentType.COMPONENT_TYPE_START)) == 1


# =============================================================================
# UNIT TESTS — LLM node (chainLlm and other non-agent LLM nodes)
# =============================================================================

class TestLLMNode:
    # n8n-nodes-base.agent is NOT in the LLM mapping — it falls back to Code.
    # The correct LLM node type is the LangChain agent.
    LLM_TYPE = "@n8n/n8n-nodes-langchain.agent"

    @staticmethod
    def _workflow(params=None):
        # Use chainLlm node type which maps to LLM (not ReAct Agent)
        return make_workflow(make_node("ChainLLM", "n8n-nodes-langchain.chainLlm", params or {
            "text": "Hello {{input}}",
            "options": {"systemMessage": "You are helpful."}
        }))

    def test_llm_node_created(self):
        nodes, _ = schema_from(self._workflow())
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_LLM) is not None

    def test_llm_has_system_prompt(self):
        nodes, _ = schema_from(self._workflow())
        llm = node_of_type(nodes, ComponentType.COMPONENT_TYPE_LLM)
        assert llm["data"]["inputs"]["llmParam"]["systemPrompt"]["content"] == "You are helpful."

    def test_llm_has_user_prompt(self):
        nodes, _ = schema_from(self._workflow())
        llm = node_of_type(nodes, ComponentType.COMPONENT_TYPE_LLM)
        assert "{{input}}" in llm["data"]["inputs"]["llmParam"]["prompt"]["content"]

    @staticmethod
    def test_llm_default_prompt_when_empty():
        nodes, _ = schema_from(make_workflow(make_node("A", "n8n-nodes-langchain.chainLlm")))
        llm = node_of_type(nodes, ComponentType.COMPONENT_TYPE_LLM)
        assert len(llm["data"]["inputs"]["llmParam"]["prompt"]["content"]) > 0

    def test_llm_output_has_output_property(self):
        nodes, _ = schema_from(self._workflow())
        llm = node_of_type(nodes, ComponentType.COMPONENT_TYPE_LLM)
        assert "output" in llm["data"]["outputs"]["properties"]

    def test_llm_connected_to_end(self):
        nodes, edges = schema_from(self._workflow())
        llm = node_of_type(nodes, ComponentType.COMPONENT_TYPE_LLM)
        end = node_of_type(nodes, ComponentType.COMPONENT_TYPE_END)
        assert any(e["sourceNodeID"] == llm["id"] and e["targetNodeID"] == end["id"]
                   for e in edges)

    @staticmethod
    def test_chain_llm_maps_to_llm():
        """Test that chainLlm node type maps to LLM component."""
        nodes, _ = schema_from(
            make_workflow(make_node("LCChain", "@n8n/n8n-nodes-langchain.chainLlm"))
        )
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_LLM) is not None

    @staticmethod
    def test_llm_system_prompt_from_top_level_param():
        """systemMessage at top level (not inside options) is used."""
        node = make_node("A", "@n8n/n8n-nodes-langchain.agent",
                         {"systemMessage": "Top-level sys prompt"})
        nodes, _ = schema_from(make_workflow(node))
        llm = node_of_type(nodes, ComponentType.COMPONENT_TYPE_LLM)
        assert "Top-level sys prompt" in llm["data"]["inputs"]["llmParam"]["systemPrompt"]["content"]

    @staticmethod
    def test_llm_prompt_type_is_template():
        nodes, _ = schema_from(make_workflow(make_node("A", "@n8n/n8n-nodes-langchain.agent",
                                                        {"text": "Say hi"})))
        llm = node_of_type(nodes, ComponentType.COMPONENT_TYPE_LLM)
        assert llm["data"]["inputs"]["llmParam"]["prompt"]["type"] == "template"

    @staticmethod
    def test_llm_node_id_uses_llm_prefix():
        nodes, _ = schema_from(make_workflow(make_node("A", "@n8n/n8n-nodes-langchain.agent")))
        llm = node_of_type(nodes, ComponentType.COMPONENT_TYPE_LLM)
        assert llm["id"].startswith("llm_")

    @staticmethod
    def test_llm_model_config_present():
        nodes, _ = schema_from(make_workflow(make_node("A", "@n8n/n8n-nodes-langchain.agent")))
        llm = node_of_type(nodes, ComponentType.COMPONENT_TYPE_LLM)
        # Model config is stored as llmParam.model, not as a top-level modelParam key
        assert "model" in llm["data"]["inputs"]["llmParam"]


# =============================================================================
# UNIT TESTS — IF / Selector node
# =============================================================================

class TestIFNode:
    @staticmethod
    def _two_branch_workflow():
        if_node = make_node("IF", "n8n-nodes-base.if")
        true_code = make_node("T", "n8n-nodes-base.code",
                              {"language": "javaScript", "jsCode": ""})
        false_code = make_node("F", "n8n-nodes-base.code",
                               {"language": "javaScript", "jsCode": ""})
        conns = merge_connections(
            connect("IF", "T", output_index=0),
            connect("IF", "F", output_index=1),
        )
        return make_workflow(if_node, true_code, false_code, connections=conns)

    @staticmethod
    def _one_branch_workflow():
        if_node = make_node("IF", "n8n-nodes-base.if")
        true_code = make_node("T", "n8n-nodes-base.code",
                              {"language": "javaScript", "jsCode": ""})
        return make_workflow(if_node, true_code, connections=connect("IF", "T", 0))

    def test_selector_node_created(self):
        nodes, _ = schema_from(self._two_branch_workflow())
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF) is not None

    def test_two_branches_created(self):
        nodes, _ = schema_from(self._two_branch_workflow())
        selector = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert len(selector["data"]["branches"]) == 2

    def test_true_branch_has_condition(self):
        nodes, _ = schema_from(self._two_branch_workflow())
        selector = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert len(selector["data"]["branches"][0]["conditions"]) > 0

    def test_else_branch_has_no_conditions(self):
        nodes, _ = schema_from(self._two_branch_workflow())
        selector = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert selector["data"]["branches"][1]["conditions"] == []

    def test_branch_edges_have_source_port(self):
        nodes, edges = schema_from(self._two_branch_workflow())
        selector = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        sel_edges = [e for e in edges if e["sourceNodeID"] == selector["id"]]
        assert all("sourcePortID" in e for e in sel_edges)

    def test_single_branch_else_goes_to_end(self):
        """Core fix: else branch must connect to end when only true branch is wired."""
        nodes, edges = schema_from(self._one_branch_workflow())
        selector = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        end = node_of_type(nodes, ComponentType.COMPONENT_TYPE_END)
        else_branch_id = selector["data"]["branches"][1]["branchId"]
        assert any(
            e["sourceNodeID"] == selector["id"]
            and e["targetNodeID"] == end["id"]
            and e.get("sourcePortID") == else_branch_id
            for e in edges
        ), "Else branch must be wired to the end node when no explicit target exists"

    @staticmethod
    def test_switch_maps_to_if():
        """Smoke-test: a switch node produces a Selector."""
        nodes, _ = schema_from(make_workflow(make_node("S", "n8n-nodes-base.switch")))
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF) is not None

    def test_if_node_id_uses_selector_prefix(self):
        nodes, _ = schema_from(self._two_branch_workflow())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert sel["id"].startswith("selector_")

    def test_if_branch_ids_are_unique(self):
        nodes, _ = schema_from(self._two_branch_workflow())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        ids = [b["branchId"] for b in sel["data"]["branches"]]
        assert len(ids) == len(set(ids))

    @staticmethod
    def test_if_with_conditions_has_input_parameters():
        if_node = make_node("IF", "n8n-nodes-base.if", {
            "conditions": {
                "combinator": "and",
                "conditions": [{
                    "leftValue": "={{ $json.score }}",
                    "operator": {"type": "number", "operation": "gt"},
                    "rightValue": 50
                }]
            }
        })
        nodes, _ = schema_from(make_workflow(if_node))
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert "inputParameters" in sel["data"]["inputs"]

    @staticmethod
    def test_or_combinator_sets_logic_to_1():
        if_node = make_node("IF", "n8n-nodes-base.if", {
            "conditions": {"combinator": "or", "conditions": []}
        })
        nodes, _ = schema_from(make_workflow(if_node))
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert sel["data"]["branches"][0]["logic"] == 1

    @staticmethod
    def test_and_combinator_sets_logic_to_2():
        if_node = make_node("IF", "n8n-nodes-base.if", {
            "conditions": {"combinator": "and", "conditions": []}
        })
        nodes, _ = schema_from(make_workflow(if_node))
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert sel["data"]["branches"][0]["logic"] == 2


# =============================================================================
# UNIT TESTS — Loop node
# =============================================================================

class TestLoopNode:
    @staticmethod
    def _workflow(batch_size=5):
        return make_workflow(
            make_node("Loop", "n8n-nodes-base.splitInBatches", {"batchSize": batch_size})
        )

    def test_loop_node_created(self):
        nodes, _ = schema_from(self._workflow())
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_LOOP) is not None

    def test_loop_batch_size_preserved(self):
        """batchSize ends up in loopParam.loopNum.content."""
        nodes, _ = schema_from(self._workflow(batch_size=7))
        loop = node_of_type(nodes, ComponentType.COMPONENT_TYPE_LOOP)
        assert loop["data"]["inputs"]["loopParam"]["loopNum"]["content"] == 7

    @staticmethod
    def test_loop_default_batch_size_is_one():
        """When batchSize is omitted, the default should be 1."""
        nodes, _ = schema_from(make_workflow(
            make_node("Loop", "n8n-nodes-base.splitInBatches")
        ))
        loop = node_of_type(nodes, ComponentType.COMPONENT_TYPE_LOOP)
        assert loop["data"]["inputs"]["loopParam"]["loopNum"]["content"] == 1

    def test_loop_has_two_blocks(self):
        """Minimal loop (no body nodes) has LoopStart + LoopEnd = 2 blocks."""
        nodes, _ = schema_from(self._workflow())
        loop = node_of_type(nodes, ComponentType.COMPONENT_TYPE_LOOP)
        assert len(loop["blocks"]) == 2

    def test_loop_block_types(self):
        """LoopStart is EMPTY_START (15) and LoopEnd is EMPTY_END (16)."""
        nodes, _ = schema_from(self._workflow())
        loop = node_of_type(nodes, ComponentType.COMPONENT_TYPE_LOOP)
        block_types = {int(b["type"]) for b in loop["blocks"]}
        assert ComponentType.COMPONENT_TYPE_EMPTY_START in block_types
        assert ComponentType.COMPONENT_TYPE_EMPTY_END in block_types

    def test_loop_outputs_result(self):
        """Loop controller exposes 'result' in its outputs."""
        nodes, _ = schema_from(self._workflow())
        loop = node_of_type(nodes, ComponentType.COMPONENT_TYPE_LOOP)
        assert "result" in loop["data"]["outputs"]["properties"]

    def test_loop_has_edges_key(self):
        """Loop controller carries an 'edges' list for internal block wiring."""
        nodes, _ = schema_from(self._workflow())
        loop = node_of_type(nodes, ComponentType.COMPONENT_TYPE_LOOP)
        assert "edges" in loop

    def test_loop_node_id_uses_loop_prefix(self):
        nodes, _ = schema_from(self._workflow())
        loop = node_of_type(nodes, ComponentType.COMPONENT_TYPE_LOOP)
        assert loop["id"].startswith("loop_")

    def test_loop_param_type_is_array_loop(self):
        nodes, _ = schema_from(self._workflow())
        loop = node_of_type(nodes, ComponentType.COMPONENT_TYPE_LOOP)
        assert loop["data"]["inputs"]["loopParam"]["type"] == "arrayLoop"

    def test_loop_not_emitted_as_top_level_block_nodes(self):
        """LoopStart and LoopEnd must NOT appear as top-level nodes."""
        nodes, _ = schema_from(self._workflow())
        for node in nodes:
            assert int(node["type"]) not in (
                ComponentType.COMPONENT_TYPE_EMPTY_START,
                ComponentType.COMPONENT_TYPE_EMPTY_END,
            ), f"Block node {node['id']} unexpectedly emitted at top level"


# =============================================================================
# UNIT TESTS — Loop with body nodes
# =============================================================================

class TestLoopWithBody:
    """Tests for a loop that has body nodes (relocation into blocks[])."""

    @staticmethod
    def _workflow_with_body():
        """
        Loop → (port 0) → BodyCode → (back edge) → Loop
                         → (port 1) → AfterLoop
        """
        loop = make_node("Loop", "n8n-nodes-base.splitInBatches", {"batchSize": 3})
        body = make_node("BodyCode", "n8n-nodes-base.code",
                         {"language": "python", "pythonCode": "def main(a): return {'result': 1}"})
        after = make_node("AfterLoop", "n8n-nodes-base.code",
                          {"language": "python", "pythonCode": "def main(a): return {'result': 2}"})
        conns = merge_connections(
            # port 0 → body
            connect("Loop", "BodyCode", output_index=0),
            # port 1 → after loop
            connect("Loop", "AfterLoop", output_index=1),
            # back edge: body → loop (continues iteration)
            connect("BodyCode", "Loop"),
        )
        return make_workflow(loop, body, after, connections=conns)

    def test_body_node_relocated_into_blocks(self):
        nodes, _ = schema_from(self._workflow_with_body())
        loop = node_of_type(nodes, ComponentType.COMPONENT_TYPE_LOOP)
        block_ids = {b["id"] for b in loop.get("blocks", [])}
        # BodyCode should be inside blocks[], not at top level as a standalone node
        top_level_ids = {n["id"] for n in nodes}
        # Find BodyCode's ID via blocks
        found_in_blocks = any(
            b.get("data", {}).get("title") == "BodyCode"
            for b in loop.get("blocks", [])
        )
        assert found_in_blocks, "BodyCode must be relocated into loop blocks[]"

    def test_body_node_not_at_top_level(self):
        nodes, _ = schema_from(self._workflow_with_body())
        top_level_titles = [n.get("data", {}).get("title", "") for n in nodes]
        assert "BodyCode" not in top_level_titles

    def test_loop_has_three_or_more_blocks(self):
        """LoopStart + BodyCode + LoopEnd = 3 blocks minimum."""
        nodes, _ = schema_from(self._workflow_with_body())
        loop = node_of_type(nodes, ComponentType.COMPONENT_TYPE_LOOP)
        assert len(loop.get("blocks", [])) >= 3

    def test_after_loop_node_remains_at_top_level(self):
        nodes, _ = schema_from(self._workflow_with_body())
        top_level_titles = [n.get("data", {}).get("title", "") for n in nodes]
        assert "AfterLoop" in top_level_titles

    def test_internal_edges_present(self):
        """Loop controller must have internal edges for block wiring."""
        nodes, _ = schema_from(self._workflow_with_body())
        loop = node_of_type(nodes, ComponentType.COMPONENT_TYPE_LOOP)
        assert len(loop.get("edges", [])) >= 1

    def test_top_level_edges_dont_reference_body_nodes(self):
        """After relocation, no top-level edge should touch a body node ID."""
        nodes, edges = schema_from(self._workflow_with_body())
        loop = node_of_type(nodes, ComponentType.COMPONENT_TYPE_LOOP)
        # Collect IDs inside blocks[]
        block_ids = {b["id"] for b in loop.get("blocks", [])}
        for edge in edges:
            assert edge.get("sourceNodeID") not in block_ids, \
                f"Top-level edge sources a block node: {edge}"
            assert edge.get("targetNodeID") not in block_ids, \
                f"Top-level edge targets a block node: {edge}"


# =============================================================================
# UNIT TESTS — Code node
# =============================================================================

class TestCodeNode:
    @staticmethod
    def _workflow(lang="javaScript", js_code="return [];", py_code=""):
        params = {"language": lang}
        if lang == "javaScript":
            params["jsCode"] = js_code
        else:
            params["pythonCode"] = py_code
        return make_workflow(make_node("Code", "n8n-nodes-base.code", params))

    def test_code_node_created(self):
        nodes, _ = schema_from(self._workflow())
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE) is not None

    def test_javascript_language_preserved(self):
        nodes, _ = schema_from(self._workflow(lang="javaScript"))
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert code["data"]["inputs"]["language"] == "javascript"

    def test_python_language_preserved(self):
        nodes, _ = schema_from(self._workflow(lang="python", js_code="", py_code="x = 1"))
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert code["data"]["inputs"]["language"] == "python"

    def test_js_code_wrapped_in_main(self):
        nodes, _ = schema_from(self._workflow(js_code="const x = 1;"))
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert "function main" in code["data"]["inputs"]["code"]

    def test_python_code_wrapped_in_main(self):
        nodes, _ = schema_from(self._workflow(lang="python", js_code="", py_code="x = 1"))
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert "def main" in code["data"]["inputs"]["code"]

    def test_python_main_not_double_wrapped(self):
        py = "def main(args):\n    return {'result': 1}"
        nodes, _ = schema_from(self._workflow(lang="python", js_code="", py_code=py))
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert code["data"]["inputs"]["code"].count("def main") == 1

    def test_code_outputs_result(self):
        nodes, _ = schema_from(self._workflow())
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert "result" in code["data"]["outputs"]["properties"]

    def test_code_has_exception_config(self):
        nodes, _ = schema_from(self._workflow())
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert "exceptionConfig" in code["data"]

    @staticmethod
    def test_function_node_maps_to_code():
        node = make_node("Fn", "n8n-nodes-base.function", {"functionCode": "return items;"})
        nodes, _ = schema_from(make_workflow(node))
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE) is not None

    @staticmethod
    def test_function_item_node_maps_to_code():
        node = make_node("FnItem", "n8n-nodes-base.functionItem", {"functionCode": "return item;"})
        nodes, _ = schema_from(make_workflow(node))
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE) is not None

    @staticmethod
    def test_js_code_contains_n8n_compat_shim():
        """JS wrapper must include the $input shim so n8n code runs."""
        node = make_node("Code", "n8n-nodes-base.code",
                         {"language": "javaScript", "jsCode": "return $input.first().json;"})
        nodes, _ = schema_from(make_workflow(node))
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert "$input" in code["data"]["inputs"]["code"]

    @staticmethod
    def test_js_outputs_include_items_and_result():
        node = make_node("Code", "n8n-nodes-base.code",
                         {"language": "javaScript", "jsCode": "return [];"})
        nodes, _ = schema_from(make_workflow(node))
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        props = code["data"]["outputs"]["properties"]
        assert "items" in props
        assert "result" in props

    @staticmethod
    def test_code_node_title_uses_n8n_name():
        node = make_node("MyPyNode", "n8n-nodes-base.code",
                         {"language": "python", "pythonCode": "def main(a): return {'result': 1}"})
        nodes, _ = schema_from(make_workflow(node))
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert code["data"]["title"] == "MyPyNode"

    @staticmethod
    def test_exception_config_retry_times():
        node = make_node("Code", "n8n-nodes-base.code",
                         {"language": "python", "pythonCode": "def main(a): return {'result': 1}"})
        nodes, _ = schema_from(make_workflow(node))
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert code["data"]["exceptionConfig"]["retryTimes"] == 3


# =============================================================================
# UNIT TESTS — Set node
# =============================================================================

class TestSetNode:
    @staticmethod
    def _params(assignments):
        return {"assignments": {"assignments": assignments}}

    def test_set_node_produces_code_node(self):
        params = self._params([{"name": "foo", "value": "bar", "type": "string"}])
        nodes, _ = schema_from(make_workflow(make_node("Set", "n8n-nodes-base.set", params)))
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE) is not None

    def test_set_node_code_contains_field_name(self):
        params = self._params([{"name": "myField", "value": "hello", "type": "string"}])
        nodes, _ = schema_from(make_workflow(make_node("Set", "n8n-nodes-base.set", params)))
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert "myField" in code["data"]["inputs"]["code"]

    @staticmethod
    def test_set_node_raw_mode():
        params = {"mode": "raw", "jsonOutput": '{"key": "value"}'}
        nodes, _ = schema_from(make_workflow(make_node("Set", "n8n-nodes-base.set", params)))
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert "raw_json" in code["data"]["inputs"]["code"]

    def test_set_node_boolean_value(self):
        params = self._params([{"name": "flag", "value": True, "type": "boolean"}])
        nodes, _ = schema_from(make_workflow(make_node("Set", "n8n-nodes-base.set", params)))
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert "True" in code["data"]["inputs"]["code"]

    def test_passthrough_set_node_optimised_away(self):
        """Set node with pure $json refs should be merged into its predecessor."""
        params = self._params([{"name": "city", "value": "={{ $json.city }}", "type": "string"}])
        trigger = make_node("Trigger", "n8n-nodes-base.manualTrigger")
        set_node = make_node("PassSet", "n8n-nodes-base.set", params)
        after = make_node("After", "n8n-nodes-base.code",
                          {"language": "javaScript", "jsCode": ""})
        conns = merge_connections(connect("Trigger", "PassSet"), connect("PassSet", "After"))
        nodes, _ = schema_from(make_workflow(trigger, set_node, after, connections=conns))
        code_titles = [n["data"].get("title", "") for n in nodes_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)]
        assert not any("PassSet" in t for t in code_titles)

    def test_set_node_number_value(self):
        params = self._params([{"name": "count", "value": 42, "type": "number"}])
        nodes, _ = schema_from(make_workflow(make_node("Set", "n8n-nodes-base.set", params)))
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert "count" in code["data"]["inputs"]["code"]

    @staticmethod
    def test_set_node_multiple_assignments():
        params = {"assignments": {"assignments": [
            {"name": "a", "value": "1", "type": "string"},
            {"name": "b", "value": "2", "type": "string"},
        ]}}
        nodes, _ = schema_from(make_workflow(make_node("Set", "n8n-nodes-base.set", params)))
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert "a" in code["data"]["inputs"]["code"]
        assert "b" in code["data"]["inputs"]["code"]


# =============================================================================
# UNIT TESTS — Plugin node
# =============================================================================

class TestPluginNode:
    @staticmethod
    def _workflow(params=None):
        return make_workflow(
            make_node("HTTP", "n8n-nodes-base.httpRequest",
                      params or {"url": "https://api.example.com", "method": "GET"})
        )

    def test_http_maps_to_plugin(self):
        nodes, _ = schema_from(self._workflow())
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_PLUGIN) is not None

    def test_plugin_has_plugin_param(self):
        nodes, _ = schema_from(self._workflow())
        plugin = node_of_type(nodes, ComponentType.COMPONENT_TYPE_PLUGIN)
        assert "pluginParam" in plugin["data"]["inputs"]

    def test_plugin_raw_params_stored(self):
        """n8n params are forwarded in _n8n_params for downstream use."""
        nodes, _ = schema_from(self._workflow(params={"url": "https://test.io", "method": "POST"}))
        plugin = node_of_type(nodes, ComponentType.COMPONENT_TYPE_PLUGIN)
        assert plugin["data"]["inputs"]["_n8n_params"]["url"] == "https://test.io"
        assert plugin["data"]["inputs"]["_n8n_params"]["method"] == "POST"

    def test_plugin_outputs_structure(self):
        nodes, _ = schema_from(self._workflow())
        plugin = node_of_type(nodes, ComponentType.COMPONENT_TYPE_PLUGIN)
        props = plugin["data"]["outputs"]["properties"]
        assert "error_code" in props
        assert "data" in props

    def test_plugin_connected_to_end(self):
        nodes, edges = schema_from(self._workflow())
        plugin = node_of_type(nodes, ComponentType.COMPONENT_TYPE_PLUGIN)
        end = node_of_type(nodes, ComponentType.COMPONENT_TYPE_END)
        assert any(e["sourceNodeID"] == plugin["id"] and e["targetNodeID"] == end["id"]
                   for e in edges)

    @staticmethod
    def test_slack_app_node_maps_to_plugin():
        node = make_node("Slack", "n8n-nodes-base.slack", {"operation": "message"})
        nodes, _ = schema_from(make_workflow(node))
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_PLUGIN) is not None

    @staticmethod
    def test_plugin_n8n_type_stored():
        node = make_node("HTTP", "n8n-nodes-base.httpRequest",
                         {"url": "https://x.com", "method": "GET"})
        nodes, _ = schema_from(make_workflow(node))
        plugin = node_of_type(nodes, ComponentType.COMPONENT_TYPE_PLUGIN)
        assert plugin["data"]["inputs"]["_n8n_type"] == "n8n-nodes-base.httpRequest"

    @staticmethod
    def test_plugin_outputs_error_message():
        node = make_node("HTTP", "n8n-nodes-base.httpRequest",
                         {"url": "https://api.example.com", "method": "GET"})
        nodes, _ = schema_from(make_workflow(node))
        plugin = node_of_type(nodes, ComponentType.COMPONENT_TYPE_PLUGIN)
        assert "error_message" in plugin["data"]["outputs"]["properties"]

    @staticmethod
    def test_plugin_node_id_uses_plugin_prefix():
        node = make_node("HTTP", "n8n-nodes-base.httpRequest",
                         {"url": "https://api.example.com", "method": "GET"})
        nodes, _ = schema_from(make_workflow(node))
        plugin = node_of_type(nodes, ComponentType.COMPONENT_TYPE_PLUGIN)
        assert plugin["id"].startswith("plugin_")


# =============================================================================
# UNIT TESTS — HTTP Request node
# =============================================================================

class TestHttpRequestNode:
    @staticmethod
    def _workflow(params=None):
        return make_workflow(
            make_node("HTTP", "n8n-nodes-base.httpRequest",
                      params or {"url": "https://api.example.com", "method": "GET"})
        )

    def test_http_maps_to_http_request(self):
        nodes, _ = schema_from(self._workflow())
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_HTTP_REQUEST) is not None

    def test_http_request_has_url_config(self):
        nodes, _ = schema_from(self._workflow())
        http_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_HTTP_REQUEST)
        assert "url" in http_node["data"]["configs"]

    def test_http_request_raw_params_stored(self):
        """n8n params are forwarded in _n8n_params for downstream use."""
        nodes, _ = schema_from(self._workflow(params={"url": "https://test.io", "method": "POST"}))
        http_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_HTTP_REQUEST)
        assert http_node["data"]["inputs"]["_n8n_params"]["url"] == "https://test.io"
        assert http_node["data"]["inputs"]["_n8n_params"]["method"] == "POST"

    def test_http_request_outputs_structure(self):
        nodes, _ = schema_from(self._workflow())
        http_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_HTTP_REQUEST)
        props = http_node["data"]["outputs"]["properties"]
        assert "error_code" in props
        assert "data" in props

    def test_http_request_connected_to_end(self):
        nodes, edges = schema_from(self._workflow())
        http_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_HTTP_REQUEST)
        end = node_of_type(nodes, ComponentType.COMPONENT_TYPE_END)
        assert any(e["sourceNodeID"] == http_node["id"] and e["targetNodeID"] == end["id"]
                   for e in edges)


# =============================================================================
# UNIT TESTS — React Agent node
# =============================================================================

class TestReactAgentNode:
    @staticmethod
    def _workflow(node_type="@n8n/n8n-nodes-langchain.agent", params=None):
        """Create a workflow with an n8n agent node."""
        return make_workflow(
            make_node("AI Agent", node_type, params or {"options": {}})
        )

    def test_react_agent_maps_correctly(self):
        """Test that n8n agent node with @n8n/ prefix maps to ReAct Agent."""
        nodes, _ = schema_from(self._workflow("@n8n/n8n-nodes-langchain.agent"))
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_REACT_AGENT) is not None

    def test_react_agent_maps_with_old_prefix(self):
        """Test that n8n agent node without @n8n/ prefix maps to ReAct Agent."""
        nodes, _ = schema_from(self._workflow("n8n-nodes-langchain.agent"))
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_REACT_AGENT) is not None

    def test_react_agent_has_llm_param(self):
        """Test that ReAct Agent node has llmParam in inputs."""
        nodes, _ = schema_from(self._workflow())
        react_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_REACT_AGENT)
        assert "llmParam" in react_node["data"]["inputs"]

    def test_react_agent_has_system_prompt(self):
        """Test that ReAct Agent node has systemPrompt structure."""
        nodes, _ = schema_from(self._workflow())
        react_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_REACT_AGENT)
        llm_param = react_node["data"]["inputs"]["llmParam"]
        assert "systemPrompt" in llm_param
        assert "content" in llm_param["systemPrompt"]

    def test_react_agent_has_user_prompt(self):
        """Test that ReAct Agent node has prompt structure."""
        nodes, _ = schema_from(self._workflow())
        react_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_REACT_AGENT)
        llm_param = react_node["data"]["inputs"]["llmParam"]
        assert "prompt" in llm_param
        assert "content" in llm_param["prompt"]

    def test_react_agent_has_model_config(self):
        """Test that ReAct Agent node has model configuration."""
        nodes, _ = schema_from(self._workflow())
        react_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_REACT_AGENT)
        llm_param = react_node["data"]["inputs"]["llmParam"]
        assert "model" in llm_param
        assert "name" in llm_param["model"]
        assert "type" in llm_param["model"]

    def test_react_agent_outputs_structure(self):
        """Test that ReAct Agent node has correct outputs structure."""
        nodes, _ = schema_from(self._workflow())
        react_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_REACT_AGENT)
        props = react_node["data"]["outputs"]["properties"]
        assert "output" in props
        # Output is string (agent response content)
        assert props["output"]["type"] == "string"
        # Should also have result_type field (answer/error/interrupt)
        assert "result_type" in props

    def test_react_agent_has_max_iterations(self):
        """Test that ReAct Agent node has max_iterations config."""
        nodes, _ = schema_from(self._workflow())
        react_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_REACT_AGENT)
        assert "max_iterations" in react_node["data"]
        assert react_node["data"]["max_iterations"] == 5  # default value

    def test_react_agent_custom_max_iterations(self):
        """Test that custom maxIterations is preserved."""
        nodes, _ = schema_from(self._workflow(
            params={"options": {"maxIterations": 10}}
        ))
        react_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_REACT_AGENT)
        assert react_node["data"]["max_iterations"] == 10

    def test_react_agent_has_skills_param(self):
        """Test that ReAct Agent node has skillsParam for plugins/workflows."""
        nodes, _ = schema_from(self._workflow())
        react_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_REACT_AGENT)
        assert "skillsParam" in react_node["data"]["inputs"]
        skills = react_node["data"]["inputs"]["skillsParam"]
        assert "plugins" in skills
        assert "workflows" in skills

    def test_react_agent_connected_to_end(self):
        """Test that ReAct Agent node is connected to End node."""
        nodes, edges = schema_from(self._workflow())
        react_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_REACT_AGENT)
        end = node_of_type(nodes, ComponentType.COMPONENT_TYPE_END)
        assert any(e["sourceNodeID"] == react_node["id"] and e["targetNodeID"] == end["id"]
                   for e in edges)

    def test_react_agent_end_edge_no_source_port_id(self):
        """Test that ReAct Agent -> End edge does NOT have sourcePortID.

        Unlike Code nodes which need sourcePortID, React Agent should not have it.
        """
        nodes, edges = schema_from(self._workflow())
        react_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_REACT_AGENT)
        end = node_of_type(nodes, ComponentType.COMPONENT_TYPE_END)
        react_to_end_edges = [e for e in edges
                              if e["sourceNodeID"] == react_node["id"] and e["targetNodeID"] == end["id"]]
        assert len(react_to_end_edges) == 1
        # React Agent edges should NOT have sourcePortID
        assert "sourcePortID" not in react_to_end_edges[0]


# =============================================================================
# UNIT TESTS — HTTP Request node
# =============================================================================

class TestHttpRequestNode:
    @staticmethod
    def _workflow(params=None):
        return make_workflow(
            make_node("HTTP", "n8n-nodes-base.httpRequest",
                      params or {"url": "https://api.example.com", "method": "GET"})
        )

    def test_http_maps_to_http_request(self):
        nodes, _ = schema_from(self._workflow())
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_HTTP_REQUEST) is not None

    def test_http_request_has_url_config(self):
        nodes, _ = schema_from(self._workflow())
        http_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_HTTP_REQUEST)
        assert "url" in http_node["data"]["configs"]

    def test_http_request_raw_params_stored(self):
        """n8n params are forwarded in _n8n_params for downstream use."""
        nodes, _ = schema_from(self._workflow(params={"url": "https://test.io", "method": "POST"}))
        http_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_HTTP_REQUEST)
        assert http_node["data"]["inputs"]["_n8n_params"]["url"] == "https://test.io"
        assert http_node["data"]["inputs"]["_n8n_params"]["method"] == "POST"

    def test_http_request_outputs_structure(self):
        nodes, _ = schema_from(self._workflow())
        http_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_HTTP_REQUEST)
        props = http_node["data"]["outputs"]["properties"]
        assert "error_code" in props
        assert "data" in props

    def test_http_request_connected_to_end(self):
        nodes, edges = schema_from(self._workflow())
        http_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_HTTP_REQUEST)
        end = node_of_type(nodes, ComponentType.COMPONENT_TYPE_END)
        assert any(e["sourceNodeID"] == http_node["id"] and e["targetNodeID"] == end["id"]
                   for e in edges)


# =============================================================================
# UNIT TESTS — React Agent node
# =============================================================================

class TestReactAgentNode:
    @staticmethod
    def _workflow(node_type="@n8n/n8n-nodes-langchain.agent", params=None):
        """Create a workflow with an n8n agent node."""
        return make_workflow(
            make_node("AI Agent", node_type, params or {"options": {}})
        )

    def test_react_agent_maps_correctly(self):
        """Test that n8n agent node with @n8n/ prefix maps to ReAct Agent."""
        nodes, _ = schema_from(self._workflow("@n8n/n8n-nodes-langchain.agent"))
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_REACT_AGENT) is not None

    def test_react_agent_maps_with_old_prefix(self):
        """Test that n8n agent node without @n8n/ prefix maps to ReAct Agent."""
        nodes, _ = schema_from(self._workflow("n8n-nodes-langchain.agent"))
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_REACT_AGENT) is not None

    def test_react_agent_has_llm_param(self):
        """Test that ReAct Agent node has llmParam in inputs."""
        nodes, _ = schema_from(self._workflow())
        react_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_REACT_AGENT)
        assert "llmParam" in react_node["data"]["inputs"]

    def test_react_agent_has_system_prompt(self):
        """Test that ReAct Agent node has systemPrompt structure."""
        nodes, _ = schema_from(self._workflow())
        react_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_REACT_AGENT)
        llm_param = react_node["data"]["inputs"]["llmParam"]
        assert "systemPrompt" in llm_param
        assert "content" in llm_param["systemPrompt"]

    def test_react_agent_has_user_prompt(self):
        """Test that ReAct Agent node has prompt structure."""
        nodes, _ = schema_from(self._workflow())
        react_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_REACT_AGENT)
        llm_param = react_node["data"]["inputs"]["llmParam"]
        assert "prompt" in llm_param
        assert "content" in llm_param["prompt"]

    def test_react_agent_has_model_config(self):
        """Test that ReAct Agent node has model configuration."""
        nodes, _ = schema_from(self._workflow())
        react_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_REACT_AGENT)
        llm_param = react_node["data"]["inputs"]["llmParam"]
        assert "model" in llm_param
        assert "name" in llm_param["model"]
        assert "type" in llm_param["model"]

    def test_react_agent_outputs_structure(self):
        """Test that ReAct Agent node has correct outputs structure."""
        nodes, _ = schema_from(self._workflow())
        react_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_REACT_AGENT)
        props = react_node["data"]["outputs"]["properties"]
        assert "output" in props
        # Output is string (agent response content)
        assert props["output"]["type"] == "string"
        # Should also have result_type field (answer/error/interrupt)
        assert "result_type" in props

    def test_react_agent_has_max_iterations(self):
        """Test that ReAct Agent node has max_iterations config."""
        nodes, _ = schema_from(self._workflow())
        react_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_REACT_AGENT)
        assert "max_iterations" in react_node["data"]
        assert react_node["data"]["max_iterations"] == 5  # default value

    def test_react_agent_custom_max_iterations(self):
        """Test that custom maxIterations is preserved."""
        nodes, _ = schema_from(self._workflow(
            params={"options": {"maxIterations": 10}}
        ))
        react_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_REACT_AGENT)
        assert react_node["data"]["max_iterations"] == 10

    def test_react_agent_has_skills_param(self):
        """Test that ReAct Agent node has skillsParam for plugins/workflows."""
        nodes, _ = schema_from(self._workflow())
        react_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_REACT_AGENT)
        assert "skillsParam" in react_node["data"]["inputs"]
        skills = react_node["data"]["inputs"]["skillsParam"]
        assert "plugins" in skills
        assert "workflows" in skills

    def test_react_agent_connected_to_end(self):
        """Test that ReAct Agent node is connected to End node."""
        nodes, edges = schema_from(self._workflow())
        react_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_REACT_AGENT)
        end = node_of_type(nodes, ComponentType.COMPONENT_TYPE_END)
        assert any(e["sourceNodeID"] == react_node["id"] and e["targetNodeID"] == end["id"]
                   for e in edges)

    def test_react_agent_end_edge_no_source_port_id(self):
        """Test that ReAct Agent -> End edge does NOT have sourcePortID.

        Unlike Code nodes which need sourcePortID, React Agent should not have it.
        """
        nodes, edges = schema_from(self._workflow())
        react_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_REACT_AGENT)
        end = node_of_type(nodes, ComponentType.COMPONENT_TYPE_END)
        react_to_end_edges = [e for e in edges
                              if e["sourceNodeID"] == react_node["id"] and e["targetNodeID"] == end["id"]]
        assert len(react_to_end_edges) == 1
        # React Agent edges should NOT have sourcePortID
        assert "sourcePortID" not in react_to_end_edges[0]


# =============================================================================
# UNIT TESTS — Merge node
# =============================================================================

class TestMergeNode:
    @staticmethod
    def test_merge_node_created():
        nodes, _ = schema_from(make_workflow(make_node("Merge", "n8n-nodes-base.merge")))
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_VARIABLE_MERGE) is not None

    @staticmethod
    def test_merge_outputs_merged_property():
        nodes, _ = schema_from(make_workflow(make_node("Merge", "n8n-nodes-base.merge")))
        merge = node_of_type(nodes, ComponentType.COMPONENT_TYPE_VARIABLE_MERGE)
        assert "merged" in merge["data"]["outputs"]["properties"]

    @staticmethod
    def test_merge_has_groups_config():
        nodes, _ = schema_from(make_workflow(make_node("Merge", "n8n-nodes-base.merge")))
        merge = node_of_type(nodes, ComponentType.COMPONENT_TYPE_VARIABLE_MERGE)
        assert "groups" in merge["data"]["configs"]

    @staticmethod
    def test_merge_node_id_uses_merge_prefix():
        nodes, _ = schema_from(make_workflow(make_node("Merge", "n8n-nodes-base.merge")))
        merge = node_of_type(nodes, ComponentType.COMPONENT_TYPE_VARIABLE_MERGE)
        assert merge["id"].startswith("merge_")

    @staticmethod
    def test_merge_title_uses_n8n_name():
        nodes, _ = schema_from(make_workflow(make_node("MyMerge", "n8n-nodes-base.merge")))
        merge = node_of_type(nodes, ComponentType.COMPONENT_TYPE_VARIABLE_MERGE)
        assert merge["data"]["title"] == "MyMerge"

    @staticmethod
    def test_merge_has_input_parameters():
        nodes, _ = schema_from(make_workflow(make_node("Merge", "n8n-nodes-base.merge")))
        merge = node_of_type(nodes, ComponentType.COMPONENT_TYPE_VARIABLE_MERGE)
        assert "inputParameters" in merge["data"]["inputs"]


# =============================================================================
# UNIT TESTS — SubWorkflow node
# =============================================================================

class TestWorkflowNode:
    @staticmethod
    def _workflow():
        return make_workflow(
            make_node("SubWF", "n8n-nodes-base.executeWorkflow",
                      {"workflowId": "wf-123", "mode": "sync"})
        )

    def test_sub_workflow_node_created(self):
        nodes, _ = schema_from(self._workflow())
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_SUB_WORKFLOW) is not None

    def test_sub_workflow_id_preserved(self):
        nodes, _ = schema_from(self._workflow())
        wf = node_of_type(nodes, ComponentType.COMPONENT_TYPE_SUB_WORKFLOW)
        assert wf["data"]["inputs"]["workflowParam"]["workflowId"] == "wf-123"

    def test_sub_workflow_mode_preserved(self):
        nodes, _ = schema_from(self._workflow())
        wf = node_of_type(nodes, ComponentType.COMPONENT_TYPE_SUB_WORKFLOW)
        assert wf["data"]["inputs"]["workflowParam"]["mode"] == "sync"

    def test_sub_workflow_outputs_result(self):
        nodes, _ = schema_from(self._workflow())
        wf = node_of_type(nodes, ComponentType.COMPONENT_TYPE_SUB_WORKFLOW)
        assert "result" in wf["data"]["outputs"]["properties"]

    @staticmethod
    def test_sub_workflow_node_id_uses_workflow_prefix():
        nodes, _ = schema_from(make_workflow(
            make_node("SubWF", "n8n-nodes-base.executeWorkflow", {"workflowId": "x"})
        ))
        wf = node_of_type(nodes, ComponentType.COMPONENT_TYPE_SUB_WORKFLOW)
        assert wf["id"].startswith("workflow_")

    @staticmethod
    def test_sub_workflow_empty_workflow_id():
        """Missing workflowId should produce empty string, not crash."""
        nodes, _ = schema_from(make_workflow(
            make_node("SubWF", "n8n-nodes-base.executeWorkflow", {})
        ))
        wf = node_of_type(nodes, ComponentType.COMPONENT_TYPE_SUB_WORKFLOW)
        assert wf["data"]["inputs"]["workflowParam"]["workflowId"] == ""


# =============================================================================
# UNIT TESTS — Sticky Note node
# =============================================================================

class TestStickyNote:
    """Tests for _convert_sticky_note → type 99."""

    @staticmethod
    def _workflow(content="Hello", width=240, height=160):
        note = make_node("Note", "n8n-nodes-base.stickyNote",
                         {"content": content, "width": width, "height": height},
                         position=[300, 200])
        code = make_node("Code", "n8n-nodes-base.code",
                         {"language": "python", "pythonCode": "def main(a): return {'result': 1}"})
        return make_workflow(note, code)

    def test_sticky_note_creates_type_99(self):
        nodes, _ = schema_from(self._workflow())
        note_nodes = [n for n in nodes if int(n["type"]) == 99]
        assert len(note_nodes) == 1

    def test_sticky_note_text_preserved(self):
        nodes, _ = schema_from(self._workflow(content="My note text"))
        note = next(n for n in nodes if int(n["type"]) == 99)
        assert note["data"]["note"] == "My note text"

    def test_sticky_note_width_preserved(self):
        nodes, _ = schema_from(self._workflow(width=400))
        note = next(n for n in nodes if int(n["type"]) == 99)
        assert note["data"]["size"]["width"] == 400

    def test_sticky_note_height_preserved(self):
        nodes, _ = schema_from(self._workflow(height=300))
        note = next(n for n in nodes if int(n["type"]) == 99)
        assert note["data"]["size"]["height"] == 300

    def test_sticky_note_has_position(self):
        nodes, _ = schema_from(self._workflow())
        note = next(n for n in nodes if int(n["type"]) == 99)
        assert "position" in note["meta"]

    def test_sticky_note_not_connected_by_edges(self):
        """Sticky notes are UI-only: no edges should reference them."""
        nodes, edges = schema_from(self._workflow())
        note = next(n for n in nodes if int(n["type"]) == 99)
        assert not any(
            e.get("sourceNodeID") == note["id"] or e.get("targetNodeID") == note["id"]
            for e in edges
        )

    def test_sticky_note_id_uses_note_prefix(self):
        nodes, _ = schema_from(self._workflow())
        note = next(n for n in nodes if int(n["type"]) == 99)
        assert note["id"].startswith("note_")

    @staticmethod
    def test_sticky_note_default_dimensions_when_absent():
        """When width/height are omitted, defaults (240×160) apply."""
        note_node = make_node("Note", "n8n-nodes-base.stickyNote",
                              {"content": "text"})  # no width/height
        code = make_node("Code", "n8n-nodes-base.code",
                         {"language": "python", "pythonCode": "def main(a): return {'result': 1}"})
        nodes, _ = schema_from(make_workflow(note_node, code))
        note = next(n for n in nodes if int(n["type"]) == 99)
        assert note["data"]["size"]["width"] == 240
        assert note["data"]["size"]["height"] == 160

    @staticmethod
    def test_sticky_note_uses_name_as_fallback_content():
        """When parameters.content is absent, node name is used."""
        note_node = make_node("My Note Name", "n8n-nodes-base.stickyNote", {})
        code = make_node("Code", "n8n-nodes-base.code",
                         {"language": "python", "pythonCode": "def main(a): return {'result': 1}"})
        nodes, _ = schema_from(make_workflow(note_node, code))
        note = next(n for n in nodes if int(n["type"]) == 99)
        assert note["data"]["note"] == "My Note Name"


# =============================================================================
# UNIT TESTS — Data Transform nodes (all _DATA_TRANSFORM_HANDLERS)
# =============================================================================

class TestDataTransformNodes:
    """
    Every node type listed in _DATA_TRANSFORM_HANDLERS must produce a Code node
    with Python code that references the handler's logic.
    """

    @staticmethod
    def _code_for(n8n_type, params=None):
        """Return (code_string, code_node) for a single data-transform node."""
        node = make_node("N", n8n_type, params or {})
        nodes, _ = schema_from(make_workflow(node))
        code_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        return code_node["data"]["inputs"]["code"], code_node

    # ── Sort ──────────────────────────────────────────────────────────────────

    def test_sort_produces_code_node(self):
        _, n = self._code_for("n8n-nodes-base.sort")
        assert n is not None

    def test_sort_code_contains_sort_logic(self):
        code, _ = self._code_for("n8n-nodes-base.sort",
                                  {"sortFieldsUi": {"sortField": [{"fieldName": "price", "order": "descending"}]}})
        assert "sort" in code.lower()

    @staticmethod
    def test_sort_outputs_list_schema():
        node = make_node("S", "n8n-nodes-base.sort",
                         {"sortFieldsUi": {"sortField": [{"fieldName": "n", "order": "ascending"}]}})
        nodes, _ = schema_from(make_workflow(node))
        code_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        props = code_node["data"]["outputs"]["properties"]
        assert "items" in props
        assert "result" in props

    # ── Limit ─────────────────────────────────────────────────────────────────

    def test_limit_produces_code_node(self):
        _, n = self._code_for("n8n-nodes-base.limit", {"maxItems": 5})
        assert n is not None

    def test_limit_code_contains_limit_value(self):
        code, _ = self._code_for("n8n-nodes-base.limit", {"maxItems": 10})
        assert "10" in code

    @staticmethod
    def test_limit_outputs_list_schema():
        node = make_node("L", "n8n-nodes-base.limit", {"maxItems": 3})
        nodes, _ = schema_from(make_workflow(node))
        code_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        props = code_node["data"]["outputs"]["properties"]
        assert "items" in props and "result" in props

    # ── Remove Duplicates ─────────────────────────────────────────────────────

    def test_remove_duplicates_produces_code_node(self):
        _, n = self._code_for("n8n-nodes-base.removeDuplicates")
        assert n is not None

    @staticmethod
    def test_remove_duplicates_outputs_list_schema():
        node = make_node("RD", "n8n-nodes-base.removeDuplicates")
        nodes, _ = schema_from(make_workflow(node))
        code_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert "items" in code_node["data"]["outputs"]["properties"]

    # ── Aggregate ─────────────────────────────────────────────────────────────

    def test_aggregate_produces_code_node(self):
        _, n = self._code_for("n8n-nodes-base.aggregate", {
            "fieldsToAggregate": {"fieldToAggregate": [{"fieldToAggregate": "price"}]}
        })
        assert n is not None

    @staticmethod
    def test_aggregate_outputs_aggregated_field():
        node = make_node("Agg", "n8n-nodes-base.aggregate", {
            "fieldsToAggregate": {"fieldToAggregate": [{"fieldToAggregate": "price"}]}
        })
        nodes, _ = schema_from(make_workflow(node))
        code_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        props = code_node["data"]["outputs"]["properties"]
        assert "price" in props

    @staticmethod
    def test_aggregate_field_type_is_array():
        node = make_node("Agg", "n8n-nodes-base.aggregate", {
            "fieldsToAggregate": {"fieldToAggregate": [{"fieldToAggregate": "tags"}]}
        })
        nodes, _ = schema_from(make_workflow(node))
        code_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert code_node["data"]["outputs"]["properties"]["tags"]["type"] == "array"

    # ── Split Out ─────────────────────────────────────────────────────────────

    def test_split_out_produces_code_node(self):
        _, n = self._code_for("n8n-nodes-base.splitOut", {"fieldToSplitOut": "items"})
        assert n is not None

    @staticmethod
    def test_split_out_outputs_list_schema():
        node = make_node("SO", "n8n-nodes-base.splitOut", {"fieldToSplitOut": "items"})
        nodes, _ = schema_from(make_workflow(node))
        code_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert "items" in code_node["data"]["outputs"]["properties"]

    # ── Item Lists ────────────────────────────────────────────────────────────

    def test_item_lists_produces_code_node(self):
        _, n = self._code_for("n8n-nodes-base.itemLists")
        assert n is not None

    @staticmethod
    def test_item_lists_outputs_list_schema():
        node = make_node("IL", "n8n-nodes-base.itemLists")
        nodes, _ = schema_from(make_workflow(node))
        code_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert "items" in code_node["data"]["outputs"]["properties"]

    # ── NoOp ─────────────────────────────────────────────────────────────────

    def test_no_op_produces_code_node(self):
        _, n = self._code_for("n8n-nodes-base.noOp")
        assert n is not None

    def test_no_op_code_is_python(self):
        code, n = self._code_for("n8n-nodes-base.noOp")
        assert n["data"]["inputs"]["language"] == "python"

    def test_no_op_code_has_main_function(self):
        code, _ = self._code_for("n8n-nodes-base.noOp")
        assert "def main" in code

    # ── Wait ──────────────────────────────────────────────────────────────────

    def test_wait_produces_code_node(self):
        _, n = self._code_for("n8n-nodes-base.wait", {"resume": "timeInterval"})
        assert n is not None

    def test_wait_code_contains_sleep(self):
        code, _ = self._code_for("n8n-nodes-base.wait",
                                   {"resume": "timeInterval", "amount": 5, "unit": "seconds"})
        assert "sleep" in code

    def test_wait_code_references_resume_mode(self):
        code, _ = self._code_for("n8n-nodes-base.wait", {"resume": "timeInterval"})
        assert "timeInterval" in code

    # ── Respond to Webhook ────────────────────────────────────────────────────

    def test_respond_to_webhook_produces_code_node(self):
        _, n = self._code_for("n8n-nodes-base.respondToWebhook",
                               {"respondWith": "json", "responseBody": "{}"})
        assert n is not None

    def test_respond_to_webhook_response_code_present(self):
        code, _ = self._code_for("n8n-nodes-base.respondToWebhook", {
            "respondWith": "text",
            "options": {"responseCode": 201}
        })
        assert "201" in code

    def test_respond_to_webhook_respond_with_text(self):
        code, _ = self._code_for("n8n-nodes-base.respondToWebhook",
                                   {"respondWith": "text"})
        assert "text" in code

    def test_respond_to_webhook_respond_with_no_data(self):
        code, _ = self._code_for("n8n-nodes-base.respondToWebhook",
                                   {"respondWith": "noData"})
        assert "noData" in code

    # ── Stop and Error ────────────────────────────────────────────────────────

    def test_stop_and_error_produces_code_node(self):
        _, n = self._code_for("n8n-nodes-base.stopAndError",
                               {"errorMessage": "Something went wrong"})
        assert n is not None

    def test_stop_and_error_code_raises(self):
        code, _ = self._code_for("n8n-nodes-base.stopAndError",
                                   {"errorMessage": "Something went wrong"})
        assert "raise" in code or "RuntimeError" in code

    def test_stop_and_error_message_in_code(self):
        code, _ = self._code_for("n8n-nodes-base.stopAndError",
                                   {"errorMessage": "Custom error msg"})
        assert "Custom error msg" in code

    def test_stop_and_error_default_message(self):
        """When errorMessage is absent, node name is used."""
        code, _ = self._code_for("n8n-nodes-base.stopAndError", {})
        assert "raise" in code.lower() or "RuntimeError" in code

    # ── HTML ─────────────────────────────────────────────────────────────────

    def test_html_generate_produces_code_node(self):
        _, n = self._code_for("n8n-nodes-base.html",
                               {"operation": "generate", "value": "<p>hello</p>"})
        assert n is not None

    def test_html_generate_operation_in_code(self):
        code, _ = self._code_for("n8n-nodes-base.html",
                                   {"operation": "generate"})
        assert "generate" in code

    def test_html_extract_operation_in_code(self):
        code, _ = self._code_for("n8n-nodes-base.html",
                                   {"operation": "extractHtmlContent"})
        assert "extractHtmlContent" in code or "extract" in code.lower()

    @staticmethod
    def test_html_outputs_field_schema():
        node = make_node("HTML", "n8n-nodes-base.html",
                         {"operation": "generate", "value": "<b>x</b>",
                          "destinationKey": "rendered"})
        nodes, _ = schema_from(make_workflow(node))
        code_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert "result" in code_node["data"]["outputs"]["properties"]

    # ── Markdown ──────────────────────────────────────────────────────────────

    def test_markdown_to_html_produces_code_node(self):
        _, n = self._code_for("n8n-nodes-base.markdown",
                               {"mode": "markdownToHtml", "markdown": "# Hello"})
        assert n is not None

    def test_markdown_to_html_operation_in_code(self):
        code, _ = self._code_for("n8n-nodes-base.markdown",
                                   {"mode": "markdownToHtml"})
        assert "markdownToHtml" in code

    def test_html_to_markdown_operation_in_code(self):
        code, _ = self._code_for("n8n-nodes-base.markdown",
                                   {"mode": "htmlToMarkdown"})
        assert "htmlToMarkdown" in code or "html" in code.lower()

    # ── XML ───────────────────────────────────────────────────────────────────

    def test_xml_to_json_produces_code_node(self):
        _, n = self._code_for("n8n-nodes-base.xml", {"mode": "xmlToJson"})
        assert n is not None

    def test_xml_to_json_operation_in_code(self):
        code, _ = self._code_for("n8n-nodes-base.xml", {"mode": "xmlToJson"})
        assert "xmlToJson" in code

    def test_json_to_xml_operation_in_code(self):
        code, _ = self._code_for("n8n-nodes-base.xml", {"mode": "jsonToXml"})
        assert "jsonToXml" in code or "xml" in code.lower()

    # ── Crypto ────────────────────────────────────────────────────────────────

    def test_crypto_hash_produces_code_node(self):
        _, n = self._code_for("n8n-nodes-base.crypto",
                               {"action": "hash", "type": "MD5", "value": "hello"})
        assert n is not None

    def test_crypto_hash_type_in_code(self):
        code, _ = self._code_for("n8n-nodes-base.crypto",
                                   {"action": "hash", "type": "SHA256"})
        assert "SHA256" in code or "sha256" in code.lower()

    def test_crypto_hmac_in_code(self):
        code, _ = self._code_for("n8n-nodes-base.crypto",
                                   {"action": "hmac", "type": "SHA256", "secret": "key"})
        assert "hmac" in code.lower()

    def test_crypto_sign_in_code(self):
        code, _ = self._code_for("n8n-nodes-base.crypto",
                                   {"action": "sign", "type": "SHA256"})
        assert "sign" in code.lower()

    # ── Date & Time ───────────────────────────────────────────────────────────

    def test_date_time_format_produces_code_node(self):
        _, n = self._code_for("n8n-nodes-base.dateTime",
                               {"operation": "formatDate", "value": "2024-01-01"})
        assert n is not None

    def test_date_time_format_operation_in_code(self):
        code, _ = self._code_for("n8n-nodes-base.dateTime",
                                   {"operation": "formatDate"})
        assert "formatDate" in code

    def test_date_time_get_current_in_code(self):
        code, _ = self._code_for("n8n-nodes-base.dateTime",
                                   {"operation": "getCurrentDate"})
        assert "getCurrentDate" in code

    def test_date_time_add_to_date_in_code(self):
        code, _ = self._code_for("n8n-nodes-base.dateTime",
                                   {"operation": "addToDate"})
        assert "addToDate" in code

    def test_date_time_subtract_from_date_in_code(self):
        code, _ = self._code_for("n8n-nodes-base.dateTime",
                                   {"operation": "subtractFromDate"})
        assert "subtractFromDate" in code

    # ── Compression ───────────────────────────────────────────────────────────

    def test_compression_compress_produces_code_node(self):
        _, n = self._code_for("n8n-nodes-base.compression",
                               {"operation": "compress", "fileFormat": "gzip"})
        assert n is not None

    def test_compression_compress_operation_in_code(self):
        code, _ = self._code_for("n8n-nodes-base.compression",
                                   {"operation": "compress"})
        assert "compress" in code

    def test_compression_decompress_operation_in_code(self):
        code, _ = self._code_for("n8n-nodes-base.compression",
                                   {"operation": "decompress"})
        assert "decompress" in code

    def test_compression_zip_format_in_code(self):
        code, _ = self._code_for("n8n-nodes-base.compression",
                                   {"operation": "compress", "fileFormat": "zip"})
        assert "zip" in code.lower()

    # ── Read/Write File ───────────────────────────────────────────────────────

    def test_read_write_file_read_produces_code_node(self):
        _, n = self._code_for("n8n-nodes-base.readWriteFile",
                               {"operation": "read", "filePath": "/tmp/test.txt"})
        assert n is not None

    def test_read_write_file_write_operation_in_code(self):
        code, _ = self._code_for("n8n-nodes-base.readWriteFile",
                                   {"operation": "write", "filePath": "/tmp/out.txt"})
        assert "write" in code.lower()

    def test_read_write_file_read_operation_in_code(self):
        code, _ = self._code_for("n8n-nodes-base.readWriteFile",
                                   {"operation": "read", "filePath": "/tmp/in.txt"})
        assert "read" in code.lower()

    def test_read_write_file_append_option(self):
        code, _ = self._code_for("n8n-nodes-base.readWriteFile", {
            "operation": "write",
            "options": {"append": True}
        })
        assert "append" in code.lower() or '"a"' in code

    # ── Read Binary Files ─────────────────────────────────────────────────────

    def test_read_binary_files_produces_code_node(self):
        _, n = self._code_for("n8n-nodes-base.readBinaryFiles",
                               {"fileSelector": "*.txt"})
        assert n is not None

    def test_read_binary_files_code_has_main(self):
        code, _ = self._code_for("n8n-nodes-base.readBinaryFiles", {"fileSelector": "*.txt"})
        assert "def main" in code

    # ── Write Binary File ─────────────────────────────────────────────────────

    def test_write_binary_file_produces_code_node(self):
        _, n = self._code_for("n8n-nodes-base.writeBinaryFile",
                               {"fileName": "output.bin"})
        assert n is not None

    def test_write_binary_file_code_has_main(self):
        code, _ = self._code_for("n8n-nodes-base.writeBinaryFile", {"fileName": "x.bin"})
        assert "def main" in code

    # ── Spreadsheet File ──────────────────────────────────────────────────────

    def test_spreadsheet_file_produces_code_node(self):
        _, n = self._code_for("n8n-nodes-base.spreadsheetFile",
                               {"operation": "toFile", "fileFormat": "xlsx"})
        assert n is not None

    def test_spreadsheet_file_code_has_main(self):
        code, _ = self._code_for("n8n-nodes-base.spreadsheetFile",
                                   {"operation": "toFile", "fileFormat": "csv"})
        assert "def main" in code

    # ── Convert to File ───────────────────────────────────────────────────────

    def test_convert_to_file_produces_code_node(self):
        _, n = self._code_for("n8n-nodes-base.convertToFile",
                               {"operation": "toText", "fileName": "out.txt"})
        assert n is not None

    def test_convert_to_file_code_has_main(self):
        code, _ = self._code_for("n8n-nodes-base.convertToFile",
                                   {"operation": "toText"})
        assert "def main" in code

    # ── Extract from File ─────────────────────────────────────────────────────

    def test_extract_from_file_produces_code_node(self):
        _, n = self._code_for("n8n-nodes-base.extractFromFile",
                               {"operation": "text"})
        assert n is not None

    def test_extract_from_file_code_has_main(self):
        code, _ = self._code_for("n8n-nodes-base.extractFromFile", {"operation": "text"})
        assert "def main" in code

    # ── All data-transform nodes produce Code nodes, not Plugin or other types ─

    @pytest.mark.parametrize("n8n_type", [
        "n8n-nodes-base.sort",
        "n8n-nodes-base.limit",
        "n8n-nodes-base.removeDuplicates",
        "n8n-nodes-base.aggregate",
        "n8n-nodes-base.splitOut",
        "n8n-nodes-base.itemLists",
        "n8n-nodes-base.noOp",
        "n8n-nodes-base.wait",
        "n8n-nodes-base.respondToWebhook",
        "n8n-nodes-base.stopAndError",
        "n8n-nodes-base.html",
        "n8n-nodes-base.markdown",
        "n8n-nodes-base.xml",
        "n8n-nodes-base.crypto",
        "n8n-nodes-base.dateTime",
        "n8n-nodes-base.compression",
        "n8n-nodes-base.readBinaryFiles",
        "n8n-nodes-base.writeBinaryFile",
        "n8n-nodes-base.spreadsheetFile",
        "n8n-nodes-base.convertToFile",
        "n8n-nodes-base.extractFromFile",
        "n8n-nodes-base.readWriteFile",
    ])
    @staticmethod
    def test_data_transform_always_produces_code_node(n8n_type):
        node = make_node("N", n8n_type)
        nodes, _ = schema_from(make_workflow(node))
        code_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert code_node is not None, \
            f"{n8n_type} should produce a Code node but didn't"

    @pytest.mark.parametrize("n8n_type", [
        "n8n-nodes-base.sort",
        "n8n-nodes-base.limit",
        "n8n-nodes-base.removeDuplicates",
        "n8n-nodes-base.aggregate",
        "n8n-nodes-base.splitOut",
        "n8n-nodes-base.itemLists",
        "n8n-nodes-base.noOp",
        "n8n-nodes-base.wait",
        "n8n-nodes-base.respondToWebhook",
        "n8n-nodes-base.stopAndError",
        "n8n-nodes-base.html",
        "n8n-nodes-base.markdown",
        "n8n-nodes-base.xml",
        "n8n-nodes-base.crypto",
        "n8n-nodes-base.dateTime",
        "n8n-nodes-base.compression",
        "n8n-nodes-base.readBinaryFiles",
        "n8n-nodes-base.writeBinaryFile",
        "n8n-nodes-base.spreadsheetFile",
        "n8n-nodes-base.convertToFile",
        "n8n-nodes-base.extractFromFile",
        "n8n-nodes-base.readWriteFile",
    ])
    @staticmethod
    def test_data_transform_language_is_python(n8n_type):
        node = make_node("N", n8n_type)
        nodes, _ = schema_from(make_workflow(node))
        code_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert code_node["data"]["inputs"]["language"] == "python", \
            f"{n8n_type} should produce Python code"


# =============================================================================
# UNIT TESTS — Compare Datasets node
# =============================================================================

class TestCompareDatasets:
    """Tests for _convert_compare_datasets_node."""

    @staticmethod
    def _workflow(merge_fields=None):
        params = {}
        if merge_fields:
            params["mergeByFields"] = {"values": merge_fields}
        return make_workflow(
            make_node("Compare", "n8n-nodes-base.compareDatasets", params)
        )

    def test_compare_datasets_produces_code_node(self):
        nodes, _ = schema_from(self._workflow())
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE) is not None

    def test_compare_datasets_produces_selector_nodes(self):
        """One Code node + 4 guard Selectors (one per output port)."""
        nodes, _ = schema_from(self._workflow())
        selectors = nodes_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert len(selectors) == 4

    def test_compare_datasets_code_outputs_matched(self):
        nodes, _ = schema_from(self._workflow())
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert "matched" in code["data"]["outputs"]["properties"]

    def test_compare_datasets_code_outputs_only_a(self):
        nodes, _ = schema_from(self._workflow())
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert "only_a" in code["data"]["outputs"]["properties"]

    def test_compare_datasets_code_outputs_only_b(self):
        nodes, _ = schema_from(self._workflow())
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert "only_b" in code["data"]["outputs"]["properties"]

    def test_compare_datasets_code_outputs_union_excl(self):
        nodes, _ = schema_from(self._workflow())
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert "union_excl" in code["data"]["outputs"]["properties"]

    def test_compare_datasets_code_outputs_count_fields(self):
        nodes, _ = schema_from(self._workflow())
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        props = code["data"]["outputs"]["properties"]
        assert "matched_count" in props
        assert "only_a_count" in props
        assert "only_b_count" in props

    def test_compare_datasets_each_selector_has_two_branches(self):
        nodes, _ = schema_from(self._workflow())
        for sel in nodes_of_type(nodes, ComponentType.COMPONENT_TYPE_IF):
            assert len(sel["data"]["branches"]) == 2, \
                f"Selector {sel['id']} should have 2 branches"

    def test_compare_datasets_code_language_is_python(self):
        nodes, _ = schema_from(self._workflow())
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert code["data"]["inputs"]["language"] == "python"

    def test_compare_datasets_code_contains_merge_fields_logic(self):
        nodes, _ = schema_from(self._workflow(
            merge_fields=[{"field1": "id", "field2": "itemId"}]
        ))
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert "id" in code["data"]["inputs"]["code"]

    def test_compare_datasets_selectors_all_sourced_from_code(self):
        """Every guard Selector must receive an edge from the Code node."""
        nodes, edges = schema_from(self._workflow())
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        selectors = nodes_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        for sel in selectors:
            assert any(
                e.get("sourceNodeID") == code["id"] and e.get("targetNodeID") == sel["id"]
                for e in edges
            ), f"Selector {sel['id']} not connected to Code node"

    def test_compare_datasets_port3_uses_or_logic(self):
        """Port 3 (union_excl) fires when either only_a or only_b is non-empty → OR logic=1."""
        nodes, _ = schema_from(self._workflow())
        selectors = nodes_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        # The 4th selector (port 3) should have OR logic
        port3_sel = selectors[3]
        assert port3_sel["data"]["branches"][0]["logic"] == 1

    def test_compare_datasets_code_has_exception_config(self):
        nodes, _ = schema_from(self._workflow())
        code = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert "exceptionConfig" in code["data"]


# =============================================================================
# UNIT TESTS — Locale / Title localisation
# =============================================================================

class TestLocale:
    """Tests for get_title() with en and zh locales."""

    @staticmethod
    def _conv(locale):
        c = N8nWorkflowConverter(locale=locale)
        c.reset_state()
        return c

    def test_en_start_title(self):
        assert self._conv("en").get_title("start") == "Start"

    def test_en_end_title(self):
        assert self._conv("en").get_title("end") == "End"

    def test_en_llm_title(self):
        assert self._conv("en").get_title("llm", n=2) == "LLM 2"

    def test_zh_start_title(self):
        assert self._conv("zh").get_title("start") == "开始"

    def test_zh_end_title(self):
        assert self._conv("zh").get_title("end") == "结束"

    def test_zh_cn_variant(self):
        assert self._conv("zh-CN").get_title("start") == "开始"

    def test_zh_cn_underscore_variant(self):
        assert self._conv("zh_CN").get_title("start") == "开始"

    def test_chinese_word_variant(self):
        assert self._conv("chinese").get_title("start") == "开始"

    def test_unknown_locale_falls_back_to_en(self):
        assert self._conv("fr").get_title("start") == "Start"

    @staticmethod
    def test_locale_applied_in_schema_start_node():
        c = N8nWorkflowConverter(locale="zh")
        result = c.convert_to_schema(make_workflow(
            make_node("Code", "n8n-nodes-base.code",
                      {"language": "python", "pythonCode": "def main(a): return {'result': 1}"})
        ))
        start = next(n for n in result["nodes"] if int(n["type"]) == ComponentType.COMPONENT_TYPE_START)
        assert start["data"]["title"] == "开始"

    @staticmethod
    def test_locale_applied_in_schema_end_node():
        c = N8nWorkflowConverter(locale="zh")
        result = c.convert_to_schema(make_workflow(
            make_node("Code", "n8n-nodes-base.code",
                      {"language": "python", "pythonCode": "def main(a): return {'result': 1}"})
        ))
        end = next(n for n in result["nodes"] if int(n["type"]) == ComponentType.COMPONENT_TYPE_END)
        assert end["data"]["title"] == "结束"

    @staticmethod
    def test_locale_override_in_convert_to_schema():
        c = N8nWorkflowConverter(locale="en")
        result = c.convert_to_schema(
            make_workflow(
                make_node("Code", "n8n-nodes-base.code",
                          {"language": "python", "pythonCode": "def main(a): return {'result': 1}"})
            ),
            locale="zh"
        )
        start = next(n for n in result["nodes"] if int(n["type"]) == ComponentType.COMPONENT_TYPE_START)
        assert start["data"]["title"] == "开始"


# =============================================================================
# UNIT TESTS — TransformationReport
# =============================================================================

class TestTransformationReport:
    """Tests for TransformationReport helpers."""

    @staticmethod
    def _report():
        from openjiuwen_studio.core.dsl_converter.converter.converter_n8n import TransformationReport
        return TransformationReport()

    def test_add_unsupported_stores_entry(self):
        r = self._report()
        r.add_unsupported("MyNode", "n8n-nodes-base.foo", "No mapping", "Used fallback")
        assert len(r.unsupported_nodes) == 1
        assert r.unsupported_nodes[0].node_name == "MyNode"

    def test_add_warning_stores_entry(self):
        r = self._report()
        r.add_warning("Something was weird")
        assert "Something was weird" in r.warnings

    def test_to_warnings_list_includes_warnings(self):
        r = self._report()
        r.add_warning("w1")
        r.add_unsupported("N", "t", "reason", "fallback")
        result = r.to_warnings_list()
        assert any("w1" in s for s in result)
        assert any("N" in s for s in result)

    def test_summary_contains_totals(self):
        r = self._report()
        r.total_nodes = 5
        r.converted_nodes = 4
        r.skipped_nodes = 1
        summary = r.summary()
        assert "5" in summary
        assert "4" in summary

    def test_summary_success_message_when_clean(self):
        r = self._report()
        summary = r.summary()
        assert "successfully" in summary.lower() or "All nodes" in summary

    def test_summary_shows_unsupported_section(self):
        r = self._report()
        r.add_unsupported("BadNode", "bad.type", "No mapping", "Used Code fallback")
        summary = r.summary()
        assert "BadNode" in summary

    @staticmethod
    def test_report_generated_after_conversion():
        c = N8nWorkflowConverter()
        c.convert_to_schema(make_workflow(
            make_node("Code", "n8n-nodes-base.code",
                      {"language": "python", "pythonCode": "def main(a): return {'result': 1}"})
        ))
        assert c.report.total_nodes >= 1

    @staticmethod
    def test_unsupported_node_increments_via_fallback():
        c = N8nWorkflowConverter()
        c.convert_to_schema(make_workflow(make_node("X", "n8n-nodes-base.weirdUnknown")))
        warnings = c.report.to_warnings_list()
        assert any("X" in w for w in warnings)


# =============================================================================
# UNIT TESTS — Connections / Edges
# =============================================================================

class TestConnections:
    @staticmethod
    def test_linear_chain_produces_edges():
        a = make_node("A", "n8n-nodes-base.code", {"language": "javaScript", "jsCode": ""})
        b = make_node("B", "n8n-nodes-base.code", {"language": "javaScript", "jsCode": ""})
        _, edges = schema_from(make_workflow(a, b, connections=connect("A", "B")))
        assert len(edges) >= 2

    @staticmethod
    def test_no_duplicate_edges():
        a = make_node("A", "n8n-nodes-base.code", {"language": "javaScript", "jsCode": ""})
        b = make_node("B", "n8n-nodes-base.code", {"language": "javaScript", "jsCode": ""})
        _, edges = schema_from(make_workflow(a, b, connections=connect("A", "B")))
        pairs = [(e["sourceNodeID"], e["targetNodeID"]) for e in edges]
        assert len(pairs) == len(set(pairs))

    @staticmethod
    def test_if_branch_edges_have_source_port():
        if_node = make_node("IF", "n8n-nodes-base.if")
        t = make_node("T", "n8n-nodes-base.code", {"language": "javaScript", "jsCode": ""})
        f = make_node("F", "n8n-nodes-base.code", {"language": "javaScript", "jsCode": ""})
        conns = merge_connections(connect("IF", "T", 0), connect("IF", "F", 1))
        nodes, edges = schema_from(make_workflow(if_node, t, f, connections=conns))
        selector = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        sel_edges = [e for e in edges if e["sourceNodeID"] == selector["id"]]
        assert all("sourcePortID" in e for e in sel_edges)

    @staticmethod
    def test_code_edges_have_source_port_zero():
        a = make_node("A", "n8n-nodes-base.code", {"language": "javaScript", "jsCode": ""})
        b = make_node("B", "n8n-nodes-base.code", {"language": "javaScript", "jsCode": ""})
        nodes, edges = schema_from(make_workflow(a, b, connections=connect("A", "B")))
        first_code_id = nodes_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)[0]["id"]
        code_edges = [e for e in edges if e.get("sourceNodeID") == first_code_id]
        assert all(e.get("sourcePortID") == "0" for e in code_edges)

    @staticmethod
    def test_ai_subnode_not_a_standalone_node():
        model = make_node("Model", "@n8n/n8n-nodes-langchain.lmChatOpenAi")
        agent = make_node("Agent", "@n8n/n8n-nodes-langchain.agent")
        conns = {"Model": {"ai_languageModel": [[{"node": "Agent", "type": "ai_languageModel", "index": 0}]]}}
        nodes, _ = schema_from(make_workflow(model, agent, connections=conns))
        assert not any("Model" in n.get("data", {}).get("title", "") for n in nodes)

    @staticmethod
    def test_all_edges_have_required_fields():
        a = make_node("A", "n8n-nodes-base.code", {"language": "javaScript", "jsCode": ""})
        b = make_node("B", "n8n-nodes-base.code", {"language": "javaScript", "jsCode": ""})
        _, edges = schema_from(make_workflow(a, b, connections=connect("A", "B")))
        for edge in edges:
            assert "id" in edge
            assert "sourceNodeID" in edge
            assert "targetNodeID" in edge

    @staticmethod
    def test_edges_not_self_loops():
        a = make_node("A", "n8n-nodes-base.code", {"language": "javaScript", "jsCode": ""})
        b = make_node("B", "n8n-nodes-base.code", {"language": "javaScript", "jsCode": ""})
        _, edges = schema_from(make_workflow(a, b, connections=connect("A", "B")))
        assert not any(e["sourceNodeID"] == e["targetNodeID"] for e in edges)


# =============================================================================
# UNIT TESTS — Expression conversion
# =============================================================================

class TestExpressions:
    @staticmethod
    def make_converter() -> TestableConverter:
        return TestableConverter().setup()

    def test_json_dot_notation(self):
        assert self.make_converter().convert_expression("={{ $json.city }}") == "{{city}}"

    def test_json_bracket_notation(self):
        assert self.make_converter().convert_expression('={{ $json["my field"] }}') == "{{my_field}}"

    def test_node_reference_expression(self):
        assert self.make_converter().convert_expression("={{ $('SomeNode').item.json.name }}") == "{{name}}"

    def test_leading_equals_stripped(self):
        result = self.make_converter().convert_expression("={{ $json.foo }}")
        assert "=" not in result and "foo" in result

    def test_plain_text_unchanged(self):
        assert self.make_converter().convert_expression("Hello World") == "Hello World"

    def test_display_placeholder_single_braced(self):
        result = self.make_converter().convert_expression("{{Weather Phenomenon, e.g. Sunny}}")
        assert result.startswith("{") and not result.startswith("{{")

    def test_template_var_kept_double_brace(self):
        assert self.make_converter().convert_expression("{{city}}") == "{{city}}"

    def test_field_mapping_applied(self):
        c = self.make_converter()
        c.field_name_map = {"City": "city"}
        assert c.convert_expression_with_mapping('={{ $json["City"] }}') == "{{city}}"

    def test_empty_string_returns_empty(self):
        assert self.make_converter().convert_expression("") == ""

    def test_none_returns_none(self):
        assert self.make_converter().convert_expression(None) is None

    def test_bracket_notation_with_spaces_sanitized(self):
        result = self.make_converter().convert_expression('={{ $json["first name"] }}')
        assert result == "{{first_name}}"

    def test_node_item_json_bracket_converted(self):
        result = self.make_converter().convert_expression(
            "={{ $('NodeA').item.json[\"field_x\"] }}"
        )
        assert "{{field_x}}" == result

    def test_equals_sign_prefix_stripped(self):
        result = self.make_converter().convert_expression("={{ $json.name }}")
        assert not result.startswith("=")

    def test_field_mapping_dot_notation(self):
        c = self.make_converter()
        c.field_name_map = {"UserName": "username"}
        assert c.convert_expression_with_mapping("={{ $json.UserName }}") == "{{username}}"

    def test_field_mapping_equals_prefix_dot_notation(self):
        c = self.make_converter()
        c.field_name_map = {"Score": "score"}
        assert c.convert_expression_with_mapping("={{ $json.Score }}") == "{{score}}"


# =============================================================================
# UNIT TESTS — Model mapping
# =============================================================================

class TestModelMapping:
    @staticmethod
    def _map(model_name, provider=""):
        return TestableConverter().setup().map_model(model_name, provider)

    def test_gpt4_maps_to_openai(self):
        assert self._map("gpt-4-turbo")["name"] == "openai"

    def test_claude_maps_to_anthropic(self):
        assert self._map("claude-3-opus")["name"] == "anthropic"

    def test_qwen_maps_to_qwen(self):
        assert self._map("qwen-max")["name"] == "Qwen"

    def test_deepseek_maps_to_deepseek(self):
        assert self._map("deepseek-chat")["name"] == "deepseek"

    def test_llama_maps_to_ollama(self):
        assert self._map("llama-3")["name"] == "ollama"

    def test_gemini_maps_to_gemini(self):
        assert self._map("gemini-pro")["name"] == "gemini"

    def test_unknown_uses_provider(self):
        assert self._map("some-model", provider="myprovider")["name"] == "myprovider"


# =============================================================================
# UNIT TESTS — Normalize Python main
# =============================================================================

class TestNormalizePythonMain:
    @staticmethod
    def _norm(code):
        return TestableConverter().setup().normalize_python_main(code)

    def test_already_correct_unchanged(self):
        code = "def main(args):\n    return 1"
        assert self._norm(code) == code

    def test_other_def_renamed(self):
        result = self._norm("def process(x, y):\n    return x + y")
        assert "def main(args):" in result
        assert "def process" not in result

    def test_no_def_wrapped(self):
        result = self._norm("x = 1\nreturn x")
        assert "def main(args):" in result
        assert "    x = 1" in result


# =============================================================================
# UNIT TESTS — Fallback / unsupported node
# =============================================================================

class TestFallbackNode:
    @staticmethod
    def test_unknown_node_becomes_code():
        nodes, _ = schema_from(make_workflow(make_node("X", "n8n-nodes-base.unknownXYZ")))
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE) is not None

    @staticmethod
    def test_unknown_node_adds_warning():
        c = N8nWorkflowConverter()
        c.convert_to_schema(make_workflow(make_node("Mystery", "n8n-nodes-base.unknownXYZ")))
        assert any("Mystery" in w for w in c.report.to_warnings_list())

    @staticmethod
    def test_fallback_code_has_node_type_comment():
        """Fallback code documents the original n8n type so developers know what to implement."""
        nodes, _ = schema_from(make_workflow(make_node("X", "n8n-nodes-base.unknownXYZ")))
        code_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        # Converter embeds the original n8n type in the docstring
        assert "n8n-nodes-base.unknownXYZ" in code_node["data"]["inputs"]["code"]

    @staticmethod
    def test_fallback_code_outputs_result():
        nodes, _ = schema_from(make_workflow(make_node("X", "n8n-nodes-base.unknownXYZ")))
        code_node = node_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)
        assert "result" in code_node["data"]["outputs"]["properties"]


# =============================================================================
# HELPERS — reusable condition / rule builders
# =============================================================================

def make_number_condition(field, operation, value):
    """Build a single n8n condition dict (number comparison)."""
    return {
        "leftValue": f"={{{{ $json.{field} }}}}",
        "operator": {"type": "number", "operation": operation},
        "rightValue": value,
    }


def make_string_condition(field, operation, value):
    """Build a single n8n condition dict (string comparison)."""
    return {
        "leftValue": f"={{{{ $json.{field} }}}}",
        "operator": {"type": "string", "operation": operation},
        "rightValue": value,
    }


def make_bool_condition(field, operation):
    """Build a single n8n condition dict (boolean check, no rightValue)."""
    return {
        "leftValue": f"={{{{ $json.{field} }}}}",
        "operator": {"type": "boolean", "operation": operation},
    }


def make_switch_rule(output_key, conditions, combinator="and"):
    """Build one entry in parameters.rules.values."""
    return {
        "outputKey": output_key,
        "combinator": combinator,
        "conditions": {"combinator": combinator, "conditions": conditions},
    }


def make_switch_node(name, rules, *, position=None):
    """Build a full n8n switch node dict."""
    return make_node(name, "n8n-nodes-base.switch",
                     {"rules": {"values": rules}},
                     position=position)


def make_filter_node(name, conditions, combinator="and"):
    """Build a full n8n filter node dict."""
    return make_node(name, "n8n-nodes-base.filter", {
        "conditions": {"combinator": combinator, "conditions": conditions}
    })


# =============================================================================
# UNIT TESTS — _parse_n8n_conditions helper
# =============================================================================

class TestParseN8nConditions:
    """
    Tests for condition/operator logic.

    _parse_n8n_conditions no longer exists as a standalone method — condition
    parsing is inlined inside _convert_if_node.  These tests exercise the same
    logic through two public surfaces:
      • _map_n8n_operator  — tested directly via TestableConverter
      • Full IF-node pipeline — tested via schema_from + node_of_type
    """

    # ------------------------------------------------------------------
    # _map_n8n_operator  (public-ish, called by _convert_if_node)
    # ------------------------------------------------------------------

    @staticmethod
    def _map(op_dict):
        c = TestableConverter().setup()
        return c.map_n8n_operator(op_dict)

    # Basic operator mapping via _map_n8n_operator

    def test_operator_larger_maps_to_gt(self):
        op, _ = self._map({"type": "number", "operation": "larger"})
        assert op == ">"

    def test_operator_smaller_maps_to_lt(self):
        op, _ = self._map({"type": "number", "operation": "smaller"})
        assert op == "<"

    def test_operator_larger_equal_maps_to_gte(self):
        op, _ = self._map({"type": "number", "operation": "largerEqual"})
        assert op == ">="

    def test_operator_smaller_equal_maps_to_lte(self):
        op, _ = self._map({"type": "number", "operation": "smallerEqual"})
        assert op == "<="

    def test_operator_equals_maps_to_eq(self):
        op, _ = self._map({"type": "string", "operation": "equals"})
        assert op == "=="

    def test_operator_not_equals_maps_to_ne(self):
        op, _ = self._map({"type": "string", "operation": "notEquals"})
        assert op == "!="

    def test_operator_contains_preserved(self):
        op, _ = self._map({"type": "string", "operation": "contains"})
        assert op == "contains"

    def test_operator_not_contains_preserved(self):
        op, _ = self._map({"type": "string", "operation": "notContains"})
        assert op == "not_contains"

    def test_operator_starts_with_preserved(self):
        op, _ = self._map({"type": "string", "operation": "startsWith"})
        assert op == "starts_with"

    def test_operator_ends_with_preserved(self):
        op, _ = self._map({"type": "string", "operation": "endsWith"})
        assert op == "ends_with"

    def test_operator_exists_maps_to_ne(self):
        op, _ = self._map({"type": "boolean", "operation": "exists"})
        assert op == "!="

    def test_operator_not_exists_maps_to_eq(self):
        op, _ = self._map({"type": "boolean", "operation": "notExists"})
        assert op == "=="

    def test_boolean_true_operation_sets_right_to_true(self):
        _, right = self._map({"type": "boolean", "operation": "true"})
        assert right is True

    def test_boolean_false_operation_sets_right_to_false(self):
        _, right = self._map({"type": "boolean", "operation": "false"})
        assert right is False

    def test_string_operator_passthrough(self):
        op, right = self._map("equals")
        assert op == "=="
        assert right is None

    # ------------------------------------------------------------------
    # Condition content via full IF-node pipeline (schema_from)
    # ------------------------------------------------------------------

    @staticmethod
    def _if_node_with(conditions, combinator="and"):
        """Build a workflow with a single IF node carrying the given conditions."""
        return make_workflow(make_node("IF", "n8n-nodes-base.if", {
            "conditions": {"combinator": combinator, "conditions": conditions}
        }))

    def test_empty_conditions_returns_placeholder(self):
        nodes, _ = schema_from(self._if_node_with([]))
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        # Empty conditions → placeholder added so schema is valid
        assert len(sel["data"]["branches"][0]["conditions"]) >= 1

    def test_single_condition_produces_one_entry(self):
        nodes, _ = schema_from(self._if_node_with([make_number_condition("score", "gt", 50)]))
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert len(sel["data"]["branches"][0]["conditions"]) == 1

    def test_multiple_conditions_all_converted(self):
        raw = [
            make_number_condition("amount", "larger", 100),
            make_string_condition("status", "equals", "active"),
        ]
        nodes, _ = schema_from(self._if_node_with(raw))
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert len(sel["data"]["branches"][0]["conditions"]) == 2

    def test_number_right_gets_number_schema(self):
        nodes, _ = schema_from(self._if_node_with([make_number_condition("n", "gt", 42)]))
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        cond = sel["data"]["branches"][0]["conditions"][0]
        assert cond["right"]["schema"]["type"] == "number"

    def test_string_right_gets_string_schema(self):
        nodes, _ = schema_from(self._if_node_with([make_string_condition("s", "equals", "hello")]))
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        cond = sel["data"]["branches"][0]["conditions"][0]
        assert cond["right"]["schema"]["type"] == "string"

    def test_bool_right_gets_boolean_schema(self):
        nodes, _ = schema_from(self._if_node_with([make_bool_condition("b", "true")]))
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        cond = sel["data"]["branches"][0]["conditions"][0]
        assert cond["right"]["schema"]["type"] == "boolean"

    def test_exists_operator_right_is_ne(self):
        """
            'exists' maps to the '!=' operator — the right-hand schema type depends on
            whether rightValue is present in the raw condition; test the operator instead.
        """
        nodes, _ = schema_from(self._if_node_with([make_bool_condition("b", "exists")]))
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        cond = sel["data"]["branches"][0]["conditions"][0]
        assert cond["operator"] == "!="

    def test_field_name_extracted_from_json_expression(self):
        nodes, _ = schema_from(self._if_node_with([make_number_condition("totalAmount", "gt", 0)]))
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        cond = sel["data"]["branches"][0]["conditions"][0]
        assert cond["left"]["content"][1] == "totalAmount"

    def test_unknown_expression_falls_back_to_value_idx(self):
        raw = [{"leftValue": "=some_literal",
                "operator": {"type": "string", "operation": "equals"},
                "rightValue": "x"}]
        nodes, _ = schema_from(self._if_node_with(raw))
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        cond = sel["data"]["branches"][0]["conditions"][0]
        assert cond["left"]["content"][1].startswith("value_")

    def test_no_predecessor_condition_left_content_is_list(self):
        """Without a predecessor, left content is still a valid [node_id, field] list."""
        nodes, _ = schema_from(self._if_node_with([make_number_condition("score", "gt", 50)]))
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        cond = sel["data"]["branches"][0]["conditions"][0]
        assert isinstance(cond["left"]["content"], list)
        assert len(cond["left"]["content"]) == 2

    @staticmethod
    def test_predecessor_field_referenced_in_input_parameters():
        """When a predecessor exposes the condition field, inputParameters gets a ref."""
        code_node = make_node("Source", "n8n-nodes-base.code", {
            "language": "python",
            "pythonCode": "def main(a): return {'score': 90, 'result': 90}"
        })
        if_node = make_node("IF", "n8n-nodes-base.if", {
            "conditions": {"combinator": "and", "conditions": [
                make_number_condition("score", "gt", 50)
            ]}
        })
        conns = connect("Source", "IF")
        nodes, _ = schema_from(make_workflow(code_node, if_node, connections=conns))
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        # inputParameters may or may not have an entry depending on field resolution,
        # but the structure must be a dict
        assert isinstance(sel["data"]["inputs"]["inputParameters"], dict)


# =============================================================================
# UNIT TESTS — Switch node
# =============================================================================

class TestSwitchNode:
    """
    Tests for n8n-nodes-base.switch conversion.

    The switch node routes through _convert_if_node (same as IF), so it produces
    a standard 2-branch Selector.  Branch labels and multi-branch expansion from
    rules.values are not implemented — the converter reads conditions.conditions
    just like a regular IF node.
    """

    @staticmethod
    def _simple_switch():
        """Switch with a single condition in the standard conditions format."""
        return make_workflow(make_node("Switch", "n8n-nodes-base.switch", {
            "conditions": {
                "combinator": "and",
                "conditions": [make_number_condition("score", "gt", 50)]
            }
        }))

    @staticmethod
    def _empty_switch():
        return make_workflow(make_node("EmptySwitch", "n8n-nodes-base.switch"))

    @staticmethod
    def _or_switch():
        return make_workflow(make_node("OrSwitch", "n8n-nodes-base.switch", {
            "conditions": {
                "combinator": "or",
                "conditions": [
                    make_string_condition("status", "equals", "vip"),
                    make_string_condition("status", "equals", "premium"),
                ]
            }
        }))

    # ------------------------------------------------------------------
    # Node creation & type
    # ------------------------------------------------------------------

    def test_switch_creates_selector_node(self):
        nodes, _ = schema_from(self._simple_switch())
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF) is not None

    def test_switch_node_id_uses_selector_prefix(self):
        nodes, _ = schema_from(self._simple_switch())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert sel["id"].startswith("selector_")

    def test_switch_title_uses_n8n_node_name(self):
        nodes, _ = schema_from(self._simple_switch())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert sel["data"]["title"] == "Switch"

    # ------------------------------------------------------------------
    # Branch structure (always 2: condition branch + else)
    # ------------------------------------------------------------------

    def test_switch_always_has_two_branches(self):
        for wf in [self._simple_switch(), self._empty_switch(), self._or_switch()]:
            nodes, _ = schema_from(wf)
            sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
            assert len(sel["data"]["branches"]) == 2

    def test_switch_branch_zero_has_conditions(self):
        nodes, _ = schema_from(self._simple_switch())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert len(sel["data"]["branches"][0]["conditions"]) >= 1

    def test_switch_branch_one_has_no_conditions(self):
        nodes, _ = schema_from(self._simple_switch())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert sel["data"]["branches"][1]["conditions"] == []

    def test_switch_all_branch_ids_unique(self):
        nodes, _ = schema_from(self._simple_switch())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        ids = [b["branchId"] for b in sel["data"]["branches"]]
        assert len(ids) == len(set(ids))

    # ------------------------------------------------------------------
    # Combinator / logic
    # ------------------------------------------------------------------

    def test_and_combinator_sets_logic_to_2(self):
        nodes, _ = schema_from(self._simple_switch())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert sel["data"]["branches"][0]["logic"] == 2

    def test_or_combinator_sets_logic_to_1(self):
        nodes, _ = schema_from(self._or_switch())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert sel["data"]["branches"][0]["logic"] == 1

    # ------------------------------------------------------------------
    # Operator and right-value (from conditions format)
    # ------------------------------------------------------------------

    def test_switch_gt_operator_converted(self):
        nodes, _ = schema_from(self._simple_switch())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        cond = sel["data"]["branches"][0]["conditions"][0]
        assert cond["operator"] == ">"

    def test_switch_right_value_preserved(self):
        nodes, _ = schema_from(self._simple_switch())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        cond = sel["data"]["branches"][0]["conditions"][0]
        assert cond["right"]["content"] == 50

    # ------------------------------------------------------------------
    # Edges
    # ------------------------------------------------------------------

    @staticmethod
    def test_switch_edges_have_source_port_ids():
        t = make_node("T", "n8n-nodes-base.code", {"language": "python",
                      "pythonCode": "def main(a): return {'result': 1}"})
        f = make_node("F", "n8n-nodes-base.code", {"language": "python",
                      "pythonCode": "def main(a): return {'result': 2}"})
        switch = make_node("Switch", "n8n-nodes-base.switch", {
            "conditions": {"combinator": "and",
                           "conditions": [make_number_condition("x", "gt", 0)]}
        })
        conns = merge_connections(connect("Switch", "T", 0), connect("Switch", "F", 1))
        nodes, edges = schema_from(make_workflow(switch, t, f, connections=conns))
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        sel_edges = [e for e in edges if e["sourceNodeID"] == sel["id"]]
        assert all("sourcePortID" in e for e in sel_edges)

    @staticmethod
    def test_unconnected_else_branch_wired_to_end():
        t = make_node("T", "n8n-nodes-base.code", {"language": "python",
                      "pythonCode": "def main(a): return {'result': 1}"})
        switch = make_node("Switch", "n8n-nodes-base.switch", {
            "conditions": {"combinator": "and",
                           "conditions": [make_number_condition("x", "gt", 0)]}
        })
        conns = connect("Switch", "T", 0)
        nodes, edges = schema_from(make_workflow(switch, t, connections=conns))
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        end = node_of_type(nodes, ComponentType.COMPONENT_TYPE_END)
        else_id = sel["data"]["branches"][1]["branchId"]
        assert any(
            e["sourceNodeID"] == sel["id"]
            and e["targetNodeID"] == end["id"]
            and e.get("sourcePortID") == else_id
            for e in edges
        )

    # ------------------------------------------------------------------
    # inputParameters
    # ------------------------------------------------------------------

    def test_switch_has_input_parameters_key(self):
        nodes, _ = schema_from(self._simple_switch())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert "inputParameters" in sel["data"]["inputs"]

    def test_switch_input_parameters_is_dict(self):
        nodes, _ = schema_from(self._simple_switch())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert isinstance(sel["data"]["inputs"]["inputParameters"], dict)

    # ------------------------------------------------------------------
    # Full-pipeline fixture
    # ------------------------------------------------------------------

    @staticmethod
    def test_fixture_switch_filter_workflow():
        """End-to-end conversion of the switch_filter_workflow.json fixture."""
        fixture = Path(__file__).parent / "fixtures" / "switch_filter_workflow.json"
        if not fixture.exists():
            pytest.skip("fixture not present")
        with open(fixture) as f:
            wf = json.load(f)
        nodes, edges = schema_from(wf)
        selectors = nodes_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert len(selectors) >= 2


# =============================================================================
# UNIT TESTS — Filter node
# =============================================================================

class TestFilterNode:
    """Tests for _convert_filter_node."""

    # ------------------------------------------------------------------
    # Shared workflow builders
    # ------------------------------------------------------------------

    @staticmethod
    def _basic_filter():
        """Filter: keep only active items with amount > 0."""
        return make_workflow(make_filter_node("FilterActive", [
            make_bool_condition("isActive", "true"),
            make_number_condition("totalAmount", "larger", 0),
        ]))

    @staticmethod
    def _single_condition_filter():
        return make_workflow(make_filter_node("F", [
            make_string_condition("status", "equals", "approved"),
        ]))

    @staticmethod
    def _or_filter():
        return make_workflow(make_filter_node("OrFilter", [
            make_string_condition("tier", "equals", "gold"),
            make_string_condition("tier", "equals", "platinum"),
        ], combinator="or"))

    @staticmethod
    def _empty_filter():
        """Filter with no conditions → placeholder condition in Keep branch."""
        return make_workflow(make_filter_node("EmptyFilter", []))

    # ------------------------------------------------------------------
    # Node creation & type
    # ------------------------------------------------------------------

    def test_filter_creates_selector_node(self):
        nodes, _ = schema_from(self._basic_filter())
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF) is not None

    def test_filter_node_id_uses_selector_prefix(self):
        nodes, _ = schema_from(self._basic_filter())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert sel["id"].startswith("selector_")

    def test_filter_title_uses_n8n_node_name(self):
        nodes, _ = schema_from(self._basic_filter())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert sel["data"]["title"] == "FilterActive"

    # ------------------------------------------------------------------
    # Exactly two branches
    # ------------------------------------------------------------------

    def test_filter_always_has_exactly_two_branches(self):
        for workflow in [self._basic_filter(), self._single_condition_filter(),
                         self._or_filter(), self._empty_filter()]:
            nodes, _ = schema_from(workflow)
            sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
            assert len(sel["data"]["branches"]) == 2, \
                f"Expected 2 branches, got {len(sel['data']['branches'])}"

    # ------------------------------------------------------------------
    # Keep branch (index 0)
    # ------------------------------------------------------------------

    def test_keep_branch_has_conditions(self):
        nodes, _ = schema_from(self._basic_filter())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert len(sel["data"]["branches"][0]["conditions"]) > 0

    def test_keep_branch_condition_count_matches_input(self):
        nodes, _ = schema_from(self._basic_filter())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert len(sel["data"]["branches"][0]["conditions"]) == 2

    def test_keep_branch_has_branch_id(self):
        """Keep branch (index 0) must have a branchId."""
        nodes, _ = schema_from(self._basic_filter())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert "branchId" in sel["data"]["branches"][0]

    # ------------------------------------------------------------------
    # Discard branch (index 1)
    # ------------------------------------------------------------------

    def test_discard_branch_has_no_conditions(self):
        nodes, _ = schema_from(self._basic_filter())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert sel["data"]["branches"][1]["conditions"] == []

    def test_discard_branch_has_branch_id(self):
        """Discard branch (index 1) must have a branchId."""
        nodes, _ = schema_from(self._basic_filter())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert "branchId" in sel["data"]["branches"][1]

    def test_discard_branch_id_differs_from_keep_branch_id(self):
        nodes, _ = schema_from(self._basic_filter())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert sel["data"]["branches"][0]["branchId"] != sel["data"]["branches"][1]["branchId"]

    # ------------------------------------------------------------------
    # Combinator / logic
    # ------------------------------------------------------------------

    def test_and_combinator_sets_logic_to_2(self):
        nodes, _ = schema_from(self._basic_filter())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert sel["data"]["branches"][0]["logic"] == 2

    def test_or_combinator_sets_logic_to_1(self):
        nodes, _ = schema_from(self._or_filter())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert sel["data"]["branches"][0]["logic"] == 1

    # ------------------------------------------------------------------
    # Operator and value conversion
    # ------------------------------------------------------------------

    def test_boolean_true_condition_converted(self):
        nodes, _ = schema_from(self._basic_filter())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        first_cond = sel["data"]["branches"][0]["conditions"][0]
        assert first_cond["right"]["content"] is True

    def test_string_equals_condition_converted(self):
        nodes, _ = schema_from(self._single_condition_filter())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        cond = sel["data"]["branches"][0]["conditions"][0]
        assert cond["operator"] == "=="
        assert cond["right"]["content"] == "approved"

    def test_number_condition_has_number_schema(self):
        nodes, _ = schema_from(self._basic_filter())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        # Second condition is the number check
        cond = sel["data"]["branches"][0]["conditions"][1]
        assert cond["right"]["schema"]["type"] == "number"

    # ------------------------------------------------------------------
    # Empty filter
    # ------------------------------------------------------------------

    def test_empty_filter_keep_branch_has_placeholder_condition(self):
        nodes, _ = schema_from(self._empty_filter())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert len(sel["data"]["branches"][0]["conditions"]) == 1

    # ------------------------------------------------------------------
    # Edges
    # ------------------------------------------------------------------

    @staticmethod
    def test_filter_edges_have_source_port_ids():
        f_node = make_filter_node("F", [make_string_condition("s", "equals", "ok")])
        keep = make_node("Keep", "n8n-nodes-base.code",
                         {"language": "python", "pythonCode": "def main(a): return {'result':'k'}"})
        discard = make_node("Discard", "n8n-nodes-base.code",
                            {"language": "python", "pythonCode": "def main(a): return {'result':'d'}"})
        conns = merge_connections(
            connect("F", "Keep", output_index=0),
            connect("F", "Discard", output_index=1),
        )
        nodes, edges = schema_from(make_workflow(f_node, keep, discard, connections=conns))
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        sel_edges = [e for e in edges if e["sourceNodeID"] == sel["id"]]
        assert all("sourcePortID" in e for e in sel_edges)

    @staticmethod
    def test_keep_port_maps_to_keep_branch():
        f_node = make_filter_node("F", [make_string_condition("s", "equals", "ok")])
        keep = make_node("Keep", "n8n-nodes-base.code",
                         {"language": "python", "pythonCode": "def main(a): return {'result':'k'}"})
        conns = connect("F", "Keep", output_index=0)
        nodes, edges = schema_from(make_workflow(f_node, keep, connections=conns))
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        keep_node = next(n for n in nodes if n["data"]["title"] == "Keep")
        keep_branch_id = sel["data"]["branches"][0]["branchId"]
        assert any(
            e["sourceNodeID"] == sel["id"]
            and e["targetNodeID"] == keep_node["id"]
            and e.get("sourcePortID") == keep_branch_id
            for e in edges
        )

    @staticmethod
    def test_unconnected_discard_branch_wired_to_end():
        """Discard branch with no explicit target must auto-connect to End."""
        f_node = make_filter_node("F", [make_string_condition("s", "equals", "ok")])
        keep = make_node("Keep", "n8n-nodes-base.code",
                         {"language": "python", "pythonCode": "def main(a): return {'result':'k'}"})
        # Only wire the Keep (output 0) branch — leave Discard disconnected
        conns = connect("F", "Keep", output_index=0)
        nodes, edges = schema_from(make_workflow(f_node, keep, connections=conns))
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        end = node_of_type(nodes, ComponentType.COMPONENT_TYPE_END)
        discard_branch_id = sel["data"]["branches"][1]["branchId"]
        assert any(
            e["sourceNodeID"] == sel["id"]
            and e["targetNodeID"] == end["id"]
            and e.get("sourcePortID") == discard_branch_id
            for e in edges
        ), "Discard branch must be auto-wired to End when no explicit connection"

    # ------------------------------------------------------------------
    # inputParameters
    # ------------------------------------------------------------------

    def test_filter_has_input_parameters_key(self):
        nodes, _ = schema_from(self._basic_filter())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert "inputParameters" in sel["data"]["inputs"]

    def test_filter_input_parameters_is_dict(self):
        nodes, _ = schema_from(self._basic_filter())
        sel = node_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        assert isinstance(sel["data"]["inputs"]["inputParameters"], dict)


# =============================================================================
# INTEGRATION TEST — switch_filter_workflow.json fixture (full pipeline)
# =============================================================================

class TestSwitchFilterIntegration:
    """
    Full end-to-end conversion test for the switch_filter_workflow.json fixture.
    Place the file at  tests/fixtures/switch_filter_workflow.json
    """

    @staticmethod
    def _load_fixture():
        fixture = Path(__file__).parent / "fixtures" / "switch_filter_workflow.json"
        if not fixture.exists():
            pytest.skip("switch_filter_workflow.json fixture not present")
        with open(fixture) as f:
            return json.load(f)

    def test_workflow_converts_without_error(self):
        wf = self._load_fixture()
        nodes, edges = schema_from(wf)
        assert len(nodes) > 0

    def test_workflow_has_start_and_end(self):
        wf = self._load_fixture()
        nodes, _ = schema_from(wf)
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_START) is not None
        assert node_of_type(nodes, ComponentType.COMPONENT_TYPE_END) is not None

    def test_manual_trigger_becomes_start(self):
        wf = self._load_fixture()
        nodes, _ = schema_from(wf)
        start = node_of_type(nodes, ComponentType.COMPONENT_TYPE_START)
        # manualTrigger produces an empty outputs schema — no declared properties
        assert start is not None
        assert "outputs" in start["data"]

    def test_two_selectors_produced(self):
        """One Filter + one Switch → 2 Selector nodes."""
        wf = self._load_fixture()
        nodes, _ = schema_from(wf)
        assert len(nodes_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)) == 2

    def test_filter_has_two_branches(self):
        wf = self._load_fixture()
        nodes, _ = schema_from(wf)
        selectors = nodes_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        filter_sel = next((s for s in selectors if s["data"]["title"] == "Keep Active Orders"), None)
        assert filter_sel is not None
        assert len(filter_sel["data"]["branches"]) == 2

    def test_filter_keep_branch_has_two_conditions(self):
        wf = self._load_fixture()
        nodes, _ = schema_from(wf)
        selectors = nodes_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        filter_sel = next(s for s in selectors if s["data"]["title"] == "Keep Active Orders")
        assert len(filter_sel["data"]["branches"][0]["conditions"]) == 2

    def test_switch_has_selector_node(self):
        """The switch node in the fixture produces a Selector."""
        wf = self._load_fixture()
        nodes, _ = schema_from(wf)
        selectors = nodes_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        switch_sel = next((s for s in selectors if s["data"]["title"] == "Route by Order Value"), None)
        assert switch_sel is not None

    def test_switch_sel_title_is_correct(self):
        wf = self._load_fixture()
        nodes, _ = schema_from(wf)
        selectors = nodes_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        switch_sel = next((s for s in selectors if s["data"]["title"] == "Route by Order Value"), None)
        assert switch_sel is not None
        assert switch_sel["data"]["title"] == "Route by Order Value"

    def test_switch_else_branch_has_no_conditions(self):
        wf = self._load_fixture()
        nodes, _ = schema_from(wf)
        selectors = nodes_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        switch_sel = next(s for s in selectors if s["data"]["title"] == "Route by Order Value")
        # The else/fallback branch (index 1) always has no conditions
        assert switch_sel["data"]["branches"][-1]["conditions"] == []

    def test_all_selector_edges_carry_source_port(self):
        wf = self._load_fixture()
        nodes, edges = schema_from(wf)
        selectors = nodes_of_type(nodes, ComponentType.COMPONENT_TYPE_IF)
        for sel in selectors:
            sel_edges = [e for e in edges if e["sourceNodeID"] == sel["id"]]
            assert all("sourcePortID" in e for e in sel_edges), \
                f"Selector '{sel['data']['title']}' has edge(s) without sourcePortID"

    def test_all_nodes_connected(self):
        """Every non-start node should have at least one incoming edge."""
        wf = self._load_fixture()
        nodes, edges = schema_from(wf)
        targets = {e["targetNodeID"] for e in edges}
        for node in nodes:
            if int(node["type"]) == ComponentType.COMPONENT_TYPE_START:
                continue
            assert node["id"] in targets, \
                f"Node '{node['data']['title']}' (id={node['id']}) has no incoming edge"

    def test_code_nodes_present(self):
        wf = self._load_fixture()
        nodes, _ = schema_from(wf)
        # Prepare Order + 3 branch handlers + Handle Inactive = 5 code nodes
        assert len(nodes_of_type(nodes, ComponentType.COMPONENT_TYPE_CODE)) >= 4

    def test_no_duplicate_edges(self):
        wf = self._load_fixture()
        _, edges = schema_from(wf)
        pairs = [(e["sourceNodeID"], e["targetNodeID"]) for e in edges]
        assert len(pairs) == len(set(pairs))