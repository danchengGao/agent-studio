import asyncio
from pathlib import Path

from openjiuwen_studio.routers.deepsearch_logger import DeepSearchLogger


def test_deepsearch_log_path_stays_inside_log_dir_for_absolute_conversation_id(tmp_path, monkeypatch):
    monkeypatch.setattr(DeepSearchLogger, "LOG_DIR", tmp_path)

    log_path = DeepSearchLogger("/tmp/evil").get_log_file_path().resolve()

    assert log_path.parent == tmp_path.resolve()
    assert log_path.name == "_tmp_evil.log"


def test_deepsearch_log_path_stays_inside_log_dir_for_traversal_conversation_id(tmp_path, monkeypatch):
    monkeypatch.setattr(DeepSearchLogger, "LOG_DIR", tmp_path)

    log_path = DeepSearchLogger("../../evil").get_log_file_path().resolve()

    assert log_path.parent == tmp_path.resolve()
    assert log_path.name == "evil.log"


def test_deepsearch_request_log_redacts_nested_secrets(tmp_path, monkeypatch):
    monkeypatch.setattr(DeepSearchLogger, "LOG_DIR", tmp_path)

    logger = DeepSearchLogger("conversation-1")
    asyncio.run(
        logger.log_request(
            {
                "conversation_id": "conversation-1",
                "llm_config": {
                    "general": {
                        "api_key": "SUPERSECRET",
                        "token": "TOKENSECRET",
                        "nested": {"password": "PASSWORDSECRET"},
                    }
                },
                "messages": [{"content": "keep this text"}],
            }
        )
    )

    log_content = Path(logger.get_log_file_path()).read_text(encoding="utf-8")

    assert "keep this text" in log_content
    assert "SUPERSECRET" not in log_content
    assert "TOKENSECRET" not in log_content
    assert "PASSWORDSECRET" not in log_content
    assert log_content.count("***REDACTED***") == 3
