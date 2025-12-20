import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { AuthService } from '@test-agentstudio/api-client'
import { smartRedirectToDashboard, createSmartRedirect, shouldRedirectToLogin } from '../utils/redirectUtils'

interface SmartAuthCheckOptions {
  enableSilentValidation?: boolean
  skipRedirectOnFail?: boolean
  redirectTo?: string
}

interface SmartAuthCheckResult {
  isReady: boolean
  shouldShowContent: boolean
  isChecking: boolean
}

/**
 * 智能认证检查Hook
 * 专门为登录页面优化，避免不必要的重定向和页面闪烁
 */
export const useSmartAuthCheck = (options: SmartAuthCheckOptions = {}): SmartAuthCheckResult => {
  const {
    enableSilentValidation = true,
    skipRedirectOnFail = true, // 默认在登录页面跳过失败重定向
    redirectTo = '/dashboard',
  } = options

  const [isReady, setIsReady] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [shouldShowContent, setShouldShowContent] = useState(false)

  const { isAuthenticated, token, login } = useAuthStore()
  const navigate = useNavigate()
  const smartRedirect = createSmartRedirect(navigate)

  useEffect(() => {
    const performAuthCheck = async () => {
      console.log('🔍 [SmartAuthCheck] Starting authentication check...')

      try {
        // 检查本地存储的token
        const storedToken = localStorage.getItem('access_token')
        const zustandToken = token
        const currentToken = storedToken || zustandToken

        // 如果没有token，立即显示登录页面
        if (!currentToken) {
          console.log('🔐 [SmartAuthCheck] No token found - showing login page')
          setShouldShowContent(true)
          setIsReady(true)
          setIsChecking(false)
          return
        }

        // 如果已经通过Zustand认证，直接跳转
        if (isAuthenticated) {
          console.log('✅ [SmartAuthCheck] Already authenticated - redirecting to dashboard')
          smartRedirect.toDashboard()
          setIsReady(true)
          setIsChecking(false)
          return
        }

        // 如果禁用静默验证，需要检查是否已有有效的Zustand认证状态
        if (!enableSilentValidation) {
          console.log('🔐 [SmartAuthCheck] Silent validation disabled - checking existing auth state')

          // 如果Zustand中已有认证状态，直接重定向
          if (isAuthenticated) {
            console.log('✅ [SmartAuthCheck] Already authenticated in Zustand - redirecting to dashboard')
            smartRedirect.toDashboard()
            setIsReady(true)
            setIsChecking(false)
            return
          }

          // 没有认证状态，显示登录页面（不清除token，让用户可以手动验证）
          console.log('🔐 [SmartAuthCheck] No existing auth state - showing login page')
          setShouldShowContent(true)
          setIsReady(true)
          setIsChecking(false)
          return
        }

        // 有token但未认证，验证token有效性
        console.log('🔍 [SmartAuthCheck] Validating token...')

        try {
          const response = await AuthService.validateToken()
          console.log('🔍 [SmartAuthCheck] Token validation response:', response)

          // 检查token有效性 - 兼容多种响应格式
          const isValid = response.data?.valid || response.success === true

          if (isValid) {
            console.log('✅ [SmartAuthCheck] Token valid - setting up user session')

            // 从localStorage恢复用户状态
            const storedUser = localStorage.getItem('auth-storage')
            if (storedUser) {
              try {
                const authData = JSON.parse(storedUser)
                if (authData.state?.user && authData.state?.token) {
                  login(authData.state.user, authData.state.token, authData.state.refreshToken)

                  // 重启token自动刷新
                  const { startTokenRenewal } = useAuthStore.getState()
                  startTokenRenewal()
                  console.log('🔄 [SmartAuthCheck] Token renewal started')
                } else {
                  console.warn('⚠️ [SmartAuthCheck] Incomplete auth data in localStorage')
                }
              } catch (parseError) {
                console.warn('⚠️ [SmartAuthCheck] Failed to parse stored auth data:', parseError)
              }
            } else {
              console.warn('⚠️ [SmartAuthCheck] No auth data found in localStorage')
            }

            // 有效token，重定向到dashboard
            console.log('🚀 [SmartAuthCheck] Redirecting to dashboard with valid token')
            smartRedirect.toDashboard()
            setIsReady(true)
            setIsChecking(false)
          } else {
            console.log('❌ [SmartAuthCheck] Invalid token - showing login page')
            console.log('🧹 [SmartAuthCheck] Clearing invalid tokens from localStorage')
            // 清除无效token
            localStorage.removeItem('access_token')
            localStorage.removeItem('refresh_token')
            localStorage.removeItem('token_type')

            setShouldShowContent(true)
            setIsReady(true)
            setIsChecking(false)
          }
        } catch (validationError) {
          console.warn('⚠️ [SmartAuthCheck] Token validation failed:', validationError)

          // 验证失败，清除无效token
          console.log('🧹 [SmartAuthCheck] Clearing tokens due to validation error')
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          localStorage.removeItem('token_type')

          // 根据配置决定是否重定向
          if (!skipRedirectOnFail && shouldRedirectToLogin()) {
            console.log('🔄 [SmartAuthCheck] Redirecting to login due to validation failure')
            smartRedirect.toLogin()
          } else {
            console.log('🏠 [SmartAuthCheck] Showing login page due to validation failure')
            setShouldShowContent(true)
          }

          setIsReady(true)
          setIsChecking(false)
        }
      } catch (error) {
        console.error('❌ [SmartAuthCheck] Authentication check failed:', error)

        // 发生错误时，根据配置决定行为
        if (!skipRedirectOnFail && shouldRedirectToLogin()) {
          console.log('🔄 [SmartAuthCheck] Redirecting to login due to error')
          smartRedirect.toLogin()
        } else {
          console.log('🏠 [SmartAuthCheck] Showing login page due to error')
          setShouldShowContent(true)
        }

        setIsReady(true)
        setIsChecking(false)
      }
    }

    performAuthCheck()
  }, [isAuthenticated, token, login, enableSilentValidation, skipRedirectOnFail, smartRedirect])

  return {
    isReady,
    shouldShowContent,
    isChecking,
  }
}
