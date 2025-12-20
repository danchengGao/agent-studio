import { Markdown } from '@test-agentstudio/base-ui'
import type { ChatMessage } from './chatTypes'

export function ErrorMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="p-3 rounded-xl shadow-sm overflow-x-hidden bg-red-50 border-2 border-red-200 text-red-800">
      <Markdown
        content={message.content}
        className="prose prose-sm max-w-none prose-red prose-headings:text-red-900 prose-p:text-red-800 prose-strong:text-red-900"
      />
    </div>
  )
}
