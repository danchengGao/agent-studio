import MenuItem from '@mui/material/MenuItem'
import { VersionsMap } from '@/hooks/useWorkflowVersions'

export const isVersionValid = (workflowId: string, versionsMap: VersionsMap, value: string) => {
  if (!value || value === 'draft') return true
  const published = versionsMap[workflowId]?.published || []
  return published.some(p => p.version === value)
}

export const renderVersionMenuItems = (workflowId: string, versionsMap: VersionsMap, options?: { includeDraft?: boolean; itemSx?: any }) => {
  const published = versionsMap[workflowId]?.published || []
  const itemSx = options?.itemSx ?? { fontSize: '0.8125rem', py: 0.5 }
  const items: JSX.Element[] = []
  if (options?.includeDraft !== false) {
    items.push(
      <MenuItem value="draft" sx={itemSx} key={`draft_${workflowId}`}>
        草稿
      </MenuItem>,
    )
  }
  published.forEach(v => {
    items.push(
      <MenuItem key={v.version} value={v.version} sx={itemSx}>
        {v.version}
      </MenuItem>,
    )
  })
  return items
}
