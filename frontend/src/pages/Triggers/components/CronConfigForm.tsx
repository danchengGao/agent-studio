import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  TextField,
  Typography,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Collapse,
  Box,
  Checkbox,
  FormControlLabel,
  FormGroup,
} from '@mui/material'
import { ChevronDown, ChevronUp } from 'lucide-react'
import cronstrue from 'cronstrue'

interface CronConfigFormProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

type FrequencyType = 'daily' | 'weekly' | 'monthly' | 'custom'

const CronConfigForm: React.FC<CronConfigFormProps> = ({ value, onChange, disabled }) => {
  const { t } = useTranslation()
  const [preview, setPreview] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Track the last value we sent via onChange to prevent re-parsing our own updates
  const lastSentValue = React.useRef<string>('')
  const isInitialMount = React.useRef(true)
  const allowBuilding = React.useRef(false)

  // Visual builder state - initialize from value prop
  const parseInitialState = (cronValue: string) => {
    const parts = cronValue.split(' ')
    if (parts.length !== 5) {
      return {
        frequency: 'weekly' as FrequencyType,
        hour: 9,
        minute: 0,
        selectedDaysOfWeek: [1],
        dayOfMonth: 1,
      }
    }

    const [min, hr, dom, month, dow] = parts
    const parsedMinute = parseInt(min) || 0
    const parsedHour = parseInt(hr) || 0

    let parsedFrequency: FrequencyType = 'weekly'
    let parsedDaysOfWeek = [1]
    let parsedDayOfMonth = 1

    if (dom === '*' && month === '*' && dow !== '*') {
      parsedFrequency = 'weekly'
      const ABBR_TO_IDX: Record<string, number> = {
        sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
      }
      const days = dow.split(',').map(d => {
        const num = parseInt(d)
        if (!isNaN(num)) return num
        return ABBR_TO_IDX[d.toLowerCase()] ?? NaN
      }).filter(d => !isNaN(d))
      if (days.length > 0) parsedDaysOfWeek = days
    } else if (dom !== '*' && month === '*' && dow === '*') {
      parsedFrequency = 'monthly'
      parsedDayOfMonth = parseInt(dom) || 1
    } else if (dom === '*' && month === '*' && dow === '*') {
      parsedFrequency = 'daily'
    } else {
      parsedFrequency = 'custom'
    }

    return {
      frequency: parsedFrequency,
      hour: parsedHour,
      minute: parsedMinute,
      selectedDaysOfWeek: parsedDaysOfWeek,
      dayOfMonth: parsedDayOfMonth,
    }
  }

  const initialState = parseInitialState(value || '0 9 * * 1')

  const [frequency, setFrequency] = useState<FrequencyType>(initialState.frequency)
  const [hour, setHour] = useState(initialState.hour)
  const [minute, setMinute] = useState(initialState.minute)
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>(initialState.selectedDaysOfWeek)
  const [dayOfMonth, setDayOfMonth] = useState(initialState.dayOfMonth)

  // Compute browser UTC offset label once (e.g. "UTC+2" or "UTC-5")
  const utcOffsetMinutes = -new Date().getTimezoneOffset()
  const utcOffsetHours = utcOffsetMinutes / 60
  const utcLabel =
    utcOffsetHours === 0
      ? 'UTC'
      : utcOffsetHours > 0
        ? `UTC+${utcOffsetHours}`
        : `UTC${utcOffsetHours}`

  // Day abbreviations matching POSIX index (0=Sun … 6=Sat).
  // These are used when building the cron expression so APScheduler's
  // from_crontab() correctly interprets Friday as Friday (not Saturday).
  const DAY_ABBR = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

  const daysOfWeek = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ]

  // Parse external value changes (like switching between different triggers)
  useEffect(() => {
    // Skip on initial mount (already parsed in useState)
    if (isInitialMount.current) {
      isInitialMount.current = false
      lastSentValue.current = value
      // Allow building after a short delay to ensure all state is initialized
      setTimeout(() => {
        allowBuilding.current = true
      }, 50)
      return
    }

    // Skip if this is a value we just sent via onChange
    if (!value || value === lastSentValue.current) {
      return
    }

    // External value change detected - re-parse
    allowBuilding.current = false
    const parsed = parseInitialState(value)
    setFrequency(parsed.frequency)
    setHour(parsed.hour)
    setMinute(parsed.minute)
    setSelectedDaysOfWeek(parsed.selectedDaysOfWeek)
    setDayOfMonth(parsed.dayOfMonth)
    lastSentValue.current = value
    // Re-enable building after state updates settle
    setTimeout(() => {
      allowBuilding.current = true
    }, 50)
  }, [value])

  // Build cron expression from visual builder
  const buildCronExpression = () => {
    switch (frequency) {
      case 'daily':
        return `${minute} ${hour} * * *`
      case 'weekly': {
        // Use 3-letter abbreviations so APScheduler from_crontab() maps
        // them correctly (numeric POSIX 5 = Friday, but APScheduler-native
        // 5 = Saturday, so names avoid the off-by-one bug).
        const days = selectedDaysOfWeek.length > 0
          ? selectedDaysOfWeek.sort((a, b) => a - b).map(d => DAY_ABBR[d]).join(',')
          : 'mon'
        return `${minute} ${hour} * * ${days}`
      }
      case 'monthly':
        return `${minute} ${hour} ${dayOfMonth} * *`
      case 'custom':
        return value
      default:
        return value
    }
  }

  // Update cron expression when visual builder changes
  useEffect(() => {
    if (!allowBuilding.current || frequency === 'custom') return

    const newCron = buildCronExpression()
    if (newCron !== lastSentValue.current) {
      lastSentValue.current = newCron
      onChange(newCron)
    }
  }, [frequency, hour, minute, selectedDaysOfWeek, dayOfMonth])

  useEffect(() => {
    if (!value) {
      setPreview('')
      setError('')
      return
    }
    try {
      const description = cronstrue.toString(value, { throwExceptionOnParseError: true })
      setPreview(description)
      setError('')
    } catch {
      setPreview('')
      setError(t('triggers.form.cronExpressionInvalid', 'Invalid cron expression'))
    }
  }, [value, t])

  const toggleDayOfWeek = (day: number) => {
    setSelectedDaysOfWeek(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  const handleFrequencyChange = (newFrequency: FrequencyType) => {
    setFrequency(newFrequency)
  }

  const handleHourChange = (newHour: number) => {
    setHour(newHour)
  }

  const handleMinuteChange = (newMinute: number) => {
    setMinute(newMinute)
  }

  const handleDayOfMonthChange = (newDay: number) => {
    setDayOfMonth(newDay)
  }

  const handleRawCronChange = (newValue: string) => {
    setFrequency('custom')
    lastSentValue.current = newValue
    onChange(newValue)
  }

  return (
    <div className="space-y-4">
      {/* Human-readable preview prominently displayed at the top */}
      {preview && !error && (
        <Alert severity="success" sx={{ fontSize: '1rem', fontWeight: 500 }}>
          {preview}
          {utcOffsetHours !== 0 && (
            <span style={{ display: 'block', marginTop: 4, fontSize: '0.85em', opacity: 0.8 }}>
              ⚠ Times are in UTC. Your browser is {utcLabel} — adjust hours accordingly.
            </span>
          )}
        </Alert>
      )}
      {error && <Alert severity="error">{error}</Alert>}

      {/* Visual Builder */}
      <Box className="space-y-3">
        <FormControl fullWidth size="small">
          <InputLabel>Frequency</InputLabel>
          <Select
            value={frequency}
            onChange={e => handleFrequencyChange(e.target.value as FrequencyType)}
            disabled={disabled}
            label="Frequency"
          >
            <MenuItem value="daily">Daily</MenuItem>
            <MenuItem value="weekly">Weekly</MenuItem>
            <MenuItem value="monthly">Monthly</MenuItem>
            <MenuItem value="custom">Custom (Advanced)</MenuItem>
          </Select>
        </FormControl>

        {frequency !== 'custom' && (
          <Box className="flex gap-3">
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Hour</InputLabel>
              <Select
                value={hour}
                onChange={e => handleHourChange(Number(e.target.value))}
                disabled={disabled}
                label="Hour"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <MenuItem key={i} value={i}>
                    {i.toString().padStart(2, '0')}:00
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Minute</InputLabel>
              <Select
                value={minute}
                onChange={e => handleMinuteChange(Number(e.target.value))}
                disabled={disabled}
                label="Minute"
              >
                {[0, 15, 30, 45].map(m => (
                  <MenuItem key={m} value={m}>
                    :{m.toString().padStart(2, '0')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}

        {frequency === 'weekly' && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Days of Week
            </Typography>
            <FormGroup row>
              {daysOfWeek.map(day => (
                <FormControlLabel
                  key={day.value}
                  control={
                    <Checkbox
                      checked={selectedDaysOfWeek.includes(day.value)}
                      onChange={() => toggleDayOfWeek(day.value)}
                      disabled={disabled}
                      size="small"
                    />
                  }
                  label={day.label.slice(0, 3)}
                />
              ))}
            </FormGroup>
          </Box>
        )}

        {frequency === 'monthly' && (
          <FormControl fullWidth size="small">
            <InputLabel>Day of Month</InputLabel>
            <Select
              value={dayOfMonth}
              onChange={e => handleDayOfMonthChange(Number(e.target.value))}
              disabled={disabled}
              label="Day of Month"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                <MenuItem key={d} value={d}>
                  {d}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      {/* Advanced Mode Toggle */}
      <Button
        size="small"
        variant="text"
        onClick={() => setShowAdvanced(!showAdvanced)}
        endIcon={showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      >
        {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
      </Button>

      {/* Advanced: Raw Cron Expression */}
      <Collapse in={showAdvanced}>
        <TextField
          fullWidth
          label="Raw Cron Expression"
          value={value}
          onChange={e => handleRawCronChange(e.target.value)}
          disabled={disabled}
          placeholder="0 9 * * 1"
          helperText="Format: minute hour day-of-month month day-of-week"
          error={!!error}
          size="small"
        />
      </Collapse>
    </div>
  )
}

export default CronConfigForm
