import base64
import os
import sys
from typing import Any
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parent.parent))

os.environ.setdefault("DB_TYPE", "sqlite")
os.environ.setdefault("SQLITE_DB_PATH", str(Path(__file__).resolve().parent / ".tmp-db"))
os.environ.setdefault("OPS_SQLITE_DB", "ops-test.db")
os.environ.setdefault("AGENT_SQLITE_DB", "agent-test.db")

from openjiuwen_studio.models.db_fun_base import Base


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = session_local()
    try:
        yield session, engine
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def encryption_env(monkeypatch):
    monkeypatch.setenv("SERVICE_MODE", "product")
    monkeypatch.setenv(
        "SERVER_AES_MASTER_KEY_ENV",
        base64.b64encode(b"0123456789abcdef0123456789abcdef").decode("utf-8"),
    )


def test_vlm_schema_rejects_invalid_base_url():
    from openjiuwen_studio.schemas.vlm_model_config import VLMModelConfigCreate

    with pytest.raises(ValueError, match="Base URL must start with http:// or https://"):
        VLMModelConfigCreate(
            name="chart-reviewer",
            provider="openai",
            space_id="space-1",
            model_id="gpt-4.1-mini",
            api_key="sk-test-key",
            base_url="invalid-url",
        )


def test_vlm_manager_create_config_encrypts_and_masks_api_key(db_session, encryption_env):
    from openjiuwen_studio.core.manager.model_manager.managers.vlm_model_config_manager import (
        VLMModelConfigManager,
    )
    from openjiuwen_studio.models.vlm_model_config import VLMModelConfig
    from openjiuwen_studio.schemas.vlm_model_config import VLMModelConfigCreate

    session, engine = db_session
    Base.metadata.create_all(bind=engine, tables=[VLMModelConfig.__table__])

    manager = VLMModelConfigManager(session)
    created = manager.create_config(
        VLMModelConfigCreate(
            name="chart-reviewer",
            provider="openai",
            space_id="space-1",
            model_id="gpt-4.1-mini",
            api_key="sk-test-key-12345678",
            base_url="https://api.example.com/v1",
            description="chart review model",
            tags=["vlm", "chart"],
            timeout=30,
            retry_count=2,
            is_active=True,
        )
    )

    assert created.api_key != "sk-test-key-12345678"

    response = manager.model_to_response(created)

    assert response.api_key_masked.endswith("5678")
    assert "12345678" not in response.api_key_masked[:-4]
    assert response.model_id == "gpt-4.1-mini"


def test_vlm_repository_can_search_by_name_or_model_id(db_session):
    from openjiuwen_studio.core.manager.repositories.vlm_model_config_repository import (
        VLMModelConfigRepository,
        VLMModelConfigQuery,
    )
    from openjiuwen_studio.models.vlm_model_config import VLMModelConfig

    session, engine = db_session
    Base.metadata.create_all(bind=engine, tables=[VLMModelConfig.__table__])

    repo = VLMModelConfigRepository(session)
    repo.create(
        {
            "name": "chart-reviewer",
            "space_id": "space-1",
            "provider": "openai",
            "model_id": "gpt-4.1-mini",
            "api_key": "stored-key",
            "base_url": "https://api.example.com/v1",
            "description": "chart review model",
            "tags": ["vlm"],
            "timeout": 30,
            "retry_count": 2,
            "is_active": True,
        }
    )

    by_name, total_by_name = repo.get_paginated(
        VLMModelConfigQuery(space_id="space-1", search="chart-review")
    )
    by_model_id, total_by_model_id = repo.get_paginated(
        VLMModelConfigQuery(space_id="space-1", search="gpt-4.1")
    )

    assert total_by_name == 1
    assert total_by_model_id == 1
    assert by_name[0].model_id == "gpt-4.1-mini"
    assert by_model_id[0].name == "chart-reviewer"


def test_vlm_repository_filters_by_provider_enum(db_session):
    from openjiuwen_studio.core.manager.repositories.vlm_model_config_repository import (
        VLMModelConfigRepository,
        VLMModelConfigQuery,
    )
    from openjiuwen_studio.models.vlm_model_config import VLMModelConfig
    from openjiuwen_studio.schemas.model_config import ModelProvider

    session, engine = db_session
    Base.metadata.create_all(bind=engine, tables=[VLMModelConfig.__table__])

    repo = VLMModelConfigRepository(session)
    repo.create(
        {
            "name": "chart-reviewer",
            "space_id": "space-1",
            "provider": "openai",
            "model_id": "gpt-4.1-mini",
            "api_key": "stored-key",
            "base_url": "https://api.example.com/v1",
            "description": "chart review model",
            "tags": ["vlm"],
            "timeout": 30,
            "retry_count": 2,
            "is_active": True,
        }
    )
    repo.create(
        {
            "name": "backup-reviewer",
            "space_id": "space-1",
            "provider": "qwen",
            "model_id": "qwen-vl-plus",
            "api_key": "stored-key",
            "base_url": "https://api.example.com/v1",
            "description": "backup chart review model",
            "tags": ["vlm"],
            "timeout": 30,
            "retry_count": 2,
            "is_active": True,
        }
    )

    filtered, total = repo.get_paginated(
        VLMModelConfigQuery(space_id="space-1", provider=ModelProvider.OPENAI)
    )

    assert total == 1
    assert filtered[0].provider == ModelProvider.OPENAI.value


def test_vlm_router_converts_provider_query_to_enum():
    from openjiuwen_studio.routers.auth import get_current_user
    from openjiuwen_studio.routers.vlm_models import (
        get_vlm_model_config_manager,
        vlm_models_router,
    )
    from openjiuwen_studio.schemas.model_config import ModelProvider

    class StubVLMManager:
        def __init__(self):
            self.provider: Any = None

        def get_paginated_configs(self, query):
            self.provider = query.provider
            return [], 0

    stub_manager = StubVLMManager()

    def get_stub_manager():
        return stub_manager

    def get_stub_user():
        return {"data": {"user_id_str": "1"}}

    app = FastAPI()
    app.include_router(vlm_models_router)
    app.dependency_overrides[get_vlm_model_config_manager] = get_stub_manager
    app.dependency_overrides[get_current_user] = get_stub_user

    response = TestClient(app).get("/vlm-models/space-1", params={"provider": "openai"})

    assert response.status_code == 200
    assert isinstance(stub_manager.provider, ModelProvider)
    assert stub_manager.provider == ModelProvider.OPENAI


def test_vlm_router_exposes_config_routes_with_test_endpoint():
    from openjiuwen_studio.routers.vlm_models import vlm_models_router

    route_paths = {route.path for route in vlm_models_router.routes}

    assert "/vlm-models/{space_id}" in route_paths
    assert "/vlm-models/" in route_paths
    assert "/vlm-models/toggle" in route_paths
    assert "/vlm-models/{config_id}/test" in route_paths


def test_router_register_includes_vlm_router():
    from openjiuwen_studio.routers.register import router_register

    app = FastAPI()
    router_register(app)

    route_paths = {route.path for route in app.routes}

    assert "/api/v1/vlm-models/{space_id}" in route_paths
    assert "/api/v1/vlm-models/" in route_paths


def test_vlm_public_managers_are_exported():
    from openjiuwen_studio.core.manager.model_manager.managers import (
        VLMModelConfigManager,
        VLMModelTester,
    )

    assert VLMModelConfigManager is not None
    assert VLMModelTester is not None


def test_vlm_tester_requires_complete_image_payload():
    from openjiuwen_studio.core.exceptions import ModelTestError
    from openjiuwen_studio.core.manager.model_manager.managers.vlm_model_test_manager import (
        VLMModelTester,
    )
    from openjiuwen_studio.schemas.vlm_model_config import VLMModelTestRequest

    with pytest.raises(ModelTestError, match="mime_type and image_base64"):
        VLMModelTester.build_test_messages(
            VLMModelTestRequest(
                prompt="Describe this image",
                image_base64="ZmFrZS1pbWFnZQ==",
            )
        )


@pytest.mark.asyncio
async def test_vlm_tester_builds_multimodal_messages_for_image_input(
    db_session,
    encryption_env,
    monkeypatch,
):
    import openjiuwen_studio.core.manager.model_manager.managers.vlm_model_test_manager as tester_module

    from openjiuwen_studio.core.manager.model_manager.managers.vlm_model_config_manager import (
        VLMModelConfigManager,
    )
    from openjiuwen_studio.core.manager.model_manager.managers.vlm_model_test_manager import (
        VLMModelTester,
    )
    from openjiuwen_studio.models.vlm_model_config import VLMModelConfig
    from openjiuwen_studio.schemas.vlm_model_config import (
        VLMModelConfigCreate,
        VLMModelTestRequest,
    )

    session, engine = db_session
    Base.metadata.create_all(bind=engine, tables=[VLMModelConfig.__table__])

    created = VLMModelConfigManager(session).create_config(
        VLMModelConfigCreate(
            name="vision-reviewer",
            provider="openai",
            space_id="space-1",
            model_id="gpt-4.1-mini",
            api_key="sk-test-key-12345678",
            base_url="https://api.example.com/v1",
            description="vision review model",
            tags=["vlm", "vision"],
            timeout=30,
            retry_count=2,
            is_active=True,
        )
    )

    captured: dict[str, Any] = {}

    class StubModel:
        def __init__(self, *args, **kwargs):
            captured["init_kwargs"] = kwargs

        async def invoke(self, messages):
            captured["messages"] = messages
            return type("StubAIMessage", (), {"content": "looks like a logo"})()

    monkeypatch.setattr(tester_module, "Model", StubModel)

    tester = VLMModelTester(session)
    result = await tester.test_model_config(
        created.id,
        VLMModelTestRequest(
            prompt="Describe this image",
            mime_type="image/jpeg",
            image_base64="ZmFrZS1pbWFnZS1ieXRlcw==",
        ),
    )

    assert result.success is True
    assert result.response == "looks like a logo"
    assert captured["messages"][0]["role"] == "user"
    assert captured["messages"][0]["content"][0] == {
        "type": "text",
        "text": "Describe this image",
    }
    assert captured["messages"][0]["content"][1]["type"] == "image_url"
    assert (
        captured["messages"][0]["content"][1]["image_url"]["url"]
        == "data:image/jpeg;base64,ZmFrZS1pbWFnZS1ieXRlcw=="
    )


def test_main_explicitly_registers_vlm_model_table():
    main_source = Path(__file__).resolve().parent.parent / "openjiuwen_studio" / "main.py"
    source = main_source.read_text(encoding="utf-8")

    assert "VLMModelConfig" in source
    assert "VLMModelConfig.__table__" in source


def test_deepsearch_builds_vlm_chart_generating_config(db_session, encryption_env, monkeypatch):
    import openjiuwen_studio.routers.deepsearch as deepsearch_module

    from openjiuwen_studio.core.manager.model_manager.managers.vlm_model_config_manager import (
        VLMModelConfigManager,
    )
    from openjiuwen_studio.models.vlm_model_config import VLMModelConfig
    from openjiuwen_studio.schemas.vlm_model_config import VLMModelConfigCreate

    session, engine = db_session
    Base.metadata.create_all(bind=engine, tables=[VLMModelConfig.__table__])

    created = VLMModelConfigManager(session).create_config(
        VLMModelConfigCreate(
            name="chart-vlm",
            provider="openai",
            space_id="space-1",
            model_id="gpt-4.1-mini",
            api_key="sk-test-key-12345678",
            base_url="https://api.example.com/v1",
            description="vision chart model",
            tags=["vlm", "chart"],
            timeout=45,
            retry_count=2,
            is_active=True,
        )
    )

    monkeypatch.setattr(
        deepsearch_module,
        "build_single_model_config",
        lambda model_id, space_id: {
            "model_name": f"llm-{model_id}",
            "model_type": "openai",
            "base_url": "https://api.example.com/v1",
            "api_key": "sk-llm",
            "hyper_parameters": {},
        },
    )

    configs = deepsearch_module.get_model_configs(
        deepsearch_module.DeepSearchModelConfigQuery(
            general_model_id=1,
            space_id="space-1",
            vlm_model_config_id=created.id,
        ),
        db=session,
    )

    assert configs["general"]["model_name"] == "llm-1"
    assert configs["vlm_chart_generating"]["model_name"] == "gpt-4.1-mini"
    assert configs["vlm_chart_generating"]["model_type"] == "openai"
    assert configs["vlm_chart_generating"]["base_url"] == "https://api.example.com/v1"
    assert configs["vlm_chart_generating"]["api_key"] == "sk-test-key-12345678"
    assert configs["vlm_chart_generating"]["hyper_parameters"] == {
        "timeout": 45,
        "retry_count": 2,
    }
