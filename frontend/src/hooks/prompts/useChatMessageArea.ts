import { useCallback } from 'react'
import type { ChatMessage } from '@/components/Prompts'
import type { ComparisonGroupData, SelectedAiReply, OptimizationSource, OptimizeStep, PromptMessage } from '@/types/promptType'
import type { SnackbarMessage } from '@/Common/UnifiedSnackbar'

// Hook 参数接口
interface UseChatMessageAreaProps {
  // 聊天消息列表（用于单个消息区域时必需，用于群组时可选）
  chatMessages?: ChatMessage[]

  // 状态设置函数（用于单个消息区域时必需）
  setEditingMessage?: (index: number | null) => void
  setEditContent?: (content: string) => void

  // 群组删除消息相关参数（用于群组时必需）
  setComparisonGroupsData?: React.Dispatch<React.SetStateAction<ComparisonGroupData[]>>
  setGroupCompletedMessages?: React.Dispatch<React.SetStateAction<{ [groupId: number]: Set<number> }>>

  // 群组优化AI回复相关参数（用于群组时可选）
  comparisonGroupsData?: ComparisonGroupData[]

  // 主消息区域优化AI回复相关参数（用于主消息区域时可选）
  promptMessages?: PromptMessage[]
  setSnackbar?: (snackbar: SnackbarMessage) => void
  t?: (key: string) => string
  setSelectedAiReply?: React.Dispatch<React.SetStateAction<SelectedAiReply | null>>
  setOptimizationSource?: React.Dispatch<React.SetStateAction<OptimizationSource>>
  setAiReplyOptimizeDialogOpen?: React.Dispatch<React.SetStateAction<boolean>>
  setAiReplyOptimizeStep?: React.Dispatch<React.SetStateAction<OptimizeStep>>
  setOptimizedPromptTemplate?: React.Dispatch<React.SetStateAction<string>>
  setHumanEvaluation?: React.Dispatch<React.SetStateAction<string>>
}

// Hook 返回值接口
interface UseChatMessageAreaReturn {
  handleEditMessage?: (index: number) => void
  handleDeleteMessage?: (groupId: number, index: number) => void
  handleOptimizeAiReplyDialog?: (groupId: number, index: number) => void
  handleOptimizeAiReply?: (messageIndex: number) => void
}

export const useChatMessageArea = ({
  chatMessages,
  setEditingMessage,
  setEditContent,
  setComparisonGroupsData,
  setGroupCompletedMessages,
  comparisonGroupsData,
  promptMessages,
  setSnackbar,
  t,
  setSelectedAiReply,
  setOptimizationSource,
  setAiReplyOptimizeDialogOpen,
  setAiReplyOptimizeStep,
  setOptimizedPromptTemplate,
  setHumanEvaluation,
}: UseChatMessageAreaProps): UseChatMessageAreaReturn => {
  // 处理编辑消息
  const handleEditMessage = useCallback(
    (index: number) => {
      if (!chatMessages || !setEditingMessage || !setEditContent) return
      const message = chatMessages[index]
      if (!message) return

      // 直接进入行内编辑模式
      setEditingMessage(index)
      setEditContent(message.content)
    },
    [chatMessages, setEditingMessage, setEditContent],
  )

  // 处理删除群组消息
  const handleDeleteMessage = useCallback(
    (groupId: number, index: number) => {
      if (!setComparisonGroupsData || !setGroupCompletedMessages) return

      setComparisonGroupsData(prev =>
        prev.map(group =>
          group.id === groupId
            ? {
                ...group,
                chatMessages: group.chatMessages.filter((_, i) => i !== index),
              }
            : group,
        ),
      )

      setGroupCompletedMessages(prev => {
        const groupCompleted = prev[groupId] || new Set()
        const newSet = new Set(groupCompleted)
        newSet.delete(index)
        // 重新编号后续消息的完成状态
        const reindexedSet = new Set<number>()
        newSet.forEach(msgIndex => {
          if (msgIndex > index) {
            reindexedSet.add(msgIndex - 1)
          } else if (msgIndex < index) {
            reindexedSet.add(msgIndex)
          }
        })
        return {
          ...prev,
          [groupId]: reindexedSet,
        }
      })
    },
    [setComparisonGroupsData, setGroupCompletedMessages],
  )

  // 处理优化AI回复对话框
  const handleOptimizeAiReplyDialog = useCallback(
    (groupId: number, index: number) => {
      if (
        !comparisonGroupsData ||
        !setSnackbar ||
        !t ||
        !setSelectedAiReply ||
        !setOptimizationSource ||
        !setAiReplyOptimizeDialogOpen ||
        !setAiReplyOptimizeStep ||
        !setOptimizedPromptTemplate ||
        !setHumanEvaluation
      )
        return

      const group = comparisonGroupsData.find(g => g.id === groupId)
      if (!group) return

      // 找到对应的AI回复消息
      const aiMessage = group.chatMessages[index]
      if (!aiMessage || aiMessage.type !== 'ai') return

      // 检查第一个system提示词是否为空
      const firstSystemMessage = group.messages.find(msg => msg.role === 'system')
      if (!firstSystemMessage || !firstSystemMessage.content || firstSystemMessage.content.trim() === '') {
        setSnackbar({ open: true, message: t('components.prompts.promptEditPage.targetPromptEmpty'), severity: 'warning' })
        return
      }

      let userQuestion = ''

      // 找到对应的用户问题（前一条用户消息）
      for (let i = index - 1; i >= 0; i--) {
        if (group.chatMessages[i].type === 'user') {
          userQuestion = group.chatMessages[i].userInput || group.chatMessages[i].content
          break
        }
      }

      // 设置选中的AI回复数据
      setSelectedAiReply({
        userQuestion,
        aiResponse: aiMessage.content,
        messageIndex: index,
      })

      // 设置优化源（基准组用'base'，对照组用'control'）
      if (groupId === 0) {
        setOptimizationSource({ type: 'base' })
      } else {
        setOptimizationSource({ type: 'control', groupId })
      }

      // 打开AI回复优化对话框
      setAiReplyOptimizeDialogOpen(true)
      setAiReplyOptimizeStep('input')
      setOptimizedPromptTemplate('')
      setHumanEvaluation('')
    },
    [
      comparisonGroupsData,
      setSnackbar,
      t,
      setSelectedAiReply,
      setOptimizationSource,
      setAiReplyOptimizeDialogOpen,
      setAiReplyOptimizeStep,
      setOptimizedPromptTemplate,
      setHumanEvaluation,
    ],
  )

  // 处理优化AI回复（用于主消息区域）
  const handleOptimizeAiReply = useCallback(
    (messageIndex: number) => {
      if (
        !chatMessages ||
        !promptMessages ||
        !setSnackbar ||
        !t ||
        !setSelectedAiReply ||
        !setOptimizationSource ||
        !setAiReplyOptimizeDialogOpen ||
        !setAiReplyOptimizeStep ||
        !setOptimizedPromptTemplate ||
        !setHumanEvaluation
      )
        return

      // 找到对应的AI回复和用户问题
      const aiMessage = chatMessages[messageIndex]
      let userQuestion = ''

      // 找到对应的用户问题（前一条用户消息）
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (chatMessages[i].type === 'user') {
          userQuestion = chatMessages[i].userInput || chatMessages[i].content
          break
        }
      }

      // 检查第一个system提示词是否为空
      const firstSystemMessage = promptMessages.find(msg => msg.role === 'system')
      if (!firstSystemMessage || !firstSystemMessage.content || firstSystemMessage.content.trim() === '') {
        setSnackbar({ open: true, message: t('components.prompts.promptEditPage.targetPromptEmpty'), severity: 'warning' })
        return
      }

      setSelectedAiReply({
        userQuestion,
        aiResponse: aiMessage.content,
        messageIndex,
      })

      setOptimizationSource({ type: 'main' })
      // 重置对话框状态，确保每次打开都是干净的状态
      setAiReplyOptimizeStep('input')
      setOptimizedPromptTemplate('')
      setHumanEvaluation('')
      setAiReplyOptimizeDialogOpen(true)
    },
    [
      chatMessages,
      promptMessages,
      setSnackbar,
      t,
      setSelectedAiReply,
      setOptimizationSource,
      setAiReplyOptimizeDialogOpen,
      setAiReplyOptimizeStep,
      setOptimizedPromptTemplate,
      setHumanEvaluation,
    ],
  )

  return {
    ...(chatMessages && setEditingMessage && setEditContent ? { handleEditMessage } : {}),
    ...(setComparisonGroupsData && setGroupCompletedMessages ? { handleDeleteMessage } : {}),
    ...(comparisonGroupsData &&
    setSnackbar &&
    t &&
    setSelectedAiReply &&
    setOptimizationSource &&
    setAiReplyOptimizeDialogOpen &&
    setAiReplyOptimizeStep &&
    setOptimizedPromptTemplate &&
    setHumanEvaluation
      ? { handleOptimizeAiReplyDialog }
      : {}),
    ...(chatMessages &&
    promptMessages &&
    setSnackbar &&
    t &&
    setSelectedAiReply &&
    setOptimizationSource &&
    setAiReplyOptimizeDialogOpen &&
    setAiReplyOptimizeStep &&
    setOptimizedPromptTemplate &&
    setHumanEvaluation
      ? { handleOptimizeAiReply }
      : {}),
  }
}
