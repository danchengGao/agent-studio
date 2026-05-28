/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import React, { useState } from 'react'
import { Tooltip, IconButton, Input, Select, Switch } from '@douyinfe/semi-ui'
import { Info, Minus, Plus, ChevronDown, ChevronRight } from 'lucide-react'

import { VariableSelector, VariableSelectorProvider, TypeSelector, DisplaySchemaTag } from '../../../form-materials'
import { cn } from '../../../utils/cn'
import { DraggableList } from '../../../form-components/draggable-list'
import { useTranslation } from '../../../i18n'
import { VariableGroup, MergeMode, CombineBy, MergeOutputType, GroupCardProps } from '../types'
import {
  GroupCardWrapper,
  GroupHeader,
  GroupInfo,
  GroupName,
  GroupMeta,
  InfoIcon,
  DeleteGroupButton,
  EmptyVariables,
  EmptyContent,
  EmptyIcon as EmptyIconStyled,
  EmptyText,
} from './styles'

const fieldRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '4px 8px',
}

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#666',
  whiteSpace: 'nowrap',
  minWidth: '80px',
}

export const GroupCard: React.FC<GroupCardProps> = ({
  group,
  groupIndex,
  groupsLength,
  onUpdate,
  onDelete,
  availableVariables,
  inferVariableType,
  getGroupType,
  readOnly = false,
}) => {
  const { t } = useTranslation()
  const [isEditingName, setIsEditingName] = useState(false)
  const [editingName, setEditingName] = useState(group.name)

  const mode = group.mode || MergeMode.FIRST_NON_NULL
  const combineBy = group.combineBy || CombineBy.MATCHING_FIELDS
  const [clashOpen, setClashOpen] = useState(false)

  const patch = (fields: Partial<VariableGroup>) => onUpdate(groupIndex, { ...group, ...fields })

  const handleNameUpdate = (newName: string) => {
    if (newName.trim() && newName !== group.name) patch({ name: newName.trim() })
    setIsEditingName(false)
  }

  const getCurrentGroupSelectedVariables = () => {
    const selectedVars = new Set<string>()
    group.items.forEach(item => {
      if (item && item.trim()) {
        selectedVars.add(item)
      }
    })
    return selectedVars
  }

  const handleVariableChange = (itemIndex: number, val: string[]) => {
    const newItems = [...group.items]
    const selectedVariable = val?.join('.') || ''
    newItems[itemIndex] = selectedVariable
    const fields: Partial<VariableGroup> = { items: newItems }
    if (itemIndex === 0) fields.type = inferVariableType(selectedVariable, availableVariables)
    patch(fields)
  }

  const handleDeleteVariable = (itemIndex: number) => {
    let newItems = group.items.filter((_, i) => i !== itemIndex)
    if (newItems.length === 0) newItems = ['']
    const fields: Partial<VariableGroup> = { items: newItems }
    if (itemIndex === 0 && newItems.length > 0 && newItems[0]) {
      fields.type = inferVariableType(newItems[0], availableVariables)
    }
    patch(fields)
  }

  const handleVariablesChange = (newItems: string[]) => {
    const fields: Partial<VariableGroup> = { items: newItems }
    if (newItems.length > 0 && newItems[0] !== group.items[0]) {
      fields.type = inferVariableType(newItems[0], availableVariables)
    }
    patch(fields)
  }

  const createSchemaFilter = (groupType: string) => {
    if (group.items.length === 0) {
      return {}
    }
    return { type: groupType as any, extra: { weak: true } }
  }

  const isGroupEmpty = group.items.length === 0 || group.items.every(item => !item || item.trim() === '')

  const isCombineMode = mode === MergeMode.COMBINE

  const renderVariableItem = (item: string, index: number, _provided: any) => {
    const schemaFilter = isGroupEmpty ? {} : createSchemaFilter(getGroupType(group))
    const currentGroupSelectedVars = getCurrentGroupSelectedVariables()
    const currentVar = group.items[index]
    const filteredVars = new Set(currentGroupSelectedVars)
    if (currentVar && currentVar.trim()) filteredVars.delete(currentVar)

    const skipVariable = (variable: any) => {
      if (!variable || !variable.key) return false
      const getVariableKeyString = (v: any): string => {
        if (v.keyPath && Array.isArray(v.keyPath) && v.keyPath.length > 0) {
          return v.keyPath.map((k: any, idx: number) => (k === '[0]' || idx === 0 ? k : `.${k}`)).join('')
        }
        return v.key
      }
      const key = getVariableKeyString(variable)
      for (const s of filteredVars) { if (s === key) return true }
      return false
    }

    const selector = isGroupEmpty ? (
      <VariableSelectorProvider>
        <VariableSelector value={item ? [item] : []} onChange={(val?: string[]) => handleVariableChange(index, val || [])} style={{ width: '100%' }} />
      </VariableSelectorProvider>
    ) : (
      <VariableSelectorProvider skipVariable={skipVariable} includeSchema={schemaFilter}>
        <VariableSelector value={item ? [item] : []} onChange={(val?: string[]) => handleVariableChange(index, val || [])} style={{ width: '100%' }} />
      </VariableSelectorProvider>
    )

    if (!isCombineMode) return selector

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '11px', color: '#999', whiteSpace: 'nowrap', minWidth: '42px' }}>
          {t('workflowCanvas.nodes.variableMerge.inputField')}
        </span>
        <div style={{ flex: 1 }}>{selector}</div>
      </div>
    )
  }

  // ── Mode options ─────────────────────────────────────────────────────────
  const modeOptions = [
    { value: MergeMode.FIRST_NON_NULL, label: t('workflowCanvas.nodes.variableMerge.modeFirstNonNull') },
    { value: MergeMode.APPEND,         label: t('workflowCanvas.nodes.variableMerge.modeAppend') },
    { value: MergeMode.COMBINE,        label: t('workflowCanvas.nodes.variableMerge.modeCombine') },
    { value: MergeMode.CHOOSE_BRANCH,  label: t('workflowCanvas.nodes.variableMerge.modeChooseBranch') },
    { value: MergeMode.SQL_QUERY,      label: t('workflowCanvas.nodes.variableMerge.modeSqlQuery') },
  ]

  // ── Combine sub-options ──────────────────────────────────────────────────
  const combineByOptions = [
    { value: CombineBy.MATCHING_FIELDS,  label: t('workflowCanvas.nodes.variableMerge.combineByMatchingFields') },
    { value: CombineBy.POSITION,         label: t('workflowCanvas.nodes.variableMerge.combineByPosition') },
    { value: CombineBy.ALL_COMBINATIONS, label: t('workflowCanvas.nodes.variableMerge.combineByAllCombinations') },
  ]

  const outputTypeOptions = [
    { value: MergeOutputType.KEEP_MATCHES,    label: t('workflowCanvas.nodes.variableMerge.outputTypeKeepMatches') },
    { value: MergeOutputType.ENRICH_INPUT1,   label: t('workflowCanvas.nodes.variableMerge.outputTypeEnrichInput1') },
    { value: MergeOutputType.KEEP_EVERYTHING, label: t('workflowCanvas.nodes.variableMerge.outputTypeKeepEverything') },
  ]

  // ── Choose branch input labels ───────────────────────────────────────────
  const branchOptions = group.items.map((_, i) => ({
    value: i,
    label: `Input ${i + 1}`,
  }))

  return (
    <GroupCardWrapper className={cn(readOnly && 'read-only')}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <GroupHeader>
        <GroupInfo>
          {isEditingName && !readOnly ? (
            <Input
              value={editingName}
              onChange={setEditingName}
              onBlur={() => handleNameUpdate(editingName)}
              onKeyDown={e => {
                if (e.key === 'Escape') { setIsEditingName(false); setEditingName(group.name) }
              }}
              size="small"
              style={{
                width: '120px',
                fontSize: '12px',
                fontWeight: '500',
                height: '20px',
              }}
              maxLength={20}
              autoFocus
            />
          ) : (
            <GroupName
              onClick={() => {
                if (!readOnly) {
                  setIsEditingName(true)
                  setEditingName(group.name)
                }
              }}
              style={{ cursor: readOnly ? 'default' : 'pointer' }}
            >
              {group.name}
            </GroupName>
          )}

          <GroupMeta>
            {isGroupEmpty && !readOnly ? (
              <TypeSelector
                value={{ type: group.type || 'string' }}
                onChange={value => patch({ type: value?.type || 'string' })}
              />
            ) : (
              <DisplaySchemaTag value={{ type: group.type || 'string' }} />
            )}
            <Tooltip content={t('workflowCanvas.nodes.variableMerge.tooltipType')}>
              <InfoIcon as="span">
                <Info size={14} />
              </InfoIcon>
            </Tooltip>
          </GroupMeta>
        </GroupInfo>

        {!readOnly && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <IconButton size="small" icon={<Plus size={14} />} onClick={() => patch({ items: [...group.items, ''] })} theme="borderless" style={{ width: '20px', height: '20px', color: '#999' }} />
            <DeleteGroupButton as="span" style={{ cursor: groupsLength > 1 ? 'pointer' : 'not-allowed' }}>
              <IconButton size="small" icon={<Minus size={14} />} onClick={() => groupsLength > 1 && onDelete(groupIndex)} disabled={groupsLength <= 1} style={{ width: '20px', height: '20px', color: groupsLength > 1 ? '#999' : '#ccc', cursor: groupsLength > 1 ? 'pointer' : 'not-allowed' }} />
            </DeleteGroupButton>
          </div>
        )}
      </GroupHeader>

      {/* ── Mode selector ──────────────────────────────────────────────── */}
      {!readOnly && (
        <div style={fieldRowStyle}>
          <span style={labelStyle}>{t('workflowCanvas.nodes.variableMerge.mode')}</span>
          <Select value={mode} onChange={val => patch({ mode: val as MergeMode })} size="small" style={{ flex: 1 }}>
            {modeOptions.map(o => <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>)}
          </Select>
        </div>
      )}

      {/* ── Append options ─────────────────────────────────────────────── */}
      {!readOnly && mode === MergeMode.APPEND && (
        <>
          <div style={fieldRowStyle}>
            <span style={labelStyle}>{t('workflowCanvas.nodes.variableMerge.numberOfInputs')}</span>
            <Select
              value={group.appendInputCount ?? 2}
              onChange={val => {
                const count = val as number
                const currentItems = group.items || []
                const newItems = Array.from({ length: count }, (_, i) => currentItems[i] ?? '')
                patch({ appendInputCount: count, items: newItems })
              }}
              size="small"
              style={{ flex: 1 }}
            >
              {Array.from({ length: 9 }, (_, i) => i + 2).map(n => (
                <Select.Option key={n} value={n}>{n}</Select.Option>
              ))}
            </Select>
          </div>
          {Array.from({ length: group.appendInputCount ?? 2 }, (_, i) => (
            <div key={i} style={fieldRowStyle}>
              <span style={labelStyle}>{`${t('workflowCanvas.nodes.variableMerge.input')} ${i + 1}`}</span>
              <div style={{ flex: 1 }}>
                <VariableSelectorProvider>
                  <VariableSelector
                    value={group.items[i] ? [group.items[i]] : []}
                    onChange={(val?: string[]) => handleVariableChange(i, val || [])}
                    style={{ width: '100%' }}
                  />
                </VariableSelectorProvider>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── Variable list ──────────────────────────────────────────────── */}
      {mode !== MergeMode.APPEND && (
        <>
          <DraggableList
            items={group.items}
            onChange={handleVariablesChange}
            renderItem={renderVariableItem}
            onDelete={handleDeleteVariable}
            readOnly={readOnly}
            showDragHandle={true}
            canDelete={true}
            canAdd={false}
            isDragDisabled={() => group.items.length <= 1}
            isDeleteDisabled={() => group.items.length <= 1}
          />

          {group.items.length === 0 && (
            <EmptyVariables>
              <EmptyContent>
                <EmptyIconStyled>
                  <Plus size={16} />
                </EmptyIconStyled>
                <EmptyText>{t('workflowCanvas.nodes.variableMerge.noVariables')}</EmptyText>
              </EmptyContent>
            </EmptyVariables>
          )}
        </>
      )}

      {!readOnly && isCombineMode && (
        <div
          onClick={() => patch({ items: [...group.items, ''] })}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px 6px', fontSize: '12px', color: '#666', cursor: 'pointer' }}
        >
          <Plus size={12} />
          {t('workflowCanvas.nodes.variableMerge.addInput')}
        </div>
      )}

      {/* ── Combine options ────────────────────────────────────────────── */}
      {!readOnly && mode === MergeMode.COMBINE && (
        <>
          <div style={fieldRowStyle}>
            <span style={labelStyle}>{t('workflowCanvas.nodes.variableMerge.combineBy')}</span>
            <Select value={combineBy} onChange={val => patch({ combineBy: val as CombineBy })} size="small" style={{ flex: 1 }}>
              {combineByOptions.map(o => <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>)}
            </Select>
          </div>

          {combineBy === CombineBy.MATCHING_FIELDS && (
            <>
              <div style={fieldRowStyle}>
                <span style={labelStyle}>{t('workflowCanvas.nodes.variableMerge.matchField1')}</span>
                <Input size="small" placeholder={t('workflowCanvas.nodes.variableMerge.matchFieldPlaceholder')} value={group.matchField1 || ''} onChange={val => patch({ matchField1: val })} style={{ flex: 1 }} />
              </div>
              <div style={fieldRowStyle}>
                <span style={labelStyle}>{t('workflowCanvas.nodes.variableMerge.matchField2')}</span>
                <Input size="small" placeholder={t('workflowCanvas.nodes.variableMerge.matchFieldPlaceholder')} value={group.matchField2 || ''} onChange={val => patch({ matchField2: val })} style={{ flex: 1 }} />
              </div>
              <div style={fieldRowStyle}>
                <span style={labelStyle}>{t('workflowCanvas.nodes.variableMerge.outputType')}</span>
                <Select value={group.outputType || MergeOutputType.KEEP_MATCHES} onChange={val => patch({ outputType: val as MergeOutputType })} size="small" style={{ flex: 1 }}>
                  {outputTypeOptions.map(o => <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>)}
                </Select>
              </div>
            </>
          )}

          {combineBy === CombineBy.POSITION && (
            <div style={fieldRowStyle}>
              <span style={labelStyle}>{t('workflowCanvas.nodes.variableMerge.keepUnpaired')}</span>
              <Switch checked={group.keepUnpaired ?? false} onChange={checked => patch({ keepUnpaired: checked })} size="small" />
            </div>
          )}

          {/* Fuzzy compare + clash handling: shared by Matching Fields and Position */}
          {(combineBy === CombineBy.MATCHING_FIELDS || combineBy === CombineBy.POSITION) && (
            <>
              <div style={fieldRowStyle}>
                <span style={labelStyle}>{t('workflowCanvas.nodes.variableMerge.fuzzyCompare')}</span>
                <Switch checked={group.fuzzyCompare ?? false} onChange={checked => patch({ fuzzyCompare: checked })} size="small" />
              </div>
              <div
                onClick={() => setClashOpen(o => !o)}
                style={{ padding: '6px 8px 4px', fontSize: '12px', color: '#444', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', userSelect: 'none' }}
              >
                {clashOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                {t('workflowCanvas.nodes.variableMerge.clashHandling')}
              </div>
              {clashOpen && (
                <>
                  <div style={fieldRowStyle}>
                    <span style={labelStyle}>{t('workflowCanvas.nodes.variableMerge.clashWhenClash')}</span>
                    <Select value={group.clashWhenClash ?? 'addInputNumber'} onChange={val => patch({ clashWhenClash: val as any })} size="small" style={{ flex: 1 }}>
                      <Select.Option value="addInputNumber">{t('workflowCanvas.nodes.variableMerge.clashAddInputNumber')}</Select.Option>
                      <Select.Option value="preferInput1">{t('workflowCanvas.nodes.variableMerge.clashPreferInput1')}</Select.Option>
                      <Select.Option value="preferInput2">{t('workflowCanvas.nodes.variableMerge.clashPreferInput2')}</Select.Option>
                    </Select>
                  </div>
                  <div style={fieldRowStyle}>
                    <span style={labelStyle}>{t('workflowCanvas.nodes.variableMerge.clashMergingNested')}</span>
                    <Select value={group.clashMergingNested ?? 'shallowMerge'} onChange={val => patch({ clashMergingNested: val as any })} size="small" style={{ flex: 1 }}>
                      <Select.Option value="shallowMerge">{t('workflowCanvas.nodes.variableMerge.clashShallowMerge')}</Select.Option>
                      <Select.Option value="deepMerge">{t('workflowCanvas.nodes.variableMerge.clashDeepMerge')}</Select.Option>
                    </Select>
                  </div>
                  <div style={fieldRowStyle}>
                    <span style={labelStyle}>{t('workflowCanvas.nodes.variableMerge.clashMinimizeEmptyFields')}</span>
                    <Switch checked={group.clashMinimizeEmptyFields ?? false} onChange={checked => patch({ clashMinimizeEmptyFields: checked })} size="small" />
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* ── SQL Query options ─────────────────────────────────────────── */}
      {!readOnly && mode === MergeMode.SQL_QUERY && (
        <div style={{ padding: '4px 8px 6px' }}>
          <div style={{ ...labelStyle, marginBottom: '4px' }}>{t('workflowCanvas.nodes.variableMerge.sqlQuery')}</div>
          <textarea
            value={group.sqlQuery || ''}
            onChange={e => patch({ sqlQuery: e.target.value })}
            placeholder={t('workflowCanvas.nodes.variableMerge.sqlQueryPlaceholder')}
            rows={4}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: '12px', resize: 'vertical', boxSizing: 'border-box', padding: '4px 6px', border: '1px solid #d9d9d9', borderRadius: '4px' }}
          />
        </div>
      )}

      {/* ── Choose Branch options ──────────────────────────────────────── */}
      {!readOnly && mode === MergeMode.CHOOSE_BRANCH && (
        <div style={fieldRowStyle}>
          <span style={labelStyle}>{t('workflowCanvas.nodes.variableMerge.chooseBranchInput')}</span>
          <Select value={group.chooseIndex ?? 0} onChange={val => patch({ chooseIndex: val as number })} size="small" style={{ flex: 1 }}>
            {branchOptions.length > 0
              ? branchOptions.map(o => <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>)
              : <Select.Option value={0}>Input 1</Select.Option>
            }
            <Select.Option value={-1}>{t('workflowCanvas.nodes.variableMerge.chooseBranchEmpty')}</Select.Option>
          </Select>
        </div>
      )}

    </GroupCardWrapper>
  )
}
