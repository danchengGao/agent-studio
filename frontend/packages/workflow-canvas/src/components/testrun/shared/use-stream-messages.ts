/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useState, useRef, useEffect } from 'react'

import { StreamResponse } from '../runtime/types'

interface StreamMessageData {
  message: string
  nodeName: string
}

export function useStreamMessages() {
  const [messages, setMessages] = useState<Map<string, StreamMessageData>>(new Map())
  const refs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    messages.forEach((_, nodeId) => {
      const ref = refs.current.get(nodeId)
      if (ref) {
        ref.scrollTop = ref.scrollHeight
      }
    })
  }, [messages])

  const handleStreamEvent = (event: StreamResponse) => {
    if (event.type === 'stream_message' && event.data) {
      if (event.data.type === 'workflow' && event.data.payload?.node_id) {
        const nodeId = event.data.payload.node_id
        const nodeName = event.data.payload.node_name || event.data.payload.node_id
        const output = event.data.payload.output || ''

        setMessages(prev => {
          const newMap = new Map(prev)
          const currentData = newMap.get(nodeId) || { message: '', nodeName }
          newMap.set(nodeId, {
            message: currentData.message + output,
            nodeName: nodeName,
          })
          return newMap
        })
      }
    }

    if (event.type === 'completed' || event.type === 'error') {
      setMessages(new Map())
    }
  }

  const clearMessages = () => setMessages(new Map())

  const setRef = (nodeId: string, element: HTMLDivElement | null) => {
    if (element) {
      refs.current.set(nodeId, element)
    } else {
      refs.current.delete(nodeId)
    }
  }

  return {
    messages,
    handleStreamEvent,
    clearMessages,
    setRef,
  }
}
