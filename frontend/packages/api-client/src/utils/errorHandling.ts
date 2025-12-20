// Error handling utilities for API calls

export interface ApiError {
  message?: string
  response?: {
    status?: number
    data?: any
  }
  [key: string]: any
}

export const isApiError = (error: unknown): error is ApiError => {
  return typeof error === 'object' && error !== null && 'message' in error
}

export const getErrorMessage = (error: unknown): string => {
  if (isApiError(error)) {
    return error.message || 'Unknown error'
  }
  return String(error)
}

export const getErrorResponse = (error: unknown) => {
  if (isApiError(error)) {
    return error.response
  }
  return null
}
