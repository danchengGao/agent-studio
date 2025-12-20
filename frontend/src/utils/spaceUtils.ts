import { ENV_CONFIG } from '@/config/environment'
import { useAuthStore } from '@/stores/useAuthStore'

export const getDefaultSpaceId = (): string => {
  const user = useAuthStore.getState().user
  return user?.spaceId || ENV_CONFIG.DEFAULT_SPACE_ID || ''
}
