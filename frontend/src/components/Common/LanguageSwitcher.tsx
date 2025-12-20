import React from 'react'
import { Select, MenuItem, FormControl, InputLabel, Box } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../contexts/LanguageContext'

interface LanguageSwitcherProps {
  size?: 'small' | 'medium'
  variant?: 'outlined' | 'filled' | 'standard'
  showLabel?: boolean
  className?: string
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ size = 'small', variant = 'outlined', showLabel = true, className }) => {
  const { t } = useTranslation()
  const { changeLanguage, availableLanguages, currentLanguage } = useLanguage()

  return (
    <Box className={className}>
      <FormControl size={size} variant={variant}>
        {showLabel && <InputLabel>{t('settings.general.language')}</InputLabel>}
        <Select
          value={currentLanguage}
          label={showLabel ? t('settings.general.language') : undefined}
          onChange={e => changeLanguage(e.target.value)}
          sx={{ minWidth: 120 }}
        >
          {availableLanguages.map(lang => (
            <MenuItem key={lang.code} value={lang.code}>
              {t(`languages.${lang.code}`)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  )
}

export default LanguageSwitcher
