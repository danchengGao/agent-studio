/**
 * 认证调试辅助工具
 * 用于诊断和验证自动登录功能
 */

export interface AuthDebugInfo {
  hasStoredToken: boolean
  storedTokenPreview: string
  zustandTokenPreview: string
  hasZustandAuth: boolean
  hasStoredAuthData: boolean
  storedAuthDataValid: boolean
  localStorageItems: string[]
  currentPath: string
  userAgent: string
  timestamp: string
}

/**
 * 获取认证调试信息
 */
export const getAuthDebugInfo = (): AuthDebugInfo => {
  const storedToken = localStorage.getItem('access_token')
  const zustandToken = localStorage.getItem('auth-storage')
  const authStorage = localStorage.getItem('auth-storage')

  let hasStoredAuthData = false
  let storedAuthDataValid = false

  if (authStorage) {
    try {
      const authData = JSON.parse(authStorage)
      hasStoredAuthData = true
      storedAuthDataValid = !!(authData.state?.user && authData.state?.token)
    } catch (error) {
      console.warn('Failed to parse auth storage:', error)
    }
  }

  return {
    hasStoredToken: !!storedToken,
    storedTokenPreview: storedToken ? `${storedToken.substring(0, 10)}...` : 'null',
    zustandTokenPreview: zustandToken ? `${zustandToken.substring(0, 10)}...` : 'null',
    hasZustandAuth: !!zustandToken,
    hasStoredAuthData,
    storedAuthDataValid,
    localStorageItems: Object.keys(localStorage),
    currentPath: window.location.pathname,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  }
}

/**
 * 打印认证调试信息到控制台
 */
export const logAuthDebugInfo = (): void => {
  const debugInfo = getAuthDebugInfo()

  console.group('🔍 [Auth Debug] Authentication Status')
  console.log('📍 Current Path:', debugInfo.currentPath)
  console.log('🕒 Timestamp:', debugInfo.timestamp)

  console.group('📦 Token Status')
  console.log('🔑 Stored Token:', debugInfo.hasStoredToken ? `✅ (${debugInfo.storedTokenPreview})` : '❌ None')
  console.log('🗄️ Zustand Token:', debugInfo.hasZustandAuth ? `✅ (${debugInfo.zustandTokenPreview})` : '❌ None')
  console.groupEnd()

  console.group('📋 Auth Data Status')
  console.log('📄 Has Stored Auth Data:', debugInfo.hasStoredAuthData ? '✅' : '❌')
  console.log('✅ Stored Auth Data Valid:', debugInfo.storedAuthDataValid ? '✅' : '❌')
  console.groupEnd()

  console.group('🗂️ localStorage Contents')
  debugInfo.localStorageItems.forEach(key => {
    const value = localStorage.getItem(key)
    const preview = value && value.length > 50 ? `${value.substring(0, 50)}...` : value
    console.log(`📝 ${key}:`, preview)
  })
  console.groupEnd()

  console.groupEnd()
}

/**
 * 清理所有认证相关的localStorage数据
 */
export const clearAuthData = (): void => {
  console.group('🧹 [Auth Debug] Clearing Auth Data')

  const authKeys = ['access_token', 'refresh_token', 'token_type', 'auth-storage', 'selectedSpaceId', 'rememberedEmail', 'rememberedPassword', 'rememberMe']

  authKeys.forEach(key => {
    if (localStorage.getItem(key)) {
      console.log(`🗑️ Removing: ${key}`)
      localStorage.removeItem(key)
    }
  })

  console.groupEnd()
}

/**
 * 测试自动登录功能
 */
export const testAutoLogin = async (): Promise<{ success: boolean; message: string; details?: any }> => {
  console.group('🧪 [Auth Debug] Testing Auto Login')

  try {
    // 1. 检查基本状态
    const debugInfo = getAuthDebugInfo()
    console.log('📊 Initial State:', debugInfo)

    // 2. 检查是否有token
    if (!debugInfo.hasStoredToken && !debugInfo.hasZustandAuth) {
      console.log('❌ No tokens found - cannot test auto login')
      console.groupEnd()
      return {
        success: false,
        message: 'No authentication tokens found',
      }
    }

    // 3. 尝试导入AuthService进行测试
    const { AuthService } = await import('@test-agentstudio/api-client')
    console.log('📡 Testing token validation...')

    const validationResponse = await AuthService.validateToken()
    console.log('✅ Validation Response:', validationResponse)

    const isValid = validationResponse.data?.valid || validationResponse.success === true

    if (isValid) {
      console.log('✅ Auto login test passed - token is valid')
      console.groupEnd()
      return {
        success: true,
        message: 'Token validation successful - auto login should work',
        details: validationResponse,
      }
    } else {
      console.log('❌ Auto login test failed - token is invalid')
      console.groupEnd()
      return {
        success: false,
        message: 'Token validation failed - auto login will not work',
        details: validationResponse,
      }
    }
  } catch (error) {
    console.error('❌ Auto login test error:', error)
    console.groupEnd()
    return {
      success: false,
      message: 'Auto login test failed with error',
      details: error,
    }
  }
}

/**
 * 在浏览器控制台中快速诊断自动登录
 * 使用方法：在控制台中运行 autoLoginDiagnostic()
 */
export const autoLoginDiagnostic = (): void => {
  console.log('%c🔍 Auto Login Diagnostic Tool', 'font-size: 16px; font-weight: bold; color: #0066cc;')
  console.log('%c=====================================', 'font-size: 16px; font-weight: bold; color: #0066cc;')

  logAuthDebugInfo()

  console.log('%c🧪 Testing Auto Login...', 'font-size: 14px; font-weight: bold; color: #ff6600;')
  testAutoLogin().then(result => {
    console.log('%c📊 Test Result:', 'font-size: 14px; font-weight: bold; color: #009900;')
    console.log(result)

    if (result.success) {
      console.log('%c✅ Auto Login should work!', 'font-size: 14px; font-weight: bold; color: #009900;')
    } else {
      console.log('%c❌ Auto Login has issues!', 'font-size: 14px; font-weight: bold; color: #cc0000;')
      console.log('%c💡 Try refreshing the page or checking your tokens', 'font-size: 12px; color: #666;')
    }
  })
}

// 将诊断工具暴露到全局（仅在开发环境）
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  ;(window as any).autoLoginDiagnostic =
    autoLoginDiagnostic(window as any).getAuthDebugInfo =
    getAuthDebugInfo(window as any).testAutoLogin =
    testAutoLogin(window as any).clearAuthData =
      clearAuthData
}
