export const isContentConfigured = (v: any) => {
  if (!v) return false
  const c = v.content
  if (typeof c !== 'string') return false
  return c.trim().length > 0
}
