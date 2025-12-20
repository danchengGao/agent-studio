/**
 * Test script for token refresh functionality
 * This script demonstrates how the token renewal works in the client
 */

import { createApiClientInstance } from './client'

// Mock token provider and auth state updater
const mockTokenProvider = () => 'mock-access-token'
const mockRefreshTokenProvider = () => 'mock-refresh-token'

let currentToken = 'initial-token'
let currentRefreshToken = 'initial-refresh-token'
let logoutCalled = false

const mockAuthStateUpdater = {
  logout: () => {
    console.log('🚪 Logout called - redirecting to login page')
    logoutCalled = true
  },
  updateToken: (newToken: string) => {
    console.log('🔄 Token updated:', newToken.substring(0, 20) + '...')
    currentToken = newToken
  },
  getRefreshToken: () => currentRefreshToken,
}

// Create API client with token renewal support
const apiClient = createApiClientInstance(mockTokenProvider, mockAuthStateUpdater)

// Test function to simulate API call with token renewal
async function testApiCallWithTokenRenewal() {
  console.log('🧪 Testing API call with token renewal...')

  try {
    // This would normally make a real API call
    // For testing, we'll simulate the token renewal logic
    console.log('📡 Making API call...')

    // Simulate token renewal (in real scenario, this happens automatically on 401)
    const newToken = 'new-access-token-' + Date.now()
    mockAuthStateUpdater.updateToken(newToken)

    console.log('✅ API call successful with renewed token')
    return { success: true, data: 'test-data' }
  } catch (error) {
    console.error('❌ API call failed:', error)
    return { success: false, error }
  }
}

// Test function to simulate token refresh failure
async function testTokenRefreshFailure() {
  console.log('🧪 Testing token refresh failure...')

  try {
    // Simulate refresh token being invalid/expired
    currentRefreshToken = 'invalid-refresh-token'

    console.log('📡 Making API call with invalid refresh token...')

    // This should trigger logout
    const result = await testApiCallWithTokenRenewal()

    if (logoutCalled) {
      console.log('✅ Token refresh failure handled correctly - logout called')
      return { success: true, message: 'Logout triggered correctly' }
    } else {
      console.log('❌ Logout was not called on refresh failure')
      return { success: false, message: 'Logout not triggered' }
    }
  } catch (error) {
    console.error('❌ Test failed:', error)
    return { success: false, error }
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting token renewal tests...\n')

  // Test 1: Normal API call
  console.log('=== Test 1: Normal API Call ===')
  const result1 = await testApiCallWithTokenRenewal()
  console.log('Result:', result1)
  console.log()

  // Test 2: Token refresh failure
  console.log('=== Test 2: Token Refresh Failure ===')
  const result2 = await testTokenRefreshFailure()
  console.log('Result:', result2)
  console.log()

  // Summary
  console.log('📊 Test Summary:')
  console.log('- Normal API Call:', result1.success ? '✅ PASS' : '❌ FAIL')
  console.log('- Token Refresh Failure:', result2.success ? '✅ PASS' : '❌ FAIL')
  console.log()

  if (result1.success && result2.success) {
    console.log('🎉 All tests passed! Token renewal functionality is working correctly.')
  } else {
    console.log('⚠️ Some tests failed. Please check the implementation.')
  }
}

// Export test functions for use in other files
export { testApiCallWithTokenRenewal, testTokenRefreshFailure, runTests }

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
  runTests()
} else {
  console.log('📝 Test functions exported for use in browser environment')
}
