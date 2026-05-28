import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { ToggleButtonGroup, ToggleButton, Tooltip } from '@mui/material'
import { Layers, Sliders } from 'lucide-react'

// ── Context ───────────────────────────────────────────────────────────────────

type EvaluationMode = 'basic' | 'advanced'

interface EvaluationModeContextValue {
  mode: EvaluationMode
  isAdvanced: boolean
  setMode: (mode: EvaluationMode) => void
}

const STORAGE_KEY = 'evaluation_ui_mode'

const EvaluationModeContext = createContext<EvaluationModeContextValue>({
  mode: 'basic',
  isAdvanced: false,
  setMode: () => {},
})

// ── Provider ─────────────────────────────────────────────────────────────────

export function EvaluationModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<EvaluationMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored === 'advanced' ? 'advanced' : 'basic'
    } catch {
      return 'basic'
    }
  })

  const setMode = useCallback((newMode: EvaluationMode) => {
    setModeState(newMode)
    try {
      localStorage.setItem(STORAGE_KEY, newMode)
    } catch { /* ignore */ }
  }, [])

  return (
    <EvaluationModeContext.Provider value={{ mode, isAdvanced: mode === 'advanced', setMode }}>
      {children}
    </EvaluationModeContext.Provider>
  )
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useEvaluationMode() {
  return useContext(EvaluationModeContext)
}

// ── Toggle Button Component ───────────────────────────────────────────────────

/**
 * Small toggle that switches between Basic and Advanced mode.
 * Place it in the EvaluationPage header area.
 *
 * Basic mode hides:
 *   - Pattern Type field (task form)
 *   - Custom Metrics button
 *   - pass@k / pass^k / flakiness details
 *   - Grader weight inputs
 *   - Raw JSON graders editor
 *
 * Advanced mode shows everything.
 */
export function BasicAdvancedToggle() {
  const { mode, setMode } = useEvaluationMode()

  return (
    <Tooltip
      title={
        mode === 'basic'
          ? 'Basic mode: simplified view. Switch to Advanced to see all options.'
          : 'Advanced mode: all options visible. Switch to Basic for a cleaner view.'
      }
      placement="bottom"
    >
      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={(_, val) => { if (val) setMode(val as EvaluationMode) }}
        size="small"
        sx={{ height: 32 }}
      >
        <ToggleButton value="basic" sx={{ px: 1.5, gap: 0.5, textTransform: 'none', fontSize: '0.75rem' }}>
          <Layers size={13} />
          Basic
        </ToggleButton>
        <ToggleButton value="advanced" sx={{ px: 1.5, gap: 0.5, textTransform: 'none', fontSize: '0.75rem' }}>
          <Sliders size={13} />
          Advanced
        </ToggleButton>
      </ToggleButtonGroup>
    </Tooltip>
  )
}

// ── Conditional Display Helper ────────────────────────────────────────────────

/**
 * Renders children only in Advanced mode.
 * Use to wrap fields that beginners don't need to see.
 *
 * Example:
 *   <AdvancedOnly>
 *     <PatternTypeField />
 *   </AdvancedOnly>
 */
export function AdvancedOnly({ children }: { children: ReactNode }) {
  const { isAdvanced } = useEvaluationMode()
  return isAdvanced ? <>{children}</> : null
}
