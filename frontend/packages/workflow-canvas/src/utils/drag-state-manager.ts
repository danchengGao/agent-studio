/**
 * Drag State Manager - Prevents premature drag-end events when modals are opened
 * 拖拽状态管理器 - 防止在模态框打开时过早结束拖拽操作
 */

export class DragStateManager {
  private static instance: DragStateManager
  private isDragActive: boolean = false
  private modalOpen: boolean = false
  private originalMouseUpHandler: any = null
  private originalMouseDownHandler: any = null
  private boundMouseUpHandler: any = null
  private boundMouseDownHandler: any = null

  private constructor() {
    // Bind event handlers to maintain correct 'this' context
    this.boundMouseUpHandler = this.handleDocumentMouseUp.bind(this)
    this.boundMouseDownHandler = this.handleDocumentMouseDown.bind(this)
  }

  static getInstance(): DragStateManager {
    if (!DragStateManager.instance) {
      DragStateManager.instance = new DragStateManager()
    }
    return DragStateManager.instance
  }

  /**
   * Mark drag as active
   * 标记拖拽为活动状态
   */
  startDrag(): void {
    this.isDragActive = true
  }

  /**
   * Mark drag as ended
   * 标记拖拽为结束状态
   */
  endDrag(): void {
    this.isDragActive = false
  }

  /**
   * Mark modal as open
   * 标记模态框为打开状态
   */
  openModal(): void {
    this.modalOpen = true
    this.preventEventPropagation()
  }

  /**
   * Mark modal as closed
   * 标记模态框为关闭状态
   */
  closeModal(): void {
    this.modalOpen = false
    this.restoreEventHandlers()
  }

  /**
   * Check if drag should be prevented from ending
   * 检查是否应该防止拖拽结束
   */
  shouldPreventDragEnd(): boolean {
    return this.isDragActive && this.modalOpen
  }

  /**
   * Get current drag state
   * 获取当前拖拽状态
   */
  getDragState(): { isDragActive: boolean; modalOpen: boolean } {
    return {
      isDragActive: this.isDragActive,
      modalOpen: this.modalOpen,
    }
  }

  /**
   * Handle document mouseup events during modal interaction
   * 处理模态框交互期间的文档鼠标释放事件
   */
  private handleDocumentMouseUp(e: MouseEvent): void {
    // Only prevent the event if it's not targeting the modal itself
    const target = e.target as Element
    if (!target.closest('.workflow-selector-modal, .ant-modal-wrap, .ant-modal')) {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
    }
  }

  /**
   * Handle document mousedown events during modal interaction
   * 处理模态框交互期间的文档鼠标按下事件
   */
  private handleDocumentMouseDown(e: MouseEvent): void {
    // Only prevent the event if it's not targeting the modal itself
    const target = e.target as Element
    if (!target.closest('.workflow-selector-modal, .ant-modal-wrap, .ant-modal')) {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
    }
  }

  /**
   * Prevent mouse events from propagating to the canvas
   * 防止鼠标事件传播到画布
   */
  private preventEventPropagation(): void {
    // Only prevent events if we're in a drag operation and modal is open
    if (!this.isDragActive || !this.modalOpen) {
      return
    }

    // Use event capture to intercept events before they reach the canvas
    document.addEventListener('mouseup', this.boundMouseUpHandler, true)
    document.addEventListener('mousedown', this.boundMouseDownHandler, true)
  }

  /**
   * Restore original event handlers
   * 恢复原始事件处理器
   */
  private restoreEventHandlers(): void {
    // Remove our event listeners
    document.removeEventListener('mouseup', this.boundMouseUpHandler, true)
    document.removeEventListener('mousedown', this.boundMouseDownHandler, true)
  }

  /**
   * Reset all states - useful for cleanup
   * 重置所有状态 - 用于清理
   */
  reset(): void {
    // Always restore event handlers first to prevent any lingering event blocks
    this.restoreEventHandlers()
    this.isDragActive = false
    this.modalOpen = false
  }
}

// Export singleton instance
export const dragStateManager = DragStateManager.getInstance()
