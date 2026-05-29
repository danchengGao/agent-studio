import { Tooltip, IconButton, Typography, Box } from '@mui/material'
import { HelpCircle } from 'lucide-react'
import { HELP_TEXT, HelpTextKey } from './helpTextConstants'

/**
 * A small help-circle icon that shows a tooltip when hovered.
 *
 * Usage — with a helpKey (looks up text automatically):
 *   <InfoTooltip helpKey="TRIALS" />
 *
 * Usage — with arbitrary text:
 *   <InfoTooltip text="Custom explanation here." />
 *
 * Usage — as an inline label wrapper:
 *   <InfoTooltip helpKey="PATTERN_TYPE" label="Pattern Type" />
 */

interface InfoTooltipProps {
  /** Key from HELP_TEXT constants — preferred. */
  helpKey?: HelpTextKey
  /** Raw tooltip text — used when helpKey is not applicable. */
  text?: string
  /** When provided, renders as "label + icon" inline row instead of icon-only. */
  label?: string
  /** Lucide icon size (default 12). */
  size?: number
  /** MUI Tooltip placement (default "top"). */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end'
  /** Additional sx for the outer Box when label is provided. */
  sx?: object
}

export default function InfoTooltip({
  helpKey,
  text,
  label,
  size = 12,
  placement = 'top',
  sx,
}: InfoTooltipProps) {
  const content = helpKey ? HELP_TEXT[helpKey] : (text ?? '')

  const icon = (
    <Tooltip
      title={
        <Typography variant="caption" sx={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>
          {content}
        </Typography>
      }
      arrow
      placement={placement}
      enterDelay={200}
      componentsProps={{ tooltip: { sx: { maxWidth: 360, p: 1.5 } } }}
    >
      <IconButton size="small" sx={{ p: 0, color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}>
        <HelpCircle size={size} />
      </IconButton>
    </Tooltip>
  )

  if (!label) return icon

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ...sx }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      {icon}
    </Box>
  )
}
