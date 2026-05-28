import pytest
from pydantic import ValidationError

from openjiuwen_studio.schemas.deepsearch import (
    TemplateImportRequest,
    TemplateUpdateRequest,
)

EXPECTED_TEMPLATE_CONTENT_LIMIT = 5 * 1000 * 1000
EXPECTED_TEMPLATE_DESC_LIMIT = 2000
EXPECTED_TEMPLATE_FILE_NAME_LIMIT = 255
EXPECTED_TEMPLATE_NAME_LIMIT = 255


def _template_import_payload(**overrides):
    payload = {
        "space_id": "space-1",
        "file_name": "template.docx",
        "file_stream": "A",
        "is_template": True,
        "template_name": "Template",
        "template_desc": "Description",
        "model_config_id": 1,
    }
    payload.update(overrides)
    return payload


def _template_update_payload(**overrides):
    payload = {
        "space_id": "space-1",
        "template_id": 1,
        "template_content": "A",
        "template_name": "Template",
        "template_desc": "Description",
    }
    payload.update(overrides)
    return payload


def test_template_import_accepts_content_at_configured_limit():
    request = TemplateImportRequest(
        **_template_import_payload(file_stream="A" * EXPECTED_TEMPLATE_CONTENT_LIMIT)
    )

    assert len(request.file_stream) == EXPECTED_TEMPLATE_CONTENT_LIMIT


def test_template_import_rejects_oversized_file_stream():
    with pytest.raises(ValidationError):
        TemplateImportRequest(
            **_template_import_payload(
                file_stream="A" * (EXPECTED_TEMPLATE_CONTENT_LIMIT + 1)
            )
        )


def test_template_update_rejects_oversized_template_content():
    with pytest.raises(ValidationError):
        TemplateUpdateRequest(
            **_template_update_payload(
                template_content="A" * (EXPECTED_TEMPLATE_CONTENT_LIMIT + 1)
            )
        )


@pytest.mark.parametrize(
    ("field_name", "limit"),
    [
        ("file_name", EXPECTED_TEMPLATE_FILE_NAME_LIMIT),
        ("template_name", EXPECTED_TEMPLATE_NAME_LIMIT),
        ("template_desc", EXPECTED_TEMPLATE_DESC_LIMIT),
    ],
)
def test_template_import_rejects_oversized_metadata_fields(field_name, limit):
    with pytest.raises(ValidationError):
        TemplateImportRequest(**_template_import_payload(**{field_name: "A" * (limit + 1)}))


@pytest.mark.parametrize(
    ("field_name", "limit"),
    [
        ("template_name", EXPECTED_TEMPLATE_NAME_LIMIT),
        ("template_desc", EXPECTED_TEMPLATE_DESC_LIMIT),
    ],
)
def test_template_update_rejects_oversized_metadata_fields(field_name, limit):
    with pytest.raises(ValidationError):
        TemplateUpdateRequest(**_template_update_payload(**{field_name: "A" * (limit + 1)}))
