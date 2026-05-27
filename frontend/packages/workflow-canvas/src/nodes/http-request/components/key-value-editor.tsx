/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import React, { useCallback, useMemo } from 'react'
import { Button, Input } from '@douyinfe/semi-ui'
import { IconPlus, IconDelete } from '@douyinfe/semi-icons'

import { useTranslation } from '../../../i18n'

interface KeyValuePair {
  id: string
  key: string
  value: string
}

interface KeyValueEditorProps {
  value: Record<string, string>
  onChange: (value: Record<string, string>) => void
  addLabel?: string
  keyPlaceholder?: string
  valuePlaceholder?: string
}

let nextId = 0
const genId = () => `kv_${++nextId}`

export function KeyValueEditor({ value, onChange, addLabel, keyPlaceholder, valuePlaceholder }: KeyValueEditorProps) {
  const { t } = useTranslation()

  const pairs: KeyValuePair[] = useMemo(() => {
    const entries = Object.entries(value || {})
    if (entries.length === 0) {
      return []
    }
    return entries.map(([k, v]) => ({ id: genId(), key: k, value: v }))
  }, [])

  const [localPairs, setLocalPairs] = React.useState<KeyValuePair[]>(pairs)

  const syncToParent = useCallback(
    (updatedPairs: KeyValuePair[]) => {
      const result: Record<string, string> = {}
      for (const pair of updatedPairs) {
        if (pair.key.trim()) {
          result[pair.key] = pair.value
        }
      }
      onChange(result)
    },
    [onChange],
  )

  const handleAdd = useCallback(() => {
    const updated = [...localPairs, { id: genId(), key: '', value: '' }]
    setLocalPairs(updated)
  }, [localPairs])

  const handleRemove = useCallback(
    (id: string) => {
      const updated = localPairs.filter((p) => p.id !== id)
      setLocalPairs(updated)
      syncToParent(updated)
    },
    [localPairs, syncToParent],
  )

  const handleKeyChange = useCallback(
    (id: string, newKey: string) => {
      const updated = localPairs.map((p) => (p.id === id ? { ...p, key: newKey } : p))
      setLocalPairs(updated)
      syncToParent(updated)
    },
    [localPairs, syncToParent],
  )

  const handleValueChange = useCallback(
    (id: string, newValue: string) => {
      const updated = localPairs.map((p) => (p.id === id ? { ...p, value: newValue } : p))
      setLocalPairs(updated)
      syncToParent(updated)
    },
    [localPairs, syncToParent],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {localPairs.map((pair) => (
        <div key={pair.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <Input
            size="small"
            style={{ flex: 1 }}
            placeholder={keyPlaceholder || t('workflowCanvas.nodes.httpRequest.keyPlaceholder') || 'Key'}
            value={pair.key}
            onChange={(val) => handleKeyChange(pair.id, val)}
          />
          <Input
            size="small"
            style={{ flex: 1 }}
            placeholder={valuePlaceholder || t('workflowCanvas.nodes.httpRequest.valuePlaceholder') || 'Value'}
            value={pair.value}
            onChange={(val) => handleValueChange(pair.id, val)}
          />
          <Button size="small" icon={<IconDelete />} type="tertiary" theme="borderless" onClick={() => handleRemove(pair.id)} />
        </div>
      ))}
      <Button size="small" icon={<IconPlus />} type="tertiary" theme="borderless" onClick={handleAdd} style={{ alignSelf: 'flex-start' }}>
        {addLabel || t('workflowCanvas.nodes.httpRequest.addPair') || 'Add'}
      </Button>
    </div>
  )
}
