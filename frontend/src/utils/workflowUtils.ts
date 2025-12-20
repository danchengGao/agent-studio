/**
 * 工作流相关的工具函数
 * 用于 WorkflowsPage 组件中的通用功能
 */

import { WorkflowSortBy, WorkflowSortOrder } from '@test-agentstudio/api-client'

export interface WorkflowMockData {
  status: string
  trigger: string
  lastRun: string
  nextRun: string
  successRate: number
  executionTime: string
  nodes: number
  createdAt: string
}

export interface Workflow {
  workflow_id: string
  name: string
  desc: string
  space_id: string
  workflow_version?: string
  create_time?: number
  update_time?: number
  status?: string
  tags: any[]
  mockData?: WorkflowMockData
}

/**
 * 生成模拟工作流数据
 * @param workflowId 工作流ID
 * @param realStatus 真实状态（可选）
 * @returns 模拟数据对象
 */
export function generateMockWorkflowData(workflowId: string, realStatus?: string): WorkflowMockData {
  const triggers = ['Webhook', '定时', '手动', '事件', 'API'] as const

  return {
    status: realStatus || 'scheduled',
    trigger: triggers[Math.floor(Math.random() * triggers.length)],
    lastRun: ['5分钟前', '1小时前', '6小时前', '昨天', '3天前'][Math.floor(Math.random() * 5)],
    nextRun: ['实时', '每天 9:00', '每4小时', '每周一', '每月1号'][Math.floor(Math.random() * 5)],
    successRate: Math.floor(Math.random() * 20 + 80), // 80-100%
    executionTime: `${(Math.random() * 10 + 1).toFixed(1)}s`,
    nodes: Math.floor(Math.random() * 20 + 5), // 5-25 nodes
    createdAt: ['2024-01-15', '2024-01-20', '2024-01-10', '2024-01-25', '2024-01-30'][Math.floor(Math.random() * 5)],
  }
}

/**
 * 处理工作流数据，添加模拟数据和标准化字段
 * @param workflows 原始工作流数组
 * @returns 处理后的工作流数组
 */
export function processWorkflowData(workflows: Workflow[]): Workflow[] {
  return workflows.map(workflow => ({
    workflow_id: workflow.workflow_id,
    name: workflow.name,
    desc: workflow.desc,
    space_id: workflow.space_id,
    workflow_version: workflow.workflow_version || 'draft',
    create_time: workflow.create_time || Date.now(),
    update_time: workflow.update_time || workflow.create_time || Date.now(),
    status: workflow.mockData?.status || 'scheduled',
    tags: workflow.tags || [],
    mockData: generateMockWorkflowData(workflow.workflow_id, workflow.mockData?.status || 'scheduled'),
  }))
}

/**
 * 工作流排序的比较函数
 * @param sortBy 排序字段
 * @param sortOrder 排序方向
 * @returns 比较函数
 */
export function createWorkflowSorter(sortBy: WorkflowSortBy, sortOrder: WorkflowSortOrder) {
  return (a: Workflow, b: Workflow): number => {
    let aValue: any, bValue: any

    switch (sortBy) {
      case WorkflowSortBy.name:
        aValue = a.name || ''
        bValue = b.name || ''
        break
      case WorkflowSortBy.create_time:
        aValue = a.create_time || 0
        bValue = b.create_time || 0
        break
      case WorkflowSortBy.update_time:
        aValue = a.update_time || 0
        bValue = b.update_time || 0
        break
      default:
        aValue = a.update_time || 0
        bValue = b.update_time || 0
    }

    // 处理字符串和数字的比较
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'asc' ? aValue.localeCompare(bValue, 'zh-CN') : bValue.localeCompare(aValue, 'zh-CN')
    }

    // 数字比较
    return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
  }
}

/**
 * 过滤工作流列表
 * @param workflows 工作流数组
 * @param statusFilter 状态过滤器
 * @returns 过滤后的工作流数组
 */
export function filterWorkflows(workflows: Workflow[], statusFilter: string): Workflow[] {
  if (statusFilter === 'all') {
    return workflows
  }

  return workflows.filter(workflow => workflow.status === statusFilter)
}

/**
 * 工作流分页
 * @param workflows 工作流数组
 * @param currentPage 当前页码
 * @param pageSize 每页大小
 * @returns 分页后的工作流数组
 */
export function paginateWorkflows(workflows: Workflow[], currentPage: number, pageSize: number): Workflow[] {
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  return workflows.slice(startIndex, endIndex)
}

/**
 * 计算分页信息
 * @param totalItems 总项目数
 * @param pageSize 每页大小
 * @returns 分页信息
 */
export function calculatePaginationInfo(totalItems: number, pageSize: number) {
  const totalPages = Math.ceil(totalItems / pageSize)
  return {
    totalPages,
    totalItems,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
  }
}
