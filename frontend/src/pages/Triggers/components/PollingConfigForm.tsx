import React from 'react'
import { useTranslation } from 'react-i18next'
import { TextField, MenuItem, Typography } from '@mui/material'
import dayjs from 'dayjs'

const INTERVALS = [
  { value: 60, labelKey: '60' },
  { value: 300, labelKey: '300' },
  { value: 900, labelKey: '900' },
  { value: 1800, labelKey: '1800' },
  { value: 3600, labelKey: '3600' },
  { value: 21600, labelKey: '21600' },
  { value: 86400, labelKey: '86400' },
]

interface PollingConfigFormProps {
  pollUrl: string
  pollIntervalSeconds: number
  lastCheckedAt?: number | null
  lastSeenHash?: string | null
  onUrlChange: (url: string) => void
  onIntervalChange: (seconds: number) => void
  disabled?: boolean
}

const PollingConfigForm: React.FC<PollingConfigFormProps> = ({
  pollUrl,
  pollIntervalSeconds,
  lastCheckedAt,
  lastSeenHash,
  onUrlChange,
  onIntervalChange,
  disabled,
}) => {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <TextField
        fullWidth
        label={t('triggers.form.pollUrl', 'Poll URL')}
        value={pollUrl}
        onChange={e => onUrlChange(e.target.value)}
        disabled={disabled}
        placeholder="https://example.com/feed.rss"
        size="small"
      />
      <TextField
        select
        fullWidth
        label={t('triggers.form.pollInterval', 'Check every')}
        value={pollIntervalSeconds}
        onChange={e => onIntervalChange(Number(e.target.value))}
        disabled={disabled}
        size="small"
      >
        {INTERVALS.map(opt => (
          <MenuItem key={opt.value} value={opt.value}>
            {t(`triggers.intervals.${opt.labelKey}`, String(opt.value))}
          </MenuItem>
        ))}
      </TextField>
      {lastCheckedAt != null && (
        <div>
          <Typography variant="caption" color="text.secondary">
            {t('triggers.form.pollLastChecked', 'Last checked')}:{' '}
            {dayjs(lastCheckedAt).format('YYYY-MM-DD HH:mm:ss')}
          </Typography>
        </div>
      )}
      {lastSeenHash && (
        <div>
          <Typography variant="caption" color="text.secondary">
            {t('triggers.form.pollLastHash', 'Last content hash')}:{' '}
            {lastSeenHash.substring(0, 16)}...
          </Typography>
        </div>
      )}
    </div>
  )
}

export default PollingConfigForm
