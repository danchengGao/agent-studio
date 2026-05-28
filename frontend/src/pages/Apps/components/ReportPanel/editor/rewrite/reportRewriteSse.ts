export type ReportRewriteSseEvent = {
  agent?: string
  content?: unknown
}

export function consumeReportRewriteSseChunk(params: {
  buffer: string
  chunkText: string
  flush: boolean
}): {
  buffer: string
  events: ReportRewriteSseEvent[]
} {
  const nextBuffer = params.buffer + params.chunkText
  const lines = nextBuffer.split('\n')
  const trailingBuffer = params.flush ? '' : lines.pop() || ''
  const events: ReportRewriteSseEvent[] = []
  const consumableLines = params.flush ? lines.concat(trailingBuffer ? [trailingBuffer] : []) : lines

  for (const line of consumableLines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) {
      continue
    }

    const jsonStr = trimmed.slice(5).trim()
    if (!jsonStr || jsonStr === '[DONE]') {
      continue
    }

    try {
      events.push(JSON.parse(jsonStr))
    } catch {
      // Ignore malformed event payloads and let callers decide whether to log.
    }
  }

  return {
    buffer: trailingBuffer,
    events,
  }
}
