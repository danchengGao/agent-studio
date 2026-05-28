import json
import re
from telegram import Update

from openjiuwen.core.common.logging import logger

from connect.client.workflows.execute_workflow import execute_workflow
from connect.client.workflows import parse_workflow_result


def format_response(output: dict) -> str:
    """
    If output["response"] contains a JSON list of size 1,
    print all fields inside that object.
    Otherwise return the raw output.
    """

    # If no "response" key → return as-is
    if "response" not in output:
        return str(output)

    raw = output["response"]

    # Try to parse JSON inside "response"
    try:
        data = json.loads(raw)
    except Exception:
        return raw  # not valid JSON → return as-is

    # Must be a list of size 1
    if not isinstance(data, list) or len(data) != 1:
        return raw

    item = data[0]

    # Must be a dict
    if not isinstance(item, dict):
        return raw

    # Build message dynamically from all fields
    lines = []
    for key, value in item.items():
        # Format nicely: Title Case key, raw value
        lines.append(f"*{key.replace('_', ' ').title()}:* {value}")

    return "\n".join(lines)


MAX_LENGTH = 500  # safely below Telegram's 4096-char limit


async def send_long_message(update, text, parse_mode='MarkdownV2'):
    open_bold = False
    open_italic = False
    open_code = False

    def scan_markdown(chunk):
        nonlocal open_bold, open_italic, open_code
        i = 0
        while i < len(chunk):
            c = chunk[i]

            # Skip escaped characters
            if c == '\\':
                i += 2
                continue

            # Inline code `
            if c == '`':
                open_code = not open_code
                i += 1
                continue

            # Bold *
            if c == '*' and not open_code:
                open_bold = not open_bold
                i += 1
                continue

            # Italic _
            if c == '_' and not open_code:
                open_italic = not open_italic
                i += 1
                continue

            i += 1

    def close_tags():
        tags = ""
        if open_code:
            tags += "`"
        if open_bold:
            tags += "*"
        if open_italic:
            tags += "_"
        return tags

    def reopen_tags():
        tags = ""
        if open_italic:
            tags += "_"
        if open_bold:
            tags += "*"
        if open_code:
            tags += "`"
        return tags

    # Split into sections by ---
    sections = []
    current = []
    lines = text.splitlines(keepends=True)

    i = 0
    while i < len(lines):
        line = lines[i]

        if line.strip() == "---":
            while current and current[-1].strip() == "":
                current.pop()

            if current:
                sections.append("".join(current))
                current = []

            i += 1
            while i < len(lines) and lines[i].strip() == "":
                i += 1
            continue

        current.append(line)
        i += 1

    if current:
        sections.append("".join(current))

    # Chunk each section safely
    for section in sections:
        s = section.strip()

        while len(s) > MAX_LENGTH:
            split_at = s.rfind('\n', 0, MAX_LENGTH)
            if split_at == -1:
                split_at = s.rfind(' ', 0, MAX_LENGTH)
            if split_at == -1:
                split_at = MAX_LENGTH

            chunk = s[:split_at]

            scan_markdown(chunk)

            safe_chunk = chunk + close_tags()
            try:
                await update.message.reply_text(safe_chunk, parse_mode=parse_mode)
            except Exception as e:
                logger.error(e)
                # safe_chunk = safe_chunk.replace("*", "")
                # safe_chunk = safe_chunk.replace("_", "")
                # safe_chunk = safe_chunk.replace("#", "")
                # safe_chunk = safe_chunk.replace("[", "")
                # safe_chunk = safe_chunk.replace("]", "")
                # safe_chunk = safe_chunk.replace("{", "")
                # safe_chunk = safe_chunk.replace("}", "")
                await update.message.reply_text(safe_chunk)

            s = reopen_tags() + s[split_at:].lstrip()

        scan_markdown(s)
        safe_final = s + close_tags()
        await update.message.reply_text(safe_final, parse_mode=parse_mode)



MAX_LEN = 3900  # Telegram safe margin

# Characters that MUST be escaped in MarkdownV2
SPECIAL = r'([\\{}\[\]()#+\-=|.!])'


def escape_markdown_v2_preserve_formatting(text: str) -> str:
    """
    Escape MarkdownV2 special characters EXCEPT:
    - * used for bold
    - _ used for italic
    - ` used for code
    - # when used as hashtag
    """
    # 1. Escape all special characters except *, _, `
    escaped = re.sub(SPECIAL, r'\\\1', text)

    # 2. Escape # only when NOT part of a hashtag
    escaped = re.sub(r'(?<!\w)#(?!\w)', r'\#', escaped)

    # 3. Escape * or _ only when they appear inside words
    escaped = re.sub(r'(?<=\w)\*(?=\w)', r'\*', escaped)
    escaped = re.sub(r'(?<=\w)_(?=\w)', r'\_', escaped)

    return escaped


def chunk_markdown_v2(text: str):
    """
    Escape + split MarkdownV2 text into Telegram-safe chunks.
    - Preserves bold, italic, hashtags, code
    - Escapes only unsafe characters
    - Splits into <=3900 char chunks
    - Avoids splitting inside formatting spans
    """
    safe = escape_markdown_v2_preserve_formatting(text)

    chunks = []
    s = safe

    while len(s) > MAX_LEN:
        # Prefer splitting at newline
        split_at = s.rfind("\n", 0, MAX_LEN)
        if split_at == -1:
            # Then at space
            split_at = s.rfind(" ", 0, MAX_LEN)
        if split_at == -1:
            # Hard split
            split_at = MAX_LEN

        chunk = s[:split_at]
        chunks.append(chunk)

        s = s[split_at:].lstrip()

    chunks.append(s)
    return chunks



async def _execute_and_reply(update: Update, backend_client, workflow_id: str, inputs: dict):
    """Execute workflow and send result to user."""
    logger.info("_execute_and_reply called: user_id=%s, workflow_id=%s, inputs=%s",
                update.effective_user.id, workflow_id, inputs)
    await update.message.reply_text(
        f"🚀 Executing with inputs: `{inputs}`" if inputs else "🚀 Executing workflow...",
        parse_mode='Markdown'
    )
    events = execute_workflow(backend_client, workflow_id, inputs)
    outputs, error = parse_workflow_result(events)

    if error:
        await update.message.reply_text(f"❌ Execution failed: {error}")
        return

    message = "✅ *Workflow executed successfully!*\n\n"

    # Try special formatting
    special = format_response(outputs)

    if special:
        message += special
    else:
        # Fallback to your original behavior
        if outputs:
            for key, val in outputs.items():
                message += f"*{key}:*\n{str(val)}\n\n"
        else:
            message += f"_Received {len(events)} trace event(s) — no output found._"

    if len(message) > 4095:
        # escaped = escape_markdown_v2_preserve_formatting(message)
        chunks = chunk_markdown_v2(message)
    else:
        chunks = [message]

    for chunk in chunks:
        try:
            await update.message.reply_text(chunk, parse_mode="MarkdownV2")
        except Exception as e:
            await update.message.reply_text(chunk)

    # Escape underscores for Markdown
    # message = message.replace('_', '\\_')
    # message = message.replace('**', '*')
    #await send_long_message(update, message)
