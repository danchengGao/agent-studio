/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import React, { useRef } from 'react'

import { useClientContext } from '@flowgram.ai/free-layout-editor'
import { useSaveWorkflow } from '@test-agentstudio/api-client'
import { Toast } from '@douyinfe/semi-ui'
import { CheckCircle, XCircle, Info } from 'lucide-react'

interface WorkflowOperationsHandlerProps {
  workflowId: string | undefined
  canvasData: any
  spaceId?: string
  onSaveRef?: React.RefObject<(() => Promise<void>) | null>
}

export const WorkflowOperationsHandler = ({ workflowId, canvasData, spaceId, onSaveRef }: WorkflowOperationsHandlerProps) => {
  const context = useClientContext()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 使用 API 包
  const saveWorkflowMutation = useSaveWorkflow()

  // Toast 显示函数
  const showToast = React.useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const icon = type === 'success' ? <CheckCircle /> : type === 'error' ? <XCircle /> : <Info />

    Toast[type]({
      content: message,
      duration: 3,
      icon: icon,
    })
  }, [])

  // Auto-layout functionality - only triggers on initial canvas load, not on node edits
  const hasAutoLayoutRef = React.useRef(false)
  const [isInitialLoad, setIsInitialLoad] = React.useState(true)

  React.useEffect(() => {
    // 只在真正的初始加载时执行自动布局，不依赖 document 变化
    if (!hasAutoLayoutRef.current && isInitialLoad && canvasData) {
      // Small delay to ensure the canvas is fully rendered
      const timer = setTimeout(() => {
        try {
          // Trigger auto-layout using the existing tools.autoLayout()
          context.tools.autoLayout()
          hasAutoLayoutRef.current = true
          setIsInitialLoad(false)
          console.log('🎯 Auto-layout triggered on initial load')
        } catch (error) {
          console.log('Auto-layout not available or failed:', error)
          setIsInitialLoad(false)
        }
      }, 1000) // 1 second delay

      return () => clearTimeout(timer)
    }
  }, [canvasData, isInitialLoad]) // 移除 context.document 依赖，避免节点操作时触发

  // Mouse wheel zoom functionality
  React.useEffect(() => {
    const handleWheel = (event: Event) => {
      const wheelEvent = event as WheelEvent
      // Prevent default scrolling behavior
      wheelEvent.preventDefault()

      // Check if Ctrl/Cmd key is pressed (common for zoom)
      if (wheelEvent.ctrlKey || wheelEvent.metaKey) {
        try {
          if (wheelEvent.deltaY < 0) {
            // Scroll up - zoom in
            ;(context.tools as any).zoomin?.()
          } else {
            // Scroll down - zoom out
            ;(context.tools as any).zoomout?.()
          }
        } catch (error) {
          console.log('Zoom operation failed:', error)
        }
      }
    }

    // Add wheel event listener to the canvas container
    const canvasContainer = document.querySelector('.demo-editor')
    if (canvasContainer) {
      canvasContainer.addEventListener('wheel', handleWheel, { passive: false })
    }

    return () => {
      if (canvasContainer) {
        canvasContainer.removeEventListener('wheel', handleWheel)
      }
    }
  }, [context.tools])

  // Button handlers with context access
  const handleSaveWorkflowWithHook = async () => {
    try {
      // Get the current workflow data from the canvas
      const workflowData = context.document.toJSON()

      if (workflowId && canvasData) {
        // 使用正确的space_id，优先级：传递的spaceId > canvasData.space_id > 默认值
        const finalSpaceId = spaceId || canvasData?.space_id || '1'

        // 使用hook保存工作流
        await saveWorkflowMutation.mutateAsync({
          workflow_id: workflowId,
          workflow_version: 'draft',
          space_id: finalSpaceId,
          schema: JSON.stringify(workflowData),
        })

        showToast('工作流保存成功', 'success')
      } else {
        // 如果没有workflowId，保存到控制台
        console.log('Saving workflow:', workflowData)
        showToast('工作流保存成功！工作流数据已保存到控制台。', 'success')
      }
    } catch (error) {
      console.error('Save failed:', error)
      showToast(`保存失败：请重试。错误详情：${error instanceof Error ? error.message : '未知错误'}`, 'error')
    }
  }

  const handleImportWorkflow = () => {
    // Trigger file selection using the hidden file input
    fileInputRef.current?.click()
  }

  const handleExportWorkflow = () => {
    try {
      // Get the current workflow data from the canvas
      const workflowData = context.document.toJSON()
      const dataStr = JSON.stringify(workflowData, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(dataBlob)
      // 使用工作流名称和时间戳生成文件名
      const workflowName = canvasData?.name || 'workflow'
      link.download = `${workflowName}_${new Date().toISOString().split('T')[0]}.json`
      link.click()
      URL.revokeObjectURL(link.href)

      // Show beautiful success toast
      showToast('工作流导出成功', 'success')
    } catch (error: unknown) {
      console.error('Export failed:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      showToast(`导出失败：请重试。错误详情：${errorMessage}`, 'error')
    }
  }

  // Expose the save function through ref for the WorkflowControl component
  React.useEffect(() => {
    if (onSaveRef) {
      onSaveRef.current = handleSaveWorkflowWithHook
    }
  }, [onSaveRef, workflowId, canvasData, spaceId])

  // Listen for custom events from the main Editor component
  React.useEffect(() => {
    const handleSaveEvent = () => {
      handleSaveWorkflowWithHook()
    }
    const handleImportEvent = () => handleImportWorkflow()
    const handleExportEvent = () => handleExportWorkflow()

    window.addEventListener('workflow-save', handleSaveEvent)
    window.addEventListener('workflow-import', handleImportEvent)
    window.addEventListener('workflow-export', handleExportEvent)

    return () => {
      window.removeEventListener('workflow-save', handleSaveEvent)
      window.removeEventListener('workflow-import', handleImportEvent)
      window.removeEventListener('workflow-export', handleExportEvent)
      // Clean up global reference
      delete (window as any).__saveWorkflowFunction
    }
  }, [])

  return (
    <>
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={event => {
          const file = event.target.files?.[0]
          if (file) {
            const reader = new FileReader()
            reader.onload = e => {
              try {
                const importedData = JSON.parse(e.target?.result as string)
                // Clear current workflow and load imported data
                context.document.clear()
                context.document.fromJSON(importedData)

                // Show beautiful success toast
                showToast('工作流导入成功！导入的数据已加载到画布。', 'success')
              } catch (error) {
                console.error('导入失败：文件格式错误', error)
                showToast('导入失败：文件格式错误。请确保选择的是有效的工作流JSON文件。', 'error')
              }
            }
            reader.readAsText(file)
          }
          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
        }}
      />
    </>
  )
}
