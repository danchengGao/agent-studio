/**
 * Copyright (c) Huawei Technologies Co., Ltd. 2025. All rights reserved.
 *
 * Knowledge Retrieval node form meta - renders the sidebar configuration panel
 */

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import {
  FormMeta,
  ValidateTrigger,
  FlowNodeFormData,
  FormModelV2,
  FormRenderProps,
  FlowNodeJSON,
  Field,
} from '@flowgram.ai/free-layout-editor'

import { DataEvent, Effect, EffectOptions } from '@flowgram.ai/editor'
import {
  provideJsonSchemaOutputs,
  syncVariableTitle,
  autoRenameRefEffect,
  validateWhenVariableSync,
  listenRefSchemaChange,
} from '../../form-materials'
import { validation } from './validation'
import { useNodeRenderContext, useIsSidebar } from '../../hooks'
import { FormHeader, FormContent, FormInput, FormOutput, FormModel, FormDisplay, FormItem } from '../../form-components'
import { useTranslation } from '../../i18n'
import { KnowledgeBaseService } from '@test-agentstudio/api-client'
import { Tag } from '@douyinfe/semi-ui'

// --- Helper to get the form model from node context ---

function useFormModel(): FormModelV2 | null {
  const { node } = useNodeRenderContext()
  try {
    return node.getData(FlowNodeFormData)?.getFormModel<FormModelV2>() ?? null
  } catch {
    return null
  }
}

function useKnowledgeRetrievalParam(): Record<string, any> {
  const formModel = useFormModel()
  if (!formModel) return {}
  try {
    return formModel.getValueIn<Record<string, any>>('inputs.knowledgeRetrievalParam') || {}
  } catch {
    return {}
  }
}

function updateKnowledgeRetrievalParam(formModel: FormModelV2 | null, updates: Record<string, any>) {
  if (!formModel) return
  try {
    const current = formModel.getValueIn<Record<string, any>>('inputs.knowledgeRetrievalParam') || {}
    formModel.setValueIn('inputs.knowledgeRetrievalParam', { ...current, ...updates })
  } catch (e) {
    console.error('Failed to update knowledgeRetrievalParam:', e)
  }
}

// --- Knowledge Base Selector (inline lightweight) ---

interface KnowledgeBaseInfo {
  id: string
  name: string
  description?: string
  has_graph_enhancement?: boolean
}

function KnowledgeRetrievalKBList({ onKBChange }: { onKBChange?: () => void } = {}) {
  const { t } = useTranslation()
  const isSidebar = useIsSidebar()
  const formModel = useFormModel()
  const [kbList, setKbList] = useState<KnowledgeBaseInfo[]>([])
  const [showSelector, setShowSelector] = useState(false)
  const [availableKBs, setAvailableKBs] = useState<KnowledgeBaseInfo[]>([])
  const [loading, setLoading] = useState(false)
  const initializedRef = useRef(false)

  // Read current KB IDs and stored info from form data
  const krParam = useKnowledgeRetrievalParam()
  const kbIds: string[] = krParam.kbIds || []
  const storedKbInfo: KnowledgeBaseInfo[] = krParam.kbInfo || []

  // Sync kbList with form model data — keeps canvas and sidebar in sync
  const kbIdsKey = JSON.stringify(kbIds)
  useEffect(() => {
    if (storedKbInfo.length > 0) {
      // Use stored info for immediate display, but always refresh from API on first load
      // to pick up changes to has_graph_enhancement and other KB metadata
      setKbList(storedKbInfo)
      if (!initializedRef.current) {
        fetchKnowledgeBases(true)
      }
    } else if (kbIds.length > 0) {
      // Fallback: use IDs as names and fetch real names
      setKbList(kbIds.map(id => ({ id, name: id })))
      if (!initializedRef.current) {
        fetchKnowledgeBases()
      }
    } else {
      setKbList([])
    }
    initializedRef.current = true
  }, [kbIdsKey])

  const fetchKnowledgeBases = useCallback(async (notifyChange = false) => {
    setLoading(true)
    try {
      // Dynamically import spaceUtils to get the current space ID
      const spaceUtilsModule = await import('../../../../../src/utils/spaceUtils')
      const spaceId = spaceUtilsModule.getDefaultSpaceId()

      const response = await KnowledgeBaseService.getKnowledgeBases({
        space_id: spaceId,
        page: 1,
        size: 100,
      })

      if (response?.data?.items) {
        const kbs = response.data.items.map((item: any) => ({
          id: item.id,
          name: item.name,
          description: item.desc || item.description || '',
          has_graph_enhancement: item.has_graph_enhancement || false,
        }))
        setAvailableKBs(kbs)

        // Update names of already-selected KBs and persist to form model
        if (kbIds.length > 0) {
          const updatedList = kbIds
            .map(id => kbs.find((kb: KnowledgeBaseInfo) => kb.id === id) || { id, name: id, description: '', has_graph_enhancement: false })
          setKbList(updatedList)
          updateKnowledgeRetrievalParam(formModel, {
            kbInfo: updatedList.map(k => ({ id: k.id, name: k.name, description: k.description, has_graph_enhancement: k.has_graph_enhancement })),
          })
          if (notifyChange) {
            onKBChange?.()
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch knowledge bases:', error)
    } finally {
      setLoading(false)
    }
  }, [kbIds, onKBChange])

  const handleAdd = () => {
    fetchKnowledgeBases()
    setShowSelector(true)
  }

  const handleToggleKB = (kb: KnowledgeBaseInfo) => {
    const isSelected = kbList.some(k => k.id === kb.id)
    let newList: KnowledgeBaseInfo[]
    if (isSelected) {
      newList = [] // Deselect
    } else {
      newList = [kb] // Single selection only
    }
    setKbList(newList)
    const hasGraph = newList.length > 0 && newList[0].has_graph_enhancement
    updateKnowledgeRetrievalParam(formModel, {
      kbIds: newList.map(k => k.id),
      kbInfo: newList.map(k => ({ id: k.id, name: k.name, description: k.description, has_graph_enhancement: k.has_graph_enhancement })),
      ...(!hasGraph ? { useGraph: false } : {}),
    })
    onKBChange?.()
  }

  const handleRemoveKB = (kbId: string) => {
    const newList = kbList.filter(k => k.id !== kbId)
    setKbList(newList)
    updateKnowledgeRetrievalParam(formModel, {
      kbIds: newList.map(k => k.id),
      kbInfo: newList.map(k => ({ id: k.id, name: k.name, description: k.description, has_graph_enhancement: k.has_graph_enhancement })),
      useGraph: false,
    })
    onKBChange?.()
  }

  // Canvas mode: use Field for reactive updates when KB changes
  if (!isSidebar) {
    return (
      <Field name="inputs.knowledgeRetrievalParam">
        {({ field }: { field: { value: any } }) => {
          const param = field.value || {}
          const info: KnowledgeBaseInfo[] = param.kbInfo || []
          const hasKB = info.length > 0
          return (
            <>
              <FormDisplay
                label={t('workflowCanvas.nodes.knowledgeRetrieval.knowledge')}
                content={
                  hasKB ? (
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info[0].name}</span>
                  ) : (
                    <Tag
                      color="amber"
                      size="small"
                      style={{
                        fontSize: '10px',
                        lineHeight: '14px',
                        padding: '1px 6px',
                        margin: 0,
                        borderRadius: '4px',
                      }}
                    >
                      {t('workflowCanvas.nodes.knowledgeRetrieval.noKnowledgeBase')}
                    </Tag>
                  )
                }
              />
            </>
          )
        }}
      </Field>
    )
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#1d2129' }}>
          {t('workflowCanvas.nodes.knowledgeRetrieval.targetKnowledge')}
          <span style={{ color: '#f93920', paddingLeft: '2px' }}>*</span>
        </span>
        <button
          onClick={handleAdd}
          style={{
            background: '#eff6ff',
            border: '1px solid #93b4f6',
            borderRadius: 4,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            padding: 0,
            fontSize: 16,
            color: '#3b82f6',
            lineHeight: 1,
          }}
          title={t('workflowCanvas.nodes.knowledgeRetrieval.addKnowledgeBase')}
        >
          +
        </button>
      </div>

      {/* Selected knowledge bases */}
      {kbList.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {kbList.map(kb => (
            <div
              key={kb.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                background: '#f2f3f5',
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', flex: 1, minWidth: 0 }}>
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: '#e8eafc',
                  flexShrink: 0,
                }}>
                  📄
                </span>
                <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kb.name}</div>
                  {kb.description && (
                    <div style={{ fontSize: 11, color: '#86909c', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kb.description}</div>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleRemoveKB(kb.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#86909c',
                  fontSize: 14,
                  padding: '0 4px',
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: '16px 12px',
            background: '#f7f8fa',
            borderRadius: 6,
            textAlign: 'center',
            color: '#86909c',
            fontSize: 12,
          }}
        >
          <div style={{ marginBottom: 4, fontSize: 20 }}>📋</div>
          {t('workflowCanvas.nodes.knowledgeRetrieval.noKnowledgeBase')}
        </div>
      )}

      {/* Validation error for required KB */}
      {kbList.length === 0 && (
        <div style={{ fontSize: 12, color: '#f53f3f', marginTop: 6 }}>
          {t('workflowCanvas.nodes.knowledgeRetrieval.knowledgeCannotBeEmpty')}
        </div>
      )}

      {/* KB Selection overlay */}
      {showSelector && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.3)',
          }}
          onClick={() => setShowSelector(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: 500,
              maxHeight: '70vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{t('workflowCanvas.nodes.knowledgeRetrieval.selectKnowledgeBase')}</h3>
              <button
                onClick={() => setShowSelector(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#86909c' }}
              >
                ×
              </button>
            </div>

            {/* Info note: only one KB can be selected */}
            <div style={{
              padding: '8px 12px',
              background: '#eff6ff',
              borderRadius: 6,
              fontSize: 12,
              color: '#3b82f6',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span>ℹ️</span>
              <span>{t('workflowCanvas.nodes.knowledgeRetrieval.singleKBNote')}</span>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#86909c' }}>Loading...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {availableKBs.map(kb => {
                  const isSelected = kbList.some(k => k.id === kb.id)
                  return (
                    <div
                      key={kb.id}
                      onClick={() => handleToggleKB(kb)}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 8,
                        border: `2px solid ${isSelected ? '#3b82f6' : '#e5e7eb'}`,
                        background: isSelected ? '#eff6ff' : '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 18 }}>📚</span>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{kb.name}</div>
                          {kb.description && (
                            <div style={{ fontSize: 12, color: '#86909c', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {kb.description}
                            </div>
                          )}
                        </div>
                        {isSelected && <span style={{ color: '#3b82f6', fontWeight: 600 }}>✓</span>}
                      </div>
                    </div>
                  )
                })}
                {availableKBs.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 24, color: '#86909c' }}>
                    {t('workflowCanvas.nodes.knowledgeRetrieval.noKnowledgeBase')}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, gap: 8 }}>
              <button
                onClick={() => setShowSelector(false)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 6,
                  border: '1px solid #d9d9d9',
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                {t('workflowCanvas.nodes.knowledgeRetrieval.close') || 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Rich Tooltip for Retrieval Options ---

function RetrievalTooltip({ title, steps, plain }: { title?: string; steps: { label: string; content: string }[]; plain?: boolean }) {
  const [show, setShow] = useState(false)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 })

  useLayoutEffect(() => {
    if (show && tooltipRef.current && triggerRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const tooltipHeight = tooltipRef.current.offsetHeight
      const tooltipWidth = tooltipRef.current.offsetWidth
      setPos({
        top: Math.max(8, triggerRect.top - tooltipHeight - 8),
        left: Math.max(8, Math.min(
          triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2,
          window.innerWidth - tooltipWidth - 8
        )),
      })
    }
  }, [show])

  return (
    <span
      ref={triggerRef}
      style={{ display: 'inline-flex' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span style={{ fontSize: 12, color: '#c9cdd4', cursor: 'help' }}>ⓘ</span>
      {show && (
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 10001,
            width: 350,
            padding: 16,
            background: '#fff',
            borderRadius: 10,
            boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
            border: '1px solid #e5e7eb',
          }}
        >
          {!plain && title && (
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: '#1d2129' }}>{title}</div>
          )}
          {plain ? (
            <div style={{ fontSize: 12, color: '#4e5969', lineHeight: 1.6 }}>
              {steps.map(s => s.content).join(' ')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {steps.map((step, idx) => (
                <div key={idx} style={{
                  background: idx === steps.length - 1 ? '#f0fdf4' : '#f7f8fa',
                  borderRadius: 8,
                  padding: '10px 12px',
                  borderLeft: `3px solid ${idx === steps.length - 1 ? '#22c55e' : '#3b82f6'}`,
                }}>
                  {step.label && (
                    <div style={{
                      fontWeight: 600,
                      fontSize: 11,
                      color: idx === steps.length - 1 ? '#16a34a' : '#3b82f6',
                      marginBottom: 4,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>{step.label}</div>
                  )}
                  <div style={{ fontSize: 12, color: '#4e5969', lineHeight: 1.5 }}>{step.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </span>
  )
}

// --- Retrieval Settings Panel ---

function KnowledgeRetrievalSettings() {
  const { t } = useTranslation()
  const formModel = useFormModel()
  const krParam = useKnowledgeRetrievalParam()

  const kbInfo: KnowledgeBaseInfo[] = krParam.kbInfo || []
  const hasGraphEnhancement = kbInfo.some(kb => kb.has_graph_enhancement)

  const [maxRecallCount, setMaxRecallCount] = useState<number>(krParam.maxRecallCount ?? 5)
  const [minMatchScore, setMinMatchScore] = useState<number>(krParam.minMatchScore ?? 0.5)
  const [useGraph, setUseGraph] = useState<boolean>((krParam.useGraph || false) && hasGraphEnhancement)
  const [agentic, setAgentic] = useState<boolean>(krParam.agentic || false)

  const minMatchScoreInputRef = useRef<string>('')

  const updateParam = useCallback(
    (updates: Record<string, any>) => {
      updateKnowledgeRetrievalParam(formModel, updates)
    },
    [formModel],
  )

  return (
    <div style={{ marginBottom: 16 }}>

      {/* Max Recall Count */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: '#4e5969' }}>
            {t('workflowCanvas.nodes.knowledgeRetrieval.maxRecallCount')}
          </span>
          <RetrievalTooltip
            title={t('workflowCanvas.nodes.knowledgeRetrieval.maxRecallCount')}
            plain
            steps={[
              { label: '', content: t('workflowCanvas.nodes.knowledgeRetrieval.maxRecallTooltip') },
            ]}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={maxRecallCount}
            onChange={e => {
              const val = parseInt(e.target.value)
              setMaxRecallCount(val)
              updateParam({ maxRecallCount: val })
            }}
            style={{ flex: 1 }}
          />
          <input
            type="number"
            min={1}
            max={20}
            value={maxRecallCount}
            onChange={e => {
              const val = parseInt(e.target.value)
              if (!isNaN(val) && val >= 1 && val <= 20) {
                setMaxRecallCount(val)
                updateParam({ maxRecallCount: val })
              }
            }}
            onBlur={e => {
              const val = parseInt(e.target.value)
              if (isNaN(val) || val < 1) {
                setMaxRecallCount(1)
                updateParam({ maxRecallCount: 1 })
              } else if (val > 20) {
                setMaxRecallCount(20)
                updateParam({ maxRecallCount: 20 })
              }
            }}
            style={{
              width: 60,
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid #d9d9d9',
              fontSize: 12,
              textAlign: 'center',
            }}
          />
        </div>
      </div>

      {/* Min Match Score */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: '#4e5969' }}>
            {t('workflowCanvas.nodes.knowledgeRetrieval.minMatchScore')}
          </span>
          <RetrievalTooltip
            title={t('workflowCanvas.nodes.knowledgeRetrieval.minMatchScore')}
            plain
            steps={[
              { label: '', content: t('workflowCanvas.nodes.knowledgeRetrieval.minScoreTooltip') },
            ]}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={minMatchScore}
            onChange={e => {
              const val = parseFloat(e.target.value)
              setMinMatchScore(val)
              minMatchScoreInputRef.current = ''
              updateParam({ minMatchScore: val })
            }}
            style={{ flex: 1 }}
          />
          <input
            type="text"
            value={minMatchScoreInputRef.current || String(minMatchScore)}
            onChange={e => {
              const inputValue = e.target.value
              if (inputValue === '') {
                setMinMatchScore(0.5)
                minMatchScoreInputRef.current = ''
                return
              }
              if (/^(\d+\.?|\d*\.\d{0,1})$/.test(inputValue)) {
                minMatchScoreInputRef.current = inputValue
                const val = parseFloat(inputValue)
                if (!isNaN(val) && !inputValue.endsWith('.') && !inputValue.startsWith('.')) {
                  setMinMatchScore(val)
                  minMatchScoreInputRef.current = ''
                  updateParam({ minMatchScore: val })
                }
              }
            }}
            onBlur={e => {
              const val = parseFloat(e.target.value)
              if (isNaN(val) || val < 0) {
                setMinMatchScore(0)
                minMatchScoreInputRef.current = ''
                updateParam({ minMatchScore: 0 })
              } else if (val > 1) {
                setMinMatchScore(1)
                minMatchScoreInputRef.current = ''
                updateParam({ minMatchScore: 1 })
              } else {
                const formatted = Math.round(val * 10) / 10
                setMinMatchScore(formatted)
                minMatchScoreInputRef.current = ''
                updateParam({ minMatchScore: formatted })
              }
            }}
            style={{
              width: 60,
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid #d9d9d9',
              fontSize: 12,
              textAlign: 'center',
            }}
          />
        </div>
        {minMatchScore === 1 && (
          <div style={{ fontSize: 11, color: '#f53f3f', marginTop: 4 }}>
            {t('workflowCanvas.nodes.knowledgeRetrieval.minScoreWarning')}
          </div>
        )}
      </div>

      {/* Graph Retrieval */}
      <div style={{ marginBottom: 12, opacity: hasGraphEnhancement ? 1 : 0.5 }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: hasGraphEnhancement ? 'pointer' : 'not-allowed',
            fontSize: 12,
            color: '#4e5969',
          }}
        >
          <input
            type="checkbox"
            checked={useGraph}
            disabled={!hasGraphEnhancement}
            onChange={e => {
              setUseGraph(e.target.checked)
              updateParam({ useGraph: e.target.checked })
            }}
            style={{ accentColor: '#3b82f6' }}
          />
          <span>{t('workflowCanvas.nodes.knowledgeRetrieval.useGraphRetrieval')}</span>
          <RetrievalTooltip
            title={t('workflowCanvas.nodes.knowledgeRetrieval.sampleReference')}
            steps={[
              { label: t('workflowCanvas.nodes.knowledgeRetrieval.tooltipQuestion'), content: t('workflowCanvas.nodes.knowledgeRetrieval.graphExampleQuestion') },
              { label: t('workflowCanvas.nodes.knowledgeRetrieval.tooltipGraphExpansion'), content: t('workflowCanvas.nodes.knowledgeRetrieval.graphExampleExpansion') },
              { label: t('workflowCanvas.nodes.knowledgeRetrieval.tooltipAnswer'), content: t('workflowCanvas.nodes.knowledgeRetrieval.graphExampleAnswer') },
            ]}
          />
        </label>
        <div style={{ fontSize: 11, color: '#86909c', marginTop: 4, marginLeft: 24 }}>
          {t('workflowCanvas.nodes.knowledgeRetrieval.graphRetrievalHelpText')}
        </div>
        {!hasGraphEnhancement && kbInfo.length > 0 && (
          <div style={{ fontSize: 11, color: '#f97316', marginTop: 4, marginLeft: 24 }}>
            {t('workflowCanvas.nodes.knowledgeRetrieval.noGraphEnhancement')}
          </div>
        )}
      </div>

      {/* Agentic Retrieval */}
      <div style={{ marginBottom: 12 }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            fontSize: 12,
            color: '#4e5969',
          }}
        >
          <input
            type="checkbox"
            checked={agentic}
            onChange={e => {
              setAgentic(e.target.checked)
              updateParam({ agentic: e.target.checked })
            }}
            style={{ accentColor: '#3b82f6' }}
          />
          <span>{t('workflowCanvas.nodes.knowledgeRetrieval.agenticRetrieval')}</span>
          <RetrievalTooltip
            title={t('workflowCanvas.nodes.knowledgeRetrieval.sampleReference')}
            steps={[
              { label: t('workflowCanvas.nodes.knowledgeRetrieval.tooltipQuestion'), content: t('workflowCanvas.nodes.knowledgeRetrieval.agenticExampleQuestion') },
              { label: t('workflowCanvas.nodes.knowledgeRetrieval.tooltipStep1'), content: t('workflowCanvas.nodes.knowledgeRetrieval.agenticExampleStep1') },
              { label: t('workflowCanvas.nodes.knowledgeRetrieval.tooltipStep2'), content: t('workflowCanvas.nodes.knowledgeRetrieval.agenticExampleStep2') },
              { label: t('workflowCanvas.nodes.knowledgeRetrieval.tooltipAnswer'), content: t('workflowCanvas.nodes.knowledgeRetrieval.agenticExampleAnswer') },
            ]}
          />
        </label>
        <div style={{ fontSize: 11, color: '#86909c', marginTop: 4, marginLeft: 24 }}>
          {t('workflowCanvas.nodes.knowledgeRetrieval.agenticRetrievalHelpText')}
        </div>
      </div>

      {/* LLM Model Selection - only when Agentic mode is enabled */}
      {agentic && (
        <div style={{ marginTop: 8, marginBottom: 12, padding: '8px 12px', background: '#f7f8fa', borderRadius: 8 }}>
          <FormModel
            name={t('workflowCanvas.nodes.knowledgeRetrieval.agenticModel')}
            fieldPrefix="inputs"
            required={true}
          />
        </div>
      )}
    </div>
  )
}

// --- Knowledge Section Wrapper ---

function KnowledgeSection() {
  const isSidebar = useIsSidebar()
  const { t } = useTranslation()
  const [settingsKey, setSettingsKey] = useState(0)

  const handleKBChange = useCallback(() => {
    setSettingsKey(k => k + 1)
  }, [])

  if (!isSidebar) {
    return <KnowledgeRetrievalKBList />
  }

  return (
    <FormItem name={t('workflowCanvas.nodes.knowledgeRetrieval.knowledge')}>
      <KnowledgeRetrievalKBList onKBChange={handleKBChange} />
      <KnowledgeRetrievalSettings key={settingsKey} />
    </FormItem>
  )
}

// --- Main Form Render ---

const renderForm = (_props: FormRenderProps<FlowNodeJSON>) => {
  return (
    <>
      <FormHeader />
      <FormContent>
        <FormInput showAddButton={false} deleteable={false} nameEditable={false} useFieldSchema={true} />
        <KnowledgeSection />
        <FormOutput name="workflowCanvas.formOutput.output" outputName="outputs" showAddButton={false} readonly={true} />
      </FormContent>
    </>
  )
}

const validateOnInit: EffectOptions[] = [
  {
    event: DataEvent.onValueInit,
    effect: (({ form }) => {
      // Trigger validation after initialization so form.state.invalid reflects
      // missing mandatory fields (e.g. no KB selected) immediately on load
      const timer = setTimeout(() => form.validate(), 0)
      return () => clearTimeout(timer)
    }) as Effect,
  },
]

export const formMeta: FormMeta = {
  render: renderForm,
  validateTrigger: ValidateTrigger.onChange,
  validate: validation,
  effect: {
    title: syncVariableTitle,
    outputs: provideJsonSchemaOutputs,
    inputsValues: [...autoRenameRefEffect, ...validateWhenVariableSync({ scope: 'public' })],
    'inputsValues.*': listenRefSchemaChange(params => {
      console.log(`[${params.context.node.id}][${params.name}] Schema Of Ref Updated`)
    }),
    'inputs.knowledgeRetrievalParam': validateOnInit,
  },
}
