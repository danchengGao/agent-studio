"""
Platform-agnostic state machine for collecting workflow input parameters
one at a time from the user.

Each platform stores a ParamCollectionSession in its own conversation
context (e.g. Telegram's context.user_data, Slack's session, etc.).
"""
from typing import Any, Dict, List, Optional, Tuple


class ParamCollectionSession:
    """
    Tracks which workflow parameters still need to be collected and which
    have already been answered.

    Usage:
        session = ParamCollectionSession(workflow_id, params)

        # Present session.format_prompt(1, session.total) to user.
        # On each user reply:
        error, done = session.submit(user_text)
        # or:
        error, done = session.skip()

        if error:
            # show error, keep asking for the same param
        elif done:
            inputs = session.get_collected()
            # run the workflow
        else:
            # show session.format_prompt(session.answered + 1, session.total)
    """

    def __init__(self, workflow_id: str, params: List[Dict[str, Any]]):
        self.workflow_id = workflow_id
        self._remaining: List[Dict[str, Any]] = list(params)
        self._collected: Dict[str, Any] = {}
        self.total: int = len(params)

    # ------------------------------------------------------------------
    # Public read-only properties
    # ------------------------------------------------------------------

    @property
    def answered(self) -> int:
        return len(self._collected)

    @property
    def is_done(self) -> bool:
        return len(self._remaining) == 0

    def current_param(self) -> Optional[Dict[str, Any]]:
        return self._remaining[0] if self._remaining else None

    def get_collected(self) -> Dict[str, Any]:
        return dict(self._collected)

    # ------------------------------------------------------------------
    # User interactions
    # ------------------------------------------------------------------

    def submit(self, text: str) -> Tuple[Optional[str], bool]:
        """
        Accept a text value for the current parameter.

        Returns:
            (error_message, is_done)
            - (None, False) — value accepted, more params remain
            - (None, True)  — value accepted, all params collected
            - (msg,  False) — type error; caller should re-prompt
        """
        param = self.current_param()
        if param is None:
            return None, True

        param_name = param.get('name', '?')
        param_type = param.get('type', 'string')

        try:
            if param_type == 'integer':
                value: Any = int(text)
            elif param_type == 'number':
                value = float(text)
            elif param_type == 'boolean':
                value = text.lower() in ('true', '1', 'yes')
            else:
                value = text
        except ValueError:
            return f'Expected `{param_type}` for `{param_name}`, got: `{text}`. Try again:', False

        self._collected[param_name] = value
        self._remaining.pop(0)
        return None, self.is_done

    def skip(self) -> Tuple[Optional[str], bool]:
        """
        Skip the current (optional) parameter.

        Returns:
            (error_message, is_done)
            - (msg, False) — parameter is required; cannot skip
            - (None, ...)  — skipped successfully
        """
        param = self.current_param()
        if param is None:
            return None, True

        if param.get('required', False):
            return f'`{param.get("name", "?")}` is required and cannot be skipped.', False

        self._remaining.pop(0)
        return None, self.is_done

    # ------------------------------------------------------------------
    # Formatting helpers (platform-agnostic Markdown)
    # ------------------------------------------------------------------

    def format_prompt(self, index: int, total: int, skip_command: str = 'workflow_skip') -> str:
        def escape_md(text: str) -> str:
            if not isinstance(text, str):
                text = str(text)
            for ch in ['_', '*', '`', '[', ']']:
                text = text.replace(ch, f'\\{ch}')
            return text

        param = self.current_param()
        if param is None:
            return ''

        name = escape_md(param.get('name', '?'))
        desc = escape_md(param.get('description', ''))
        ptype = escape_md(param.get('type', 'string'))
        required = param.get('required', False)

        if required:
            req_label = "(required)"
        else:
            req_label = f"(optional — /{escape_md(skip_command)} to skip)"

        prompt = (
            f"📝 *Parameter {index}/{total}:* `{name}`\n"
            f"Type: `{ptype}` {req_label}\n"
        )

        # DO NOT wrap description in italics — Telegram Markdown V1 breaks
        if desc:
            prompt += f"{desc}\n"

        prompt += "\nEnter value:"
        return prompt
