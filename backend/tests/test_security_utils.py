from openjiuwen_studio.core.manager.model_manager.utils.security_utils import SecurityUtils


def test_mask_api_key_hides_everything_when_visible_chars_is_zero():
    assert SecurityUtils.mask_api_key("sk-abc123", visible_chars=0) == "*********"


def test_mask_api_key_hides_everything_when_visible_chars_is_negative():
    assert SecurityUtils.mask_api_key("sk-abc123", visible_chars=-1) == "*********"


def test_mask_api_key_keeps_default_trailing_characters_visible():
    assert SecurityUtils.mask_api_key("sk-abc123") == "*****c123"
