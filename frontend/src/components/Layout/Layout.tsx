import React, { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/useAuthStore'
import { useUIStore } from '../../stores/useUIStore'
import Sidebar from './Sidebar'
import Header from './Header'

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const sidebarCollapsed = useUIStore(state => state.sidebarCollapsed)
  const setSidebarCollapsed = useUIStore(state => state.setSidebarCollapsed)
  const [isTemporarilyExpanded, setIsTemporarilyExpanded] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  // Handle mouse leaving the sidebar to collapse it again
  const handleMouseLeave = () => {
    // 只有当侧边栏是临时展开的状态时才收起
    if (isTemporarilyExpanded) {
      // 添加延迟，使用户有足够时间进行操作
      setTimeout(() => {
        setIsTemporarilyExpanded(false)
      }, 300)
    }
  }

  // Set CSS custom properties for sidebar state
  useEffect(() => {
    // Use temporarily expanded state if active, otherwise use collapsed state
    const effectiveCollapsed = isTemporarilyExpanded ? false : sidebarCollapsed
    document.documentElement.style.setProperty('--sidebar-collapsed', effectiveCollapsed ? '1' : '0')
    document.documentElement.style.setProperty('--sidebar-width', effectiveCollapsed ? '64px' : '256px')
  }, [sidebarCollapsed, isTemporarilyExpanded])

  // 如果用户未登录，重定向到登录页
  if (!user) {
    navigate('/login')
    return null
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <div ref={sidebarRef} className="h-screen flex flex-col overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isCollapsed={isTemporarilyExpanded ? false : sidebarCollapsed}
          isLocked={!sidebarCollapsed}
          onToggleCollapse={() => {
            setIsTemporarilyExpanded(false)
            setSidebarCollapsed(!sidebarCollapsed)
          }}
          onMouseLeave={handleMouseLeave}
          onMouseEnter={() => {
            // 当侧边栏折叠且不是临时展开状态时，鼠标进入时展开
            if (sidebarCollapsed && !isTemporarilyExpanded) {
              setIsTemporarilyExpanded(true)
            }
          }}
        />
      </div>

      {/* Main content */}
      <div ref={contentRef} className="flex-1 overflow-hidden flex flex-col transition-all duration-300 ease-in-out h-full">
        {/* Header */}
        <Header user={user} onMenuClick={() => setSidebarOpen(true)} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-[#F8F9FC]">
          <div className="py-6 h-full">
            <div className="w-full h-full px-4 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout
