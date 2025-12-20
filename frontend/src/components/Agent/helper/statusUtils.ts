export const getStatusMeta = (status?: string): { label: string; className: string } => {
  const s = (status || '').toLowerCase()
  const map: Record<string, { label: string; className: string }> = {
    finish: { label: status || 'finish', className: 'bg-green-100 text-green-800' },
    success: { label: status || 'success', className: 'bg-green-100 text-green-800' },
    running: { label: status || 'running', className: 'bg-yellow-100 text-yellow-800' },
    pending: { label: status || 'pending', className: 'bg-yellow-100 text-yellow-800' },
    error: { label: status || 'error', className: 'bg-red-100 text-red-800' },
    fail: { label: status || 'fail', className: 'bg-red-100 text-red-800' },
    failed: { label: status || 'failed', className: 'bg-red-100 text-red-800' },
    interrupted: { label: status || 'interrupted', className: 'bg-gray-100 text-gray-800' },
    cancelled: { label: status || 'cancelled', className: 'bg-gray-100 text-gray-800' },
  }
  return map[s] || { label: status || 'unknown', className: 'bg-gray-100 text-gray-600' }
}
