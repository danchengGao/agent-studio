/**
 * 聊天 UI（仅 AG-UI 模式）：
 * 使用 assistant-ui 内置的 AG-UI runtime（`useAgUiRuntime`）自动完成“发送 + 解析 AG-UI SSE 事件 + 状态管理”，
 * 父页面只需要提供 endpoint、鉴权 header 和请求体映射。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActionBarPrimitive,
  AssistantRuntimeProvider,
  ComposerPrimitive,
  ThreadPrimitive,
} from '@assistant-ui/react'
import { useAui, useAuiState } from '@assistant-ui/store'
import { useActionBarCopy, useMessageError } from '@assistant-ui/core/react'
import { ExportedMessageRepository, type ThreadMessageLike } from '@assistant-ui/core'
import { useAgUiRuntime } from '@assistant-ui/react-ag-ui'
import { AssistantActionBar, AssistantMessage, BranchPicker, Thread, UserMessage, useThreadConfig } from '@assistant-ui/react-ui'
import { HttpAgent } from '@ag-ui/client'
import { Copy as CopyIcon, Send, Square, Trash2 } from 'lucide-react'
import type { SnackbarMessage } from '@/Common/UnifiedSnackbar'
import { copyToClipboard } from '@/utils/prompts/utils'
import newDialogIcon from '@/assets/icons/runtime-gen-new-dialog.svg'
import './chat.css'


/** react-ag-ui 在 RUN_ERROR 后仍会走 RUN_FINISHED，把消息标成 complete，导致 useMessageError() 为空；在此捕获 RUN_ERROR 供 UI 兜底展示 */
export type AgUiStreamRunError = { message: string; code?: string }

function wrapAgUiSubscriberCaptureRunError(
  subscriber: unknown,
  bridgeRef: {
    current: {
    onRunError: (message: string, code?: string) => void
    onRunStarted: () => void
    }
  },
): unknown {
  if (subscriber == null || typeof subscriber !== 'object') return subscriber
  const s = subscriber as { onEvent?: (payload: unknown) => unknown }
  const origOnEvent = s.onEvent
  if (typeof origOnEvent !== 'function') return subscriber
  return {
    ...s,
    onEvent: (payload: unknown) => {
      const ev =
        payload && typeof payload === 'object' && 'event' in payload
          ? (payload as { event?: unknown }).event
          : undefined
      if (ev && typeof ev === 'object') {
        const o = ev as Record<string, unknown>
        if (o.type === 'RUN_ERROR') {
          const msg = typeof o.message === 'string' ? o.message : String(o.message ?? '')
          const code = o.code != null ? String(o.code) : undefined
          bridgeRef.current.onRunError(msg, code)
        }
        if (o.type === 'RUN_STARTED') {
          bridgeRef.current.onRunStarted()
        }
      }
      return origOnEvent.call(s, payload)
    },
  }
}

const NewChatActionContext = createContext<undefined | (() => Promise<boolean | void>)>(undefined)

type AgUiRunErrorContextValue = {
  latest: AgUiStreamRunError | null
  pinnedByMessageId: Record<string, string>
  pinForMessage: (messageId: string, text: string) => void
}

const AgUiStreamRunErrorContext = createContext<AgUiRunErrorContextValue>({
  latest: null,
  pinnedByMessageId: {},
  pinForMessage: () => {},
})

function reseedThreadMessagesForReset(messages: readonly any[]): readonly any[] {
  // `thread.reset()` 会把传入的消息“当作新会话初始消息”重新建图。
  // 但 thread.getState().messages 里包含 assistant-ui 内部的隐藏字段（例如 symbol 属性），
  // 直接把它们塞回 reset 可能导致分支/父子关联残留，进而出现 BranchPicker 错乱。
  // 这里把消息“摘干净”成 ThreadMessageLike，并重新生成 id，确保 reset 后是线性的干净线程。
  const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)

  return messages.map((m: any) => {
    const base: any = {
      id: newId(),
      role: m.role,
      createdAt: m.createdAt,
      content: m.content,
      metadata: m.metadata,
    }
    if (m.role === 'assistant') base.status = m.status
    if (m.role === 'user') base.attachments = m.attachments
    return base as ThreadMessageLike
  })
}

function setComposerTextSafe(composer: unknown, text: string): void {
  const c = composer as any
  if (!c) return
  if (typeof c.setText === 'function') {
    c.setText(text)
    return
  }
  if (typeof c.setValue === 'function') {
    c.setValue(text)
    return
  }
  if (typeof c.setDraft === 'function') {
    c.setDraft(text)
    return
  }
  if (typeof c.update === 'function') {
    c.update({ text })
  }
}

function extractMessageText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part: any) => {
        if (typeof part === 'string') return part
        if (part && typeof part.text === 'string') return part.text
        if (part && typeof part.value === 'string') return part.value
        return ''
      })
      .join('')
  }
  if (content && typeof (content as any).text === 'string') return (content as any).text
  return ''
}

/** 统一错误条文案：有 code 时为「错误 0101：说明」，否则为「错误：说明」 */
function formatErrorBannerLine(
  code: string | undefined,
  message: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const m = (message ?? '').trim()
  if (!m) return ''
  const errorLabel = t('runtime.publish.chat.errorLabel')
  const c = code != null ? String(code).trim() : ''
  if (c) return `${errorLabel} ${c}：${m}`
  return `${errorLabel}：${m}`
}

/** AG-UI RUN_ERROR 写入 message.status.error，不一定是 string；统一成可展示文案 */
function formatAssistantRunError(error: unknown): string {
  if (error == null) return ''
  if (typeof error === 'string') return error
  if (typeof error === 'number' || typeof error === 'boolean') return String(error)
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

function normalizeAssistantStatusAfterCancel(message: any): any {
  if (message?.role !== 'assistant') return message

  const status = message?.status
  if (!status) return message

  const cancelledStatus = { type: 'incomplete', reason: 'cancelled' as const }

  if (typeof status === 'string') {
    const normalized = status.toLowerCase()
    if (normalized === 'running' || normalized === 'in_progress' || normalized === 'inprogress' || normalized === 'streaming') {
      return { ...message, status: cancelledStatus }
    }
    return message
  }

  if (typeof status === 'object') {
    const type = String((status as any).type ?? '').toLowerCase()
    if (type && type !== 'complete' && type !== 'incomplete') {
      return { ...message, status: cancelledStatus }
    }
  }

  return message
}

/**
 * 注意：这些组件必须放在模块顶层，保证引用稳定。
 * 否则流式更新时父组件反复 render 会导致消息组件被卸载/重挂，产生“内容闪烁”。
 */
const ExtendedAssistantActionBar = () => {
  const aui = useAui()
  const { t } = useTranslation()
  const thread = aui.thread()
  const composer = useAuiState((s) => s.thread.composer)
  const message = useAuiState((s) => s.message)
  const messageRuntime = aui.message()
  const runError = useMessageError()
  const { pinnedByMessageId } = useContext(AgUiStreamRunErrorContext)

  const setSnackbarGlobal = useCallback((snackbar: SnackbarMessage) => {
    // 通过全局事件让外层页面的 <UnifiedSnackbar /> 展示提示
    window.dispatchEvent(
      new CustomEvent('global-snackbar', {
        detail: {
          message: snackbar.message,
          severity: snackbar.severity,
          duration: snackbar.duration ?? 3000,
        },
      }),
    )
  }, [])

  // 复用 assistant-ui 的 copy 逻辑（从当前 assistant 消息/编辑器拿到正确的文本），
  // 但写入剪贴板仍交给项目内的 copyToClipboard（带 snackbar 反馈与兼容处理）。
  const { copy: copyAction, disabled: copyDisabled } = useActionBarCopy({
    copiedDuration: 3000,
    copyToClipboard: (text: string) => copyToClipboard(text, setSnackbarGlobal),
  })

  const runtimeCopyText = (messageRuntime.getCopyText?.() || '').trim()
  const runErrorBody = runError !== undefined ? formatAssistantRunError(runError) : ''
  const runErrorText = runErrorBody ? formatErrorBannerLine(undefined, runErrorBody, t) : ''
  const pinnedErrorText = pinnedByMessageId[message.id] || ''
  const fallbackErrorCopyText = pinnedErrorText || runErrorText
  // useActionBarCopy 的 disabled 在无正文 text part 时为 true（错误气泡不算 parts），不能与错误回退复制一起 AND
  const canCopy = (Boolean(runtimeCopyText) && !copyDisabled) || Boolean(fallbackErrorCopyText)

  const handleCopy = () => {
    if (runtimeCopyText) {
      copyAction?.()
      return
    }
    if (fallbackErrorCopyText) {
      void copyToClipboard(fallbackErrorCopyText, setSnackbarGlobal)
    }
  }

  const handleFollowUp = () => {
    const base = (messageRuntime.getCopyText?.() || '').trim()
    const nextText = base
      ? t('runtime.publish.chat.followUpWithReference', { reference: base })
      : t('runtime.publish.chat.followUp')
    setComposerTextSafe(composer, nextText)
  }

  const handleDelete = () => {
    const state = thread.getState()
    const aiIdx = message.index
    const msgs = state.messages

    // 找到与该 AI 回复“对应”的用户消息：向前回溯最近的一条 user
    let userIdx = -1
    for (let i = aiIdx - 1; i >= 0; i--) {
      if (msgs[i]?.role === 'user') {
        userIdx = i
        break
      }
    }
    if (userIdx < 0) return

    const remaining = msgs.filter((_, idx) => idx !== userIdx && idx !== aiIdx)
    thread.reset(reseedThreadMessagesForReset(remaining))
  }

  return (
    <AssistantActionBar.Root
      hideWhenRunning
      autohide="not-last"
      autohideFloat="single-branch"
      className="agentstudio-ai-actionbar"
    >
      <AssistantActionBar.Reload />

      <button
        type="button"
        className="aui-button aui-button-ghost aui-button-icon"
        onClick={handleCopy}
        disabled={!canCopy}
        title={t('common.buttons.copy')}
      >
        <CopyIcon />
      </button>

      <ActionBarPrimitive.Root asChild>
        <button type="button" className="aui-button aui-button-ghost aui-button-icon" onClick={handleDelete} title={t('common.buttons.delete')}>
          <Trash2 />
        </button>
      </ActionBarPrimitive.Root>
    </AssistantActionBar.Root>
  )
}

const CustomAssistantMessage = () => {
  const { t } = useTranslation()
  const message = useAuiState((s) => s.message)
  const runError = useMessageError()
  const { latest: streamRunError, pinnedByMessageId, pinForMessage } = useContext(AgUiStreamRunErrorContext)
  const isLastAssistantInThread = useAuiState((s) => {
    const msgs = s.thread.messages
    const idx = msgs.findIndex((m) => m.id === message.id)
    if (idx < 0 || msgs[idx]?.role !== 'assistant') return false
    for (let j = idx + 1; j < msgs.length; j++) {
      if (msgs[j]?.role === 'assistant') return false
    }
    return true
  })

  const dividerLabel = t('runtime.publish.chat.newChatDivider')
  const messageText =
    message.role === 'assistant' ? extractMessageText(message.content).trim() : ''
  const isNewChatDivider =
    message.role === 'assistant' &&
    ((message.metadata as { agentstudio?: { type?: string } } | undefined)?.agentstudio?.type === 'new_chat_divider' ||
      messageText === dividerLabel)

  if (message.role !== 'assistant') return null

  if (isNewChatDivider) {
    const label = messageText || dividerLabel
    return (
      <div className="agentstudio-chat-divider" role="separator" aria-label={label}>
        <span>{label}</span>
      </div>
    )
  }

  const threadConfig = useThreadConfig()
  const assistantName = threadConfig.assistantAvatar?.alt ?? ''
  const runErrorBody = runError !== undefined ? formatAssistantRunError(runError) : ''
  const runErrorText = runErrorBody ? formatErrorBannerLine(undefined, runErrorBody, t) : ''
  const statusType =
    message.status && typeof message.status === 'object' && 'type' in message.status
      ? String((message.status as { type?: string }).type ?? '')
      : ''
  const showStreamRunErrorFallback =
    !!streamRunError &&
    isLastAssistantInThread &&
    messageText === '' &&
    (statusType === 'complete' || statusType === 'incomplete' || statusType === 'running')
  const streamFallbackText =
    showStreamRunErrorFallback && streamRunError
      ? formatErrorBannerLine(streamRunError.code, streamRunError.message, t)
      : ''
  const pinnedErrorText = pinnedByMessageId[message.id] || ''
  const errorBannerText = pinnedErrorText || runErrorText || streamFallbackText

  useEffect(() => {
    if (!streamFallbackText || !message.id) return
    if (pinnedByMessageId[message.id]) return
    pinForMessage(message.id, streamFallbackText)
  }, [message.id, streamFallbackText, pinnedByMessageId, pinForMessage])
  const errorOnlyAssistantBubble = Boolean(errorBannerText && !messageText)
  return (
    <AssistantMessage.Root data-assistant-name={assistantName}>
      <AssistantMessage.Avatar />
      <div
        className={
          errorOnlyAssistantBubble
            ? 'agentstudio-assistant-message-stack agentstudio-assistant-message-stack--error-only'
            : 'agentstudio-assistant-message-stack'
        }
      >
        <AssistantMessage.Content data-assistant-name={assistantName} />
        {errorBannerText ? (
          <div className="agentstudio-assistant-run-error" role="alert">
            {errorBannerText}
          </div>
        ) : null}
      </div>
      <BranchPicker />
      <ExtendedAssistantActionBar />
    </AssistantMessage.Root>
  )
}

const CustomUserMessage = () => {
  const message = useAuiState((s) => s.message)
  if (message.role !== 'user') return null
  return (
    <UserMessage.Root>
      <UserMessage.Content />
    </UserMessage.Root>
  )
}

const EmptyStateHero = ({
  assistantIcon,
  assistantName,
  message,
}: {
  assistantIcon?: string
  assistantName?: string
  message: string
}) => {
  const { t } = useTranslation()
  const hasMessages = useAuiState((s) => (s.thread.messages?.length ?? 0) > 0)
  if (hasMessages) return null

  const iconText = (assistantIcon || '').trim() || '🤖'
  const isImageSrc = /^(https?:\/\/|data:image\/|\/)/.test(iconText)

  return (
    <div className="agentstudio-empty-hero" aria-hidden="true">
      <div className="agentstudio-empty-hero-avatar" aria-hidden="true">
        {isImageSrc ? <img src={iconText} alt="" className="agentstudio-empty-hero-avatar-img" /> : <span>{iconText}</span>}
      </div>
      <div className="agentstudio-empty-hero-name">{assistantName || t('runtime.publish.chat.assistantDefaultName')}</div>
      <div className="agentstudio-empty-hero-text">{message}</div>
    </div>
  )
}

const CustomComposer = () => {
  const aui = useAui()
  const { t } = useTranslation()
  const thread = aui.thread()
  const allowCancel = useAuiState((s) => s.thread.capabilities.cancel)
  const onNewChat = useContext(NewChatActionContext)

  const [hasMessages, setHasMessages] = useState(() => (thread.getState()?.messages?.length ?? 0) > 0)

  useEffect(() => {
    let unsub: undefined | (() => void)
    const update = () => {
      setHasMessages((thread.getState()?.messages?.length ?? 0) > 0)
    }
    update()

    const maybeSubscribe = (thread as any)?.subscribe
    if (typeof maybeSubscribe === 'function') {
      unsub = maybeSubscribe.call(thread, update)
      return () => unsub?.()
    }

    const timer = window.setInterval(update, 250)
    return () => window.clearInterval(timer)
  }, [thread])

  const handleNewThread = async () => {
    if (onNewChat) {
      const ok = await onNewChat()
      if (ok === false) return
    }

    const state = thread.getState()
    const msgs = state?.messages ?? []
    if (!msgs.length) return

    const divider = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      role: 'assistant',
      status: 'complete',
      createdAt: new Date(),
      content: t('runtime.publish.chat.newChatDivider'),
      metadata: { agentstudio: { type: 'new_chat_divider' } },
    }

    thread.import(ExportedMessageRepository.fromArray(reseedThreadMessagesForReset([...msgs, divider])))
  }

  const handleCancelFinalize = () => {
    // 对齐官方 runtime 的取消思路：优先触发线程取消，再做状态收敛兜底。
    ;(thread as any)?.cancel?.()

    const finalizeCancelState = () => {
      const state = thread.getState() as any
      const msgs = state?.messages ?? []
      const normalized = msgs.map((m: any) => normalizeAssistantStatusAfterCancel(m))
      const changed = normalized.some((m: any, i: number) => m !== msgs[i])
      if (!changed) return
      thread.import(ExportedMessageRepository.fromArray(reseedThreadMessagesForReset(normalized)))
    }

    finalizeCancelState()
    // 某些流式适配器会晚一个 tick 才把最终事件回写，补两次收敛，避免 UI 卡在 running。
    window.setTimeout(finalizeCancelState, 120)
    window.setTimeout(finalizeCancelState, 500)
  }

  return (
    <ComposerPrimitive.Root className="aui-composer-root">
      <button
        type="button"
        className="agentstudio-composer-newchat"
        onClick={handleNewThread}
        disabled={!hasMessages}
        title={t('runtime.publish.chat.newChat')}
        aria-label={t('runtime.publish.chat.newChat')}
      >
        <img src={newDialogIcon} alt="" className="agentstudio-composer-newchat-icon" aria-hidden="true" />
      </button>
      <ComposerPrimitive.Input className="aui-composer-input" />
      {allowCancel ? (
        <>
          <ThreadPrimitive.If running={false}>
            <ComposerPrimitive.Send className="aui-composer-send" title={t('runtime.publish.chat.send')}>
              <Send />
            </ComposerPrimitive.Send>
          </ThreadPrimitive.If>
          <ThreadPrimitive.If running>
            <ComposerPrimitive.Cancel
              className="aui-composer-cancel"
              title={t('common.buttons.stopResponse')}
              aria-label={t('common.buttons.stopResponse')}
              onClick={handleCancelFinalize}
            >
              <Square />
            </ComposerPrimitive.Cancel>
          </ThreadPrimitive.If>
        </>
      ) : (
        <ComposerPrimitive.Send className="aui-composer-send" title={t('runtime.publish.chat.send')}>
          <Send />
        </ComposerPrimitive.Send>
      )}
    </ComposerPrimitive.Root>
  )
}

export interface AssistantUiChatProps {
  /**
   * AG-UI 配置：组件将接管发送和解析（必填）。
   * - `url`: 后端 AG-UI SSE 端点
   * - `headers`: 额外 header（例如 Authorization）
   * - `buildBody`: 将 RunAgentInput 映射成后端请求体（适配你们的 /execution/agent）
   */
  agUi: {
    url: string
    headers?: Record<string, string>
    buildBody: (input: any) => unknown
  }
  /** 顶部标题（不传则默认「提示词调试」） */
  title?: string
  emptyStateText?: string
  placeholder?: string
  assistantIcon?: string
  assistantName?: string
  userName?: string
  className?: string
  onNewChat?: () => Promise<boolean | void>
}

/**
 * 使用 assistant-ui 拼接的完整聊天面板。
 * 使用 AG-UI runtime（useAgUiRuntime + Thread）。
 */
export function AssistantUiChat({
  agUi,
  title,
  emptyStateText,
  placeholder,
  assistantIcon,
  assistantName,
  userName,
  className = '',
  onNewChat,
}: AssistantUiChatProps) {
  const { t, i18n } = useTranslation()
  const agUiConfigRef = useRef(agUi)
  const [agUiStreamRunError, setAgUiStreamRunError] = useState<AgUiStreamRunError | null>(null)
  const [agUiPinnedRunErrors, setAgUiPinnedRunErrors] = useState<Record<string, string>>({})
  const agUiStreamRunErrorBridgeRef = useRef({
    onRunError: (_message: string, _code?: string) => {},
    onRunStarted: () => {},
  })

  useEffect(() => {
    agUiConfigRef.current = agUi
  }, [agUi])

  useEffect(() => {
    agUiStreamRunErrorBridgeRef.current = {
      onRunError: (message, code) => {
        setAgUiStreamRunError({ message, code })
      },
      onRunStarted: () => {
        // 新一轮仅清理当前运行态错误，不影响历史消息已固定的错误展示
        setAgUiStreamRunError(null)
      },
    }
  }, [])

  const threadComponents = useMemo(
    () => ({ AssistantMessage: CustomAssistantMessage, UserMessage: CustomUserMessage, Composer: CustomComposer }),
    [],
  )

  const agUiAgent = useMemo(() => {
    const bridgeRef = agUiStreamRunErrorBridgeRef
    class ExecutionHttpAgent extends HttpAgent {
      // react-ag-ui 当前实现会以第三个参数传入 { signal }，
      // 但 @ag-ui/client 的 runAgent 期望的是 parameters.abortController。
      // 这里做一层桥接，确保取消信号能真正中断底层流式请求。
      async runAgent(parameters?: any, subscriber?: any, maybeOptions?: any): Promise<any> {
        const params = { ...(parameters || {}) }
        const signal: AbortSignal | undefined = maybeOptions?.signal

        if (signal && !params.abortController) {
          const abortController = new AbortController()
          if (signal.aborted) {
            abortController.abort()
          } else {
            signal.addEventListener('abort', () => abortController.abort(), { once: true })
          }
          params.abortController = abortController
        }

        const captured = wrapAgUiSubscriberCaptureRunError(subscriber, bridgeRef)
        return super.runAgent(params, captured as typeof subscriber)
      }

      protected requestInit(input: any): RequestInit {
        const cfg = agUiConfigRef.current
        const base = super.requestInit(input)
        const language = i18n.language || 'zh-CN'
        const acceptLanguage =
          language === 'en-US'
            ? 'en-US;q=1.0, zh-CN;q=0.5'
            : language === 'zh-CN'
              ? 'zh-CN;q=1.0, en-US;q=0.5'
              : language
        return {
          ...base,
          method: 'POST',
          headers: {
            ...(base?.headers as Record<string, string> | undefined),
            ...(cfg.headers || {}),
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            'Accept-Language': acceptLanguage,
          },
          body: JSON.stringify(cfg.buildBody(input)),
          // 复用 super.requestInit(input) 里的 signal，确保 ComposerPrimitive.Cancel 可中断流式请求
          signal: base?.signal,
        }
      }
    }

    return new ExecutionHttpAgent({ url: agUi.url, headers: agUi.headers })
  }, [agUi.url, i18n.language])

  const agUiRuntime = useAgUiRuntime({
    agent: agUiAgent,
    onCancel: () => {
      try {
        agUiAgent.abortRun()
      } catch {
        // ignore
      }
    },
  })

  return (
    <AssistantRuntimeProvider runtime={agUiRuntime}>
      <AgUiStreamRunErrorContext.Provider
        value={{
          latest: agUiStreamRunError,
          pinnedByMessageId: agUiPinnedRunErrors,
          pinForMessage: (messageId, text) => {
            if (!messageId || !text) return
            setAgUiPinnedRunErrors((prev) => (prev[messageId] ? prev : { ...prev, [messageId]: text }))
          },
        }}
      >
      <NewChatActionContext.Provider value={onNewChat}>
        <div
          className={`agentstudio-chat ${className}`}
          // content: var(--agentstudio-user-name) 需要带引号的字符串形态（如："Tom"）
          style={{ ['--agentstudio-user-name' as any]: JSON.stringify(userName ?? '') } as CSSProperties}
        >
          <div className="agentstudio-chat-thread">
            <div className="agentstudio-chat-title sr-only">{title ?? t('runtime.publish.chat.debugTitle')}</div>
          <EmptyStateHero
            assistantIcon={assistantIcon}
            assistantName={assistantName}
            message={emptyStateText ?? t('runtime.publish.chat.emptyStateText')}
          />
            <Thread
              welcome={{
              message: '',
              }}
              assistantAvatar={{
                fallback: assistantIcon ?? '🤖',
                alt: assistantName ?? '',
              }}
              components={threadComponents}
              strings={{
                composer: { input: { placeholder: placeholder ?? t('runtime.publish.chat.inputPlaceholder') } },
                assistantMessage: {
                  reload: { tooltip: t('common.actions.retry') },
                  copy: { tooltip: t('common.buttons.copy') },
                },
              }}
            />
            <div className="agentstudio-chat-disclaimer">{t('runtime.publish.chat.disclaimer')}</div>
          </div>
        </div>
      </NewChatActionContext.Provider>
      </AgUiStreamRunErrorContext.Provider>
    </AssistantRuntimeProvider>
  )
}
