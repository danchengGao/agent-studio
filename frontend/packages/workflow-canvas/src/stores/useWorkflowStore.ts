import { create } from 'zustand'

export type WorkflowPanelContext = {
  workflowId?: string
  spaceId?: string
}

type WorkflowStoreState = {
  // 右侧历史面板显示
  showHistoryPanel: boolean
  // 面板上下文（当前工作流/空间）
  context: WorkflowPanelContext | null
  // 当前选中的版本（'draft' 为草稿，其它为具体版本号）
  selectedVersion: string | null
  // 刷新版本列表的时间戳（触发 HistoryPanel 重新拉取）
  historyRefreshTs: number
  // 面板是否只读
  panelReadonly: boolean
}

type WorkflowStoreActions = {
  // 打开历史面板并设置上下文，默认选中草稿
  openHistoryPanel: (ctx: WorkflowPanelContext) => void
  // 关闭历史面板
  closeHistoryPanel: () => void
  // 选择版本（会影响自动保存防护）
  setSelectedVersion: (versionId: string) => void
  // 设置面板只读状态
  setPanelReadonly: (readonly: boolean) => void
  // 发布成功后的通知（刷新列表并选中草稿版本）
  notifyPublished: (ctx?: WorkflowPanelContext) => void
  // 重置 store 内容
  resetStore: () => void
}

export const useWorkflowStore = create<WorkflowStoreState & WorkflowStoreActions>((set, get) => ({
  showHistoryPanel: false,
  context: null,
  selectedVersion: null,
  historyRefreshTs: 0,
  panelReadonly: false,

  openHistoryPanel: ctx => {
    set({ showHistoryPanel: true, context: ctx })
    // 默认选中草稿（不触发接口）
    const currentSelected = get().selectedVersion
    if (!currentSelected) {
      set({ selectedVersion: 'draft' })
    }
  },

  closeHistoryPanel: () => set({ showHistoryPanel: false }),

  setSelectedVersion: versionId => {
    set({ selectedVersion: versionId })
    get().setPanelReadonly(versionId !== 'draft' ? true : false)
  },

  setPanelReadonly: readonly => set({ panelReadonly: readonly }),

  notifyPublished: ctx => {
    // 刷新版本列表，并确保草稿被选中
    const nextCtx = ctx ? ctx : get().context
    set({ context: nextCtx || null, selectedVersion: 'draft', historyRefreshTs: Date.now() })
  },

  resetStore: () => {
    set({
      showHistoryPanel: false,
      context: null,
      selectedVersion: null,
      historyRefreshTs: 0,
      panelReadonly: false,
    })
  },
}))
