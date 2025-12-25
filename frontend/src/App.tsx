import React, { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/useAuthStore'
import Layout from './components/Layout/Layout'

// Import i18n
import './i18n'
import { LanguageProvider } from './contexts/LanguageContext'

// 立即加载的核心页面（用户可能立即访问）
import LoginPage from './pages/Auth/LoginPage'
import DashboardPage from './pages/Dashboard/DashboardPage'
import AgentsPage from './pages/Agents/AgentsPage'
import WorkflowsPage from './pages/Workflows/WorkflowsPage'
import PromptsPage from './pages/Prompts/PromptsPage'

// 懒加载非核心页面
const AgentCreatePage = React.lazy(() => import('./pages/Agents/AgentCreatePage'))
const AgentEditorEditPage = React.lazy(() => import('./pages/Agents/AgentEditorEditPage'))
const WorkflowCreationPage = React.lazy(() => import('./pages/Workflows/WorkflowCreationPage'))
const PromptEditPage = React.lazy(() => import('./pages/Prompts/PromptEditPage'))
const PromptOptimizePage = React.lazy(() => import('./pages/Prompts/PromptOptimizePage'))
const PromptOptimizeEditPage = React.lazy(() => import('./pages/Prompts/PromptOptimizeEditPage'))
const ModelsPage = React.lazy(() => import('./pages/Models/ModelsPage'))
const PluginManagementPage = React.lazy(() => import('./pages/Plugins').then(module => ({ default: module.PluginManagementPage })))
const PluginConfigurationPage = React.lazy(() => import('./pages/Plugins/PluginConfigurationPage'))
const PluginVersionPage = React.lazy(() => import('./pages/Plugins/PluginVersionPage'))
const ToolConfigurationPage = React.lazy(() => import('./pages/Plugins/ToolConfigurationPage'))

// 懒加载workflow-canvas组件
const WorkflowCanvas = React.lazy(() => import('@test-agentstudio/workflow-canvas').then(module => ({ default: module.WorkflowCanvas })))

// 加载组件
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
  </div>
)

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

const App: React.FC = () => {
  const { isAuthenticated } = useAuthStore()

  return (
    <div className="h-screen w-full overflow-hidden">
      <LanguageProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />

            <Route path="agents" element={<AgentsPage />} />
            <Route
              path="agents/new"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <AgentCreatePage />
                </Suspense>
              }
            />
            <Route
              path="agents/:id"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <AgentEditorEditPage />
                </Suspense>
              }
            />
            <Route path="workflows" element={<WorkflowsPage />} />
            <Route
              path="workflows/new"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <WorkflowCreationPage />
                </Suspense>
              }
            />
            <Route
              path="workflows/editor/:id"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <WorkflowCanvas />
                </Suspense>
              }
            />
            <Route path="prompts" element={<PromptsPage />} />
            <Route
              path="prompts/:id"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <PromptEditPage />
                </Suspense>
              }
            />
            <Route
              path="prompts/new"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <PromptEditPage />
                </Suspense>
              }
            />
            <Route
              path="prompts/optimize"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <PromptOptimizePage />
                </Suspense>
              }
            />
            <Route
              path="prompts/optimize/new"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <PromptOptimizeEditPage />
                </Suspense>
              }
            />
            <Route
              path="prompts/optimize/:id"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <PromptOptimizeEditPage />
                </Suspense>
              }
            />
            <Route
              path="models"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <ModelsPage />
                </Suspense>
              }
            />
            <Route
              path="plugins"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <PluginManagementPage />
                </Suspense>
              }
            />
            <Route
              path="plugins/:plugin_id"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <PluginConfigurationPage />
                </Suspense>
              }
            />
            <Route
              path="plugins/:plugin_id/:version"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <PluginVersionPage />
                </Suspense>
              }
            />
            <Route
              path="plugins/:plugin_id/tools/:tool_id"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <ToolConfigurationPage />
                </Suspense>
              }
            />
          </Route>

          {/* Redirect to dashboard if authenticated, otherwise to login */}
          <Route path="*" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
        </Routes>
      </LanguageProvider>
    </div>
  )
}

export default App
