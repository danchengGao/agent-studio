/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import React from 'react'
import { Toast } from '@douyinfe/semi-ui'
import { WorkflowService } from '@test-agentstudio/api-client'
import { useWorkflowStore } from '../../stores/useWorkflowStore'

export interface PublishModalProps {
  open: boolean
  workflowId?: string
  spaceId?: string
  onSave: () => void
  asyncSaveRef?: React.RefObject<(() => Promise<void>) | null>
  onClose: () => void
  defaultVersion?: string
}

// 版本号递增工具（vX.Y.Z -> vX.Y.(Z+1)）
const VERSION_PATTERN = /^v(\d+)\.(\d+)\.(\d+)$/
function computeNextVersion(latest?: string): string {
  const match = latest?.match(VERSION_PATTERN)
  if (!match) return 'v0.0.1'
  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3]) + 1
  return `v${major}.${minor}.${patch}`
}

// 拉取版本列表并设置默认版本（命名函数，避免闭包/IIFE）
async function refreshDefaultVersion(workflowId: string, spaceId: string, defaultVersion: string, setVersion: (v: string) => void): Promise<void> {
  try {
    const res = await WorkflowService.getWorkflowVersionList({ workflow_id: workflowId, space_id: spaceId })
    const versions = res?.data?.versions || []
    const latest = versions.slice().sort((a, b) => (b.create_time || 0) - (a.create_time || 0))[0]?.workflow_version
    const next = computeNextVersion(latest)
    setVersion(next)
  } catch (err) {
    console.error('获取版本列表失败:', err)
    setVersion(defaultVersion)
  }
}

const PublishDialog: React.FC<PublishModalProps> = ({ open, workflowId, spaceId, onSave, asyncSaveRef, onClose, defaultVersion = 'v1.0.0' }) => {
  const [version, setVersion] = React.useState<string>('')
  const [description, setDescription] = React.useState<string>('')
  const [loading, setLoading] = React.useState<boolean>(false)

  // 表单字段错误状态
  const [versionError, setVersionError] = React.useState<string>('')
  const [descriptionError, setDescriptionError] = React.useState<string>('')

  // 校验函数：版本号与描述
  const validateVersionInput = React.useCallback((val: string): string => {
    const trimmed = (val || '').trim()
    if (!trimmed) return '请输入发布版本'
    const pattern = /^v\d+\.\d+\.\d+$/
    if (!pattern.test(trimmed)) return '版本号格式不正确，请使用 v1.2.3 格式'
    return ''
  }, [])

  const validateDescriptionInput = React.useCallback((val: string): string => {
    const trimmed = (val || '').trim()
    if (!trimmed) return '请输入发布描述'
    if (trimmed.length < 5) return '发布描述至少需要5个字符'
    if (trimmed.length > 200) return '发布描述不能超过200个字符'
    return ''
  }, [])

  React.useEffect(() => {
    if (!open) return
    // 打开时初始化描述
    setDescription('')

    // 若缺少必要参数，则使用默认版本
    if (!workflowId || !spaceId) {
      setVersion(defaultVersion)
      return
    }

    refreshDefaultVersion(workflowId, spaceId, defaultVersion, setVersion)
  }, [open, workflowId, spaceId, defaultVersion])

  const handleConfirm = async () => {
    if (!workflowId || !spaceId) {
      Toast.error('工作流信息不存在')
      return
    }

    // 提交时静默校验，阻止无效提交（不弹 Toast）
    const isVersionValidate = validateVersionInput(version)
    const isDescriptionValidate = validateDescriptionInput(description)
    if (isVersionValidate || isDescriptionValidate) {
      setVersionError(isVersionValidate)
      setDescriptionError(isDescriptionValidate)
      return
    }

    setLoading(true)
    try {
      const asyncSaveFunction = asyncSaveRef?.current
      if (asyncSaveFunction) {
        await asyncSaveFunction()
      } else {
        onSave()
      }

      const response = await WorkflowService.publishWorkflow({
        workflow_id: workflowId,
        space_id: spaceId,
        force: false,
        version: version.trim(),
        version_description: description.trim(),
      })

      if (response.code === 200) {
        Toast.success('工作流发布成功')
        // 通知 store 发布成功：刷新历史列表并重置选中为草稿
        const notifyPublished = useWorkflowStore.getState().notifyPublished
        notifyPublished({ workflowId, spaceId })
        onClose()
        setVersion('')
        setDescription('')
      } else {
        Toast.error(response.message || '发布失败')
      }
    } catch (error: any) {
      console.error('发布工作流失败:', error)
      Toast.error(error?.message || '发布失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    onClose()
    setVersion('')
    setDescription('')
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          width: '480px',
          maxWidth: '90vw',
        }}
      >
        <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 'bold' }}>发布工作流</h3>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', color: '#333', marginBottom: '8px', fontWeight: 500 }}>
            发布版本 <span style={{ color: '#ff4d4f' }}>*</span>
          </div>
          <input
            type="text"
            value={version}
            onChange={e => {
              const v = e.target.value
              if (v.length <= 80) setVersion(v)
            }}
            placeholder="请输入版本号，如: v0.0.1"
            style={{
              width: '100%',
              padding: '12px 16px',
              border: `1.5px solid ${versionError ? '#ff4d4f' : '#d9d9d9'}`,
              borderRadius: '6px',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.2s ease',
            }}
            onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
              e.target.style.borderColor = versionError ? '#ff4d4f' : '#1890ff'
            }}
            onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
              const err = validateVersionInput(e.target.value)
              setVersionError(err)
              e.target.style.borderColor = err ? '#ff4d4f' : '#d9d9d9'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            {versionError ? (
              <div style={{ fontSize: '12px', color: '#ff4d4f' }}>{versionError}</div>
            ) : (
              <div />
            )}
            <div style={{ fontSize: '12px', color: '#999' }}>{version.length}/80</div>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', color: '#333', marginBottom: '8px', fontWeight: 500 }}>
            发布描述 <span style={{ color: '#ff4d4f' }}>*</span>
          </div>
          <textarea
            value={description}
            onChange={e => {
              const v = e.target.value
              if (v.length <= 200) setDescription(v)
            }}
            placeholder="请输入本次发布的描述信息..."
            style={{
              width: '100%',
              minHeight: '120px',
              padding: '12px 16px',
              border: `1.5px solid ${descriptionError ? '#ff4d4f' : '#d9d9d9'}`,
              borderRadius: '6px',
              fontSize: '14px',
              lineHeight: '1.5',
              resize: 'vertical',
              fontFamily: 'inherit',
              outline: 'none',
              transition: 'border-color 0.2s ease',
            }}
            onFocus={(e: React.FocusEvent<HTMLTextAreaElement>) => {
              e.target.style.borderColor = descriptionError ? '#ff4d4f' : '#1890ff'
            }}
            onBlur={(e: React.FocusEvent<HTMLTextAreaElement>) => {
              const err = validateDescriptionInput(e.target.value)
              setDescriptionError(err)
              e.target.style.borderColor = err ? '#ff4d4f' : '#d9d9d9'
            }}
            maxLength={200}
          />
          {descriptionError && <div style={{ fontSize: '12px', color: '#ff4d4f', marginTop: '4px' }}>{descriptionError}</div>}
          <div style={{ fontSize: '12px', color: '#999', textAlign: 'right', marginTop: '4px' }}>{description.length}/200</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
          <button
            onClick={handleCancel}
            disabled={loading}
            style={{
              padding: '8px 16px',
              border: '1px solid #d9d9d9',
              borderRadius: '6px',
              backgroundColor: 'white',
              color: '#333',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
            }}
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !!versionError || !!descriptionError || !version.trim() || !description.trim()}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: '#1890ff',
              color: 'white',
              cursor: loading || !!versionError || !!descriptionError || !version.trim() || !description.trim() ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              opacity: loading || !!versionError || !!descriptionError || !version.trim() || !description.trim() ? 0.6 : 1,
            }}
          >
            {loading ? '发布中...' : '确认发布'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PublishDialog
