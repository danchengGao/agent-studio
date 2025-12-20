import { create } from 'zustand'
import { getSearchMode } from '../utils/localStorage'

// 定义消息类型
export interface Message {
  id: string
  content: string
  isUser: boolean
  role?: string
  relatedToId?: string
  event?: string
  agent?: string
  finishReason?: string
}

// 定义消息Map类型
type MessageMap = Map<string, Message>

export interface DisplayMessage {
  messages: Message[] // 存储所有消息，包括用户输入和系统响应
  isSearchMode: boolean
  finishState?: string // 新增字段，记录单条数据是否正在加载中
}

type DisplayMessageMap = Map<string, DisplayMessage>

interface MessageState {
  messages: MessageMap
  isLoading: boolean
  messageIdToRunIdMap: Map<string, string> // 消息ID到运行ID的映射
  displayMessages: DisplayMessageMap // 显示消息Map
  selectedResultMessageId: string | null // 存储当前选中的结果消息ID，有值时显示右侧面板
}

interface MessageActions {
  addUserMessage: (content: string, isSearchMode?: boolean) => Message
  addSystemMessage: (content: string, relatedToId: string, event?: string, agent?: string, finishReason?: string, id?: string) => Message
  updateMessage: (message: Message) => void
  setLoading: (loading: boolean) => void
  currentSystemMessageId: string | null
  setCurrentSystemMessageId: (id: string | null) => void
  getMessageByRunId: (runId: string) => Message | undefined
  addMessageIdToRunIdMapping: (messageId: string, runId: string) => void
  removeMessageIdToRunIdMapping: (messageId: string) => void
  setSelectedResultMessageId: (id: string | null) => void // 设置当前选中的结果消息ID，有值时显示右侧面板
  setConversationFinish: (conversationId: string, finishState: string) => void // 设置特定对话的完成状态
}

// 流数据接口
export interface StreamData {
  id: string
  content?: string
  agent?: string
  finish_reason?: string
}

export const useMessageStore = create<MessageState & MessageActions>()((set, get) => ({
  messages: new Map(),
  isLoading: false,
  currentSystemMessageId: null,
  messageIdToRunIdMap: new Map(),
  displayMessages: new Map(),
  selectedResultMessageId: null, // 默认没有选中的结果消息ID，有值时显示右侧面板

  addUserMessage: (content: string, isSearchMode: boolean = getSearchMode()) => {
    const message: Message = {
      id: Date.now().toString(),
      content,
      isUser: true,
    }

    set(state => {
      const newMessages = new Map(state.messages)
      newMessages.set(message.id, message)
      // 同时添加到displayMessages
      const newDisplayMessages = new Map(state.displayMessages)
      newDisplayMessages.set(message.id, {
        messages: [message],
        isSearchMode: isSearchMode,
      })
      return {
        messages: newMessages,
        displayMessages: newDisplayMessages,
      }
    })

    return message
  },

  addSystemMessage: (content: string, relatedToId: string, event?: string, agent?: string, finishReason?: string, id?: string) => {
    const message: Message = {
      relatedToId,
      id: id || (Date.now() + 1).toString(),
      content,
      isUser: false,
      event,
      agent,
      finishReason,
    }

    set(state => {
      const newMessages = new Map(state.messages)
      newMessages.set(message.id, message)
      // 同时添加到displayMessages
      const newDisplayMessages = new Map(state.displayMessages)
      // 同时更新displayMessages
      if (newDisplayMessages.has(relatedToId)) {
        const currentDisplayMessage = newDisplayMessages.get(relatedToId)!
        newDisplayMessages.set(relatedToId, {
          messages: [...currentDisplayMessage.messages, message],
          isSearchMode: currentDisplayMessage.isSearchMode,
        })
      }
      return { messages: newMessages, displayMessages: newDisplayMessages }
    })

    return message
  },

  updateMessage: (message: Message) => {
    set(state => {
      const newMessages = new Map(state.messages)
      const messageToUpdate = newMessages.get(message.id)

      if (messageToUpdate) {
        const updatedMessage = {
          ...messageToUpdate,
          content: message.content,
          event: message.event || messageToUpdate.event,
          agent: message.agent || messageToUpdate.agent,
          finishReason: message.finishReason || messageToUpdate.finishReason,
        }
        newMessages.set(message.id, updatedMessage)
        // 同时更新displayMessages
        const newDisplayMessages = new Map(state.displayMessages)
        if (newDisplayMessages.has(messageToUpdate.relatedToId!)) {
          const currentDisplayMessage = newDisplayMessages.get(messageToUpdate.relatedToId!)!

          // 更新消息数组中的对应消息
          const updatedMessages = currentDisplayMessage.messages.map(msg => (msg.id === updatedMessage.id ? updatedMessage : msg))

          newDisplayMessages.set(messageToUpdate.relatedToId!, {
            messages: updatedMessages,
            isSearchMode: currentDisplayMessage.isSearchMode,
          })
        }
        return { messages: newMessages, displayMessages: newDisplayMessages }
      }

      return state
    })
  },

  setLoading: (isLoading: boolean) => set({ isLoading }),
  setCurrentSystemMessageId: (id: string | null) => {
    set({ currentSystemMessageId: id })
  },
  getMessageByRunId: (runId: string) => {
    const state = get()
    // 查找与此运行ID关联的消息
    for (const [messageId, storedRunId] of state.messageIdToRunIdMap.entries()) {
      if (storedRunId === runId) {
        return state.messages.get(messageId)
      }
    }
    return undefined
  },
  addMessageIdToRunIdMapping: (messageId: string, runId: string) => {
    set(state => ({
      messageIdToRunIdMap: new Map(state.messageIdToRunIdMap).set(messageId, runId),
    }))
  },
  removeMessageIdToRunIdMapping: (messageId: string) => {
    set(state => {
      const newMap = new Map(state.messageIdToRunIdMap)
      newMap.delete(messageId)
      return { messageIdToRunIdMap: newMap }
    })
  },

  // 设置当前选中的结果消息ID，有值时显示右侧面板
  setSelectedResultMessageId: (id: string | null) => {
    set({ selectedResultMessageId: id })
  },

  // 设置特定对话的完成状态
  setConversationFinish: (conversationId: string, finishState: string) => {
    set(state => {
      const newDisplayMessages = new Map(state.displayMessages)
      if (newDisplayMessages.has(conversationId)) {
        const currentDisplayMessage = newDisplayMessages.get(conversationId)!
        newDisplayMessages.set(conversationId, {
          ...currentDisplayMessage,
          finishState,
        })
      }
      return { displayMessages: newDisplayMessages }
    })
  },
}))
