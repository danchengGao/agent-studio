import { memo } from 'react'
import type { ChatMessage } from './chatTypes'
import { NormalMessage } from './NormalMessage'
import { ErrorMessage } from './ErrorMessage'
import { InteractionMessage } from './InteractionMessage'

export const MessageRenderer = memo(function MessageRenderer({
  message,
  onSubmitInteraction,
  interactionDisabled,
  inputFocused,
}: {
  message: ChatMessage
  onSubmitInteraction?: (value: string, ts: number) => void
  interactionDisabled?: boolean
  inputFocused?: boolean
}) {
  if (message.kind === 'error') return <ErrorMessage message={message} />
  if (message.kind === 'interaction')
    return <InteractionMessage message={message} onSubmit={onSubmitInteraction} disabled={interactionDisabled} inputFocused={inputFocused} />
  if (message.kind === 'opening') return <NormalMessage message={message} />
  return <NormalMessage message={message} />
})
