import { AxiosInstance } from 'axios'
import { AuthStateUpdater } from '../client'
import { shouldRedirectToLogin, smartRedirectToLogin } from '../../../src/utils/redirectUtils'

// 增强的认证状态更新器接口
export interface EnhancedAuthStateUpdater extends AuthStateUpdater {
  // 可选的强制登出方法
  forceLogout?: () => void
}

// 创建智能重定向的API客户端包装器
export const createSmartRedirectClient = (
  client: AxiosInstance,
  authStateUpdater?: EnhancedAuthStateUpdater
): AxiosInstance => {
  // 拦截响应错误，应用智能重定向逻辑
  const originalResponseInterceptor = client.interceptors.response.handlers[
    client.interceptors.response.handlers.length - 1
  ]

  // 移除原始的错误拦截器
  client.interceptors.response.handlers = client.interceptors.response.handlers.filter(
    handler => handler !== originalResponseInterceptor
  )

  // 添加新的智能重定向拦截器
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const { response } = error

      // 处理401未授权错误
      if (response?.status === 401) {
        console.log('🔐 [SmartRedirectClient] 401 Unauthorized received')

        if (authStateUpdater) {
          try {
            // 尝试刷新token（如果原始逻辑支持）
            const hasRefreshLogic = authStateUpdater.getRefreshToken && authStateUpdater.updateToken
            if (hasRefreshLogic) {
              console.log('🔄 [SmartRedirectClient] Attempting token refresh...')

              // 这里可以调用原始的token刷新逻辑
              // 由于我们无法直接访问renewToken函数，我们让调用者处理
              throw error // 让原始处理逻辑处理token刷新
            } else {
              console.log('🚪 [SmartRedirectClient] No refresh token logic, logging out...')
              authStateUpdater.logout()
              smartRedirectToLogin()
            }
          } catch (refreshError) {
            console.error('❌ [SmartRedirectClient] Token refresh failed:', refreshError)
            authStateUpdater.logout()
            smartRedirectToLogin()
          }
        } else {
          console.log('🔄 [SmartRedirectClient] No auth state updater, redirecting to login...')
          smartRedirectToLogin()
        }
      }

      // 对于其他错误，不做特殊处理
      throw error
    }
  )

  return client
}

// 智能token刷新函数
export const smartTokenRenewal = async (
  authStateUpdater: EnhancedAuthStateUpdater,
  renewalFunction: () => Promise<string | null>
): Promise<string | null> => {
  try {
    console.log('🔄 [SmartTokenRenewal] Starting token renewal...')

    const refreshToken = authStateUpdater.getRefreshToken?.()
    if (!refreshToken) {
      console.warn('⚠️ [SmartTokenRenewal] No refresh token available')
      authStateUpdater.logout?.()
      smartRedirectToLogin()
      return null
    }

    const newToken = await renewalFunction()

    if (newToken) {
      console.log('✅ [SmartTokenRenewal] Token renewed successfully')
      authStateUpdater.updateToken?.(newToken)
      return newToken
    } else {
      console.warn('⚠️ [SmartTokenRenewal] Token renewal failed - no new token')
      authStateUpdater.logout?.()
      smartRedirectToLogin()
      return null
    }
  } catch (error) {
    console.error('❌ [SmartTokenRenewal] Token renewal failed:', error)
    authStateUpdater.logout?.()
    smartRedirectToLogin()
    throw error
  }
}

// 智能定时token刷新
export const startSmartTokenRenewal = (
  authStateUpdater: EnhancedAuthStateUpdater,
  renewalFunction: () => Promise<string | null>,
  intervalMs: number = 60000
): NodeJS.Timeout => {
  console.log(`🔄 [SmartTokenRenewal] Starting timer (${intervalMs}ms interval)`)

  let timer: NodeJS.Timeout

  const performRenewal = async () => {
    try {
      await smartTokenRenewal(authStateUpdater, renewalFunction)
    } catch (error) {
      console.error('❌ [SmartTokenRenewal] Scheduled renewal failed:', error)
      // 定时器会在错误后继续运行，但通常此时用户已被重定向
    }
  }

  // 立即执行一次
  performRenewal()

  // 设置定时器
  timer = setInterval(performRenewal, intervalMs)

  return timer
}