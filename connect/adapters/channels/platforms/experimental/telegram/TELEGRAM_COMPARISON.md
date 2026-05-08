# Telegram: OpenJiuwen Channels vs JiuwenClaw — End-to-End Comparison

This document compares how Telegram is handled in two separate systems that both use the
`python-telegram-bot` library:

- **OpenJiuwen Channels** (`connect/adapters/channels/platforms/telegram/`) — the Telegram adapter
  in OpenJiuwen's multi-platform channel system
- **JiuwenClaw** (`jiuwenclaw/channel/telegram_channel.py`) — the Telegram channel in
  JiuwenClaw's personal AI assistant platform

The question this document answers: **Is there enough shared code to justify a common
Telegram codebase, or should they stay separate?**

---

## Executive Summary

**Keep them separate. The shared surface is 3 lines.**

Both systems use the same `python-telegram-bot` library, so the Telegram SDK calls look
identical at a glance. But the architectures diverge immediately after receiving a message:
OpenJiuwen is a command-driven menu for a remote API platform with per-user authentication;
JiuwenClaw is a single-pipe conversation forwarder to an integrated ReAct AI agent with no
login flow. Their message routing, auth models, state machines, and feature sets are
incompatible — unifying them would add cross-repo coupling in exchange for eliminating 3
lines of SDK attribute access.

The one actionable outcome is three small patterns worth **copying** (not sharing) from
JiuwenClaw into OpenJiuwen: group chat mode support, a `send_message` fallback when
Markdown parsing fails, and a 👀 reaction as immediate processing feedback instead of a
"Processing..." text message.

---

## What each system does

### OpenJiuwen Channels — Telegram

A **command-driven interface** to a remote OpenJiuwen backend. Users authenticate with their
own credentials and then use slash commands to discover and invoke specific agents and
workflows. The bot is a menu-driven remote control for the OpenJiuwen platform.

```
User in Telegram
      │
      │  /workflow_execute wf-123
      ▼
OpenJiuwen Telegram bot
      │
      │  @require_login → verify JWT token → refresh if needed
      │
      │  get_workflow(client, "wf-123")
      │  → "This workflow needs 2 parameters"
      │  → ConversationHandler collects them one by one
      │
      │  execute_workflow(client, "wf-123", {inputs})
      │  → SSE stream → parse outputs
      ▼
"✅ Workflow complete. Output: ..."
```

Features: login/logout/status, list agents, search agents, execute agent, multi-turn
agent chat, list workflows, search workflows, execute workflow with interactive parameter
collection, health check.

Commands: `/login`, `/logout`, `/status`, `/agents`, `/agents_search`, `/agent_execute`,
`/agent_start_chat`, `/agent_end_chat`, `/workflows`, `/workflows_search`,
`/workflow_execute`, `/workflow_skip`, `/workflow_cancel`, `/health`, `/start`, `/help`

### JiuwenClaw — Telegram

A **conversation pipe** to an integrated personal AI assistant. All free-text messages are
forwarded to one JiuwenClaw ReAct agent (which has memory, skills, browser automation, etc.)
that decides autonomously what to do with them.

```
User in Telegram
      │
      │  "Summarise this week's emails and remind me about the meeting"
      ▼
JiuwenClaw Telegram channel
      │
      │  is_allowed(user_id)?
      │  set_reaction(👀)
      │
      │  Message(session_id="telegram_{chat_id}", params={content, query})
      ▼
RobotMessageRouter queue
      ▼
JiuwenClaw ReAct agent (with memory, skills, browser automation, cron, ...)
      ▼
"Here's your summary: ... And a reminder has been set for 10am."
```

Features: /start, /help, and free-text message forwarding. Group chat support
(off/mention/reply/all modes). The agent itself handles everything else — it has its own
memory and skill system.

---

## End-to-end flow in each system

### OpenJiuwen Channels — step by step

```
1. STARTUP
   launcher.py:
     ApplicationBuilder().token(bot_token).build()
     app.bot_data['backend_client'] = OpenJiuwenClient(base_url=...)
     register_handlers(app)   ← CommandHandler + ConversationHandler per feature
     app.run_polling()

2. INCOMING MESSAGE
   Telegram SDK calls the registered handler function.
   e.g. agents_list_handler(update, context)

3. FROM TELEGRAM TO CODE (3 lines — identical in every handler)
   user_id  = update.effective_user.id
   chat_id  = update.effective_chat.id
   text     = update.message.text or ""

4. ACCESS CONTROL — @require_login decorator
   token = get_user_token(user_id)       ← read from .json file on disk
   if not token: reply "please /login"
   async with context.user_data['_refresh_lock']:
       user_client = context.user_data.get('backend_client') or create_client()
       user_client.set_token(token)
       ok, _ = verify_and_refresh(user_client, user_id, refresh_token)
       if not ok: reply "session expired"

5. BUSINESS LOGIC
   result = list_agents(backend_client)  ← HTTP POST to OpenJiuwen backend
   # or: execute_agent(client, agent_id, message)
   # or: execute_workflow(client, workflow_id, inputs)

6. MULTI-TURN FLOWS (login, workflow param collection)
   ConversationHandler manages state across multiple messages:
     State LOGIN_USERNAME → collect username
     State LOGIN_PASSWORD → collect password → call do_login()
     State WF_EXEC_COLLECTING → collect each parameter → execute_workflow()

7. STATE STORAGE
   Per-user data in context.user_data (Telegram-managed dict):
     context.user_data['backend_client'] = user_client
     context.user_data['agent_chat'] = {agent_id, conversation_id}
     context.user_data['wf_exec_session'] = ParamCollectionSession(...)
   Tokens persisted to disk: platforms/telegram/.telegram_bot_tokens.json

8. REPLY
   await update.message.reply_text(message, parse_mode='Markdown')
```

### JiuwenClaw — step by step

```
1. STARTUP
   TelegramChannel.__init__():
     _application = None
     _chat_sessions: dict[int, str] = {}   ← chat_id → session_id

   TelegramChannel.start():
     Application.builder().token(bot_token).build()
     add_handler(CommandHandler("start", _start_command))
     add_handler(CommandHandler("help", _help_command))
     add_handler(MessageHandler(TEXT & ~COMMAND, _handle_message))
     application.updater.start_polling(drop_pending_updates=True)
     while self._running: await asyncio.sleep(1)

2. INCOMING FREE-TEXT MESSAGE
   Telegram SDK calls _handle_message(update, context)

3. FROM TELEGRAM TO CODE
   user_id    = update.effective_user.id
   chat_id    = update.effective_chat.id
   message_id = update.message.message_id
   text       = update.message.text or ""

4. ACCESS CONTROL — allowlist check
   if not self.is_allowed(str(user_id)): return   ← simple set membership

5. GROUP CHAT HANDLING
   is_group = update.effective_chat.type in ["group", "supergroup"]
   if is_group:
       if mode == "off": return
       if mode == "mention":
           if f"@{bot_username}" not in text: return
           text = text.replace(f"@{bot_username}", "").strip()
       if mode == "reply":
           if not update.message.reply_to_message: return
           if reply_to.from_user.id != context.bot.id: return

6. PROCESSING FEEDBACK
   await update.message.set_reaction("👀")   ← immediate visual feedback

7. MESSAGE WRAPPING
   session_id = _chat_sessions.get(chat_id) or f"telegram_{chat_id}"
   msg = Message(
       id=str(message_id),
       type="req",
       channel_id="telegram",
       session_id=session_id,
       params={"content": text, "query": text},
       timestamp=time.time(),
       ok=True,
       req_method=ReqMethod.CHAT_SEND,
       metadata={chat_id, user_id, message_id, username, is_group_chat}
   )

8. ROUTING TO AGENT
   if self._on_message_cb:
       await self._on_message_cb(msg)         ← custom callback
   else:
       await self.bus.route_user_message(msg)  ← onto RobotMessageRouter queue

   JiuwenClaw ChannelManager picks it up → ReAct agent → reply sent via send()

9. REPLY (send method)
   chat_id = msg.metadata["chat_id"]   ← extracted from the Message object
   try:
       await bot.send_message(chat_id, content, parse_mode=parse_mode)
   except ParseError:
       await bot.send_message(chat_id, content, parse_mode=None)  ← fallback
```

---

## Structural differences at each stage

| Stage | OpenJiuwen Channels | JiuwenClaw |
|---|---|---|
| **Startup** | `ApplicationBuilder` + `register_handlers()` + `run_polling()` | Same init, but manual `while self._running` loop |
| **Handler registration** | `CommandHandler` + `MessageHandler` per feature (auth, agents, workflows, general) | 2 `CommandHandler`s + 1 catch-all `MessageHandler` |
| **From Telegram to code** | `user_id`, `chat_id`, `text` — 3 identical lines | Same 3 lines + `message_id`, `username` |
| **Access control** | `@require_login`: JWT token from disk, verify, refresh | `is_allowed()`: set membership check |
| **Group chat** | Not handled — private chats only | 20-line mode handler (off/mention/reply/all) |
| **Processing feedback** | Sends "🤖 Processing..." text | Sets 👀 reaction on original message |
| **Message destination** | Calls `connect.client.*` HTTP functions directly | Wraps into `Message`, puts on async queue |
| **Multi-turn state** | `ConversationHandler` + `context.user_data` | No `ConversationHandler` — agent memory handles context |
| **Token persistence** | JSON file on disk per platform | No tokens — single allowlist |
| **Reply sending** | `update.message.reply_text(text, parse_mode='Markdown')` | `bot.send_message()` with parse_mode fallback |

---

## The "from Telegram to code" boundary specifically

The user question was whether the boundary between Telegram and application code is shareable.

Here is that boundary in full, for a typical OpenJiuwen handler:

```python
# In every OpenJiuwen Telegram handler — these 3 lines are the entire boundary:
user_id = update.effective_user.id
chat_id = update.effective_chat.id
text    = update.message.text or ""
# After this: @require_login, then connect.client.* HTTP calls
```

And in JiuwenClaw's `_handle_message`:

```python
# JiuwenClaw adds 2 more fields:
user_id    = update.effective_user.id
chat_id    = update.effective_chat.id
message_id = update.message.message_id
text       = update.message.text or ""
username   = update.effective_user.username
# After this: allowlist check, group chat logic, Message object creation, queue
```

The 3 shared lines (`user_id`, `chat_id`, `text`) are the complete shared surface.
They are not extracted into a function in either system — they are written inline in
each handler. Extracting them would save 3 lines and add indirection.

Everything after those 3 lines diverges immediately and incompatibly.

---

## Why keep them separate

**1. Different jobs.**
OpenJiuwen Telegram is a command menu for a remote API platform. JiuwenClaw Telegram is a
conversation pipe to an integrated AI. They serve fundamentally different user experiences.

**2. Incompatible message routing.**
OpenJiuwen handlers call HTTP functions and reply directly. JiuwenClaw wraps messages into objects
and puts them on an async queue for a channel manager to process. These cannot share a
handler without redesigning one system.

**3. Different auth models.**
OpenJiuwen: per-user JWT tokens, login flow, refresh, disk storage.
JiuwenClaw: allowlist or open. No common ground to extract.

**4. Different state machines.**
OpenJiuwen uses `ConversationHandler` for multi-step flows (login, workflow parameter collection).
JiuwenClaw has no `ConversationHandler` — the AI's own memory handles context across turns.

**5. Different repositories and lifecycles.**
These are separate products with separate release cycles. Creating a shared Telegram library
would add cross-repo dependency for ~3 lines of SDK attribute access.

**6. The actual shared surface is 3 lines.**
That's not an abstraction — it's the SDK itself.

---

## What OpenJiuwen could borrow from JiuwenClaw (copy, not share)

Three patterns in JiuwenClaw are genuinely useful and missing from OpenJiuwen. They are small enough
to copy directly — no shared library needed.

### 1. Group chat mode handling (~20 lines)

JiuwenClaw cleanly supports group chats with configurable behaviour.
OpenJiuwen currently ignores all group chat messages.

```python
# Worth copying into OpenJiuwen's _handle_message equivalent
is_group = update.effective_chat.type in ["group", "supergroup"]
if is_group:
    if group_mode == "off":
        return
    if group_mode == "mention":
        if f"@{bot_username}" not in text:
            return
        text = text.replace(f"@{bot_username}", "").strip()
    elif group_mode == "reply":
        if not update.message.reply_to_message:
            return
        if update.message.reply_to_message.from_user.id != context.bot.id:
            return
```

### 2. send_message with parse_mode fallback (~10 lines)

JiuwenClaw retries without `parse_mode` when Markdown parsing fails.
OpenJiuwen handlers can crash on malformed Markdown in agent responses.

```python
# Worth adding to OpenJiuwen's reply helpers
try:
    await bot.send_message(chat_id=chat_id, text=content, parse_mode=parse_mode)
except Exception as send_error:
    if parse_mode and ("parse" in str(send_error).lower() or "entity" in str(send_error).lower()):
        await bot.send_message(chat_id=chat_id, text=content, parse_mode=None)
    else:
        raise
```

### 3. Processing reaction instead of text (~5 lines)

JiuwenClaw sets a 👀 emoji reaction on the incoming message immediately.
OpenJiuwen sends "Processing..." as a new text message, which is more disruptive.

```python
# Worth replacing OpenJiuwen's "🤖 Processing..." sends with:
try:
    await update.message.set_reaction("👀")
except Exception:
    pass  # reaction not supported in all chat types — safe to ignore
```

---

## Summary

| Question | Answer |
|---|---|
| Should they share a codebase? | No |
| Is there a meaningful shared layer? | No — the boundary is 3 lines of SDK attribute access |
| Is there anything worth copying? | Yes — group chat mode, parse_mode fallback, reaction feedback |
| Is a shared Telegram library justified? | Not for 3 lines and 2 independent product repos |
