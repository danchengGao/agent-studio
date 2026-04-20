import re
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEEPSEARCH_COMPOSE_TEMPLATE = REPO_ROOT / "scripts/conf/docker-deepsearch.template.yml"
TEMPLATE_HANDLER = REPO_ROOT / "scripts/template_handler.sh"


def _template_handler_text() -> str:
    return TEMPLATE_HANDLER.read_text(encoding="utf-8")


def _deepsearch_runtime_allowlist(script: str) -> str:
    match = re.search(
        r"DEEPSEARCH_RUNTIME_ENV_KEYS=\(\n(?P<body>.*?)\n\)",
        script,
        flags=re.DOTALL,
    )
    assert match, "DEEPSEARCH_RUNTIME_ENV_KEYS allowlist is not defined"
    return match.group("body")


def test_deepsearch_compose_does_not_mount_full_runtime_env():
    template = DEEPSEARCH_COMPOSE_TEMPLATE.read_text(encoding="utf-8")

    assert "env.deepsearch.<<NAME_SUFFIX>>" in template
    assert "env.runtime.<<NAME_SUFFIX>>" not in template


def test_deepsearch_mysql_env_contains_minimum_database_settings():
    script = _template_handler_text()

    for key in ("DB_TYPE", "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DEEPSEARCH_DB_NAME"):
        pattern = rf'^\s*DEEPSERACH_ENV_VARS\["{key}"\]='
        assert re.search(pattern, script, flags=re.MULTILINE), f"{key} is not exported"


def test_deepsearch_env_contains_service_specific_runtime_settings():
    script = _template_handler_text()
    allowlist = _deepsearch_runtime_allowlist(script)

    for key in (
        "INDEX_MANAGER_TYPE",
        "MILVUS_HOST",
        "MILVUS_PORT",
        "MILVUS_TOKEN",
        "CHECKPOINTER_TYPE",
        "CHECKPOINTER_DB_TYPE",
        "CHECKPOINTER_DB_PATH",
        "REDIS_URL",
        "REDIS_CLUSTER_MODE",
        "REDIS_TTL",
        "REDIS_REFRESH_ON_READ",
        "OBS_ACCESS_KEY_ID",
        "OBS_SECRET_ACCESS_KEY",
        "OBS_SERVER",
        "OBS_REGION",
        "OBS_BUCKET",
    ):
        assert re.search(rf"^\s*{key}\s*$", allowlist, flags=re.MULTILINE), f"{key} is not allowlisted"

    assert 'for key in "${DEEPSEARCH_RUNTIME_ENV_KEYS[@]}"' in script
    assert 'DEEPSERACH_ENV_VARS["${key}"]="${RUNTIME_VARS["${key}"]:-}"' in script


def test_deepsearch_env_does_not_export_backend_runtime_secrets():
    script = _template_handler_text()
    allowlist = _deepsearch_runtime_allowlist(script)

    for key in (
        "SECRET_KEY",
        "MINIO_ACCESS_KEY",
        "MINIO_SECRET_KEY",
        "SERVER_AES_MASTER_KEY_ENV",
        "SYSTEM_ADMIN_TOKEN",
    ):
        pattern = rf'^\s*DEEPSERACH_ENV_VARS\["{key}"\]='
        assert not re.search(pattern, script, flags=re.MULTILINE), f"{key} must not be exported"
        assert not re.search(rf"^\s*{key}\s*$", allowlist, flags=re.MULTILINE), f"{key} must not be allowlisted"
