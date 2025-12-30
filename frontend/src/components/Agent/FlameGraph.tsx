import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Slider, Tooltip } from '@mui/material'
import { InvokeExecuteInfo } from '@test-agentstudio/api-client'
import { useScopedTranslation } from '@/i18n'

interface FlameGraphProps {
  execList: InvokeExecuteInfo[]
  onSelect?: (node: InvokeExecuteInfo) => void
  rootLabel?: string
}

type ExecNode = InvokeExecuteInfo & { start_timestamp?: number; duration?: number; invoke_type?: string; invoke_id?: string }

interface BarItem {
  id: string
  label?: string
  type: string
  start: number
  end: number
  duration: number
  depth: number
  node: ExecNode
}

const getChildren = (node: ExecNode): ExecNode[] => {
  const a: any = node
  const c = a.childInvokesExecuteInfo || a.child_invokes_execute_info || []
  return Array.isArray(c) ? (c as ExecNode[]) : []
}

const formatMs = (ms?: number) => {
  if (ms == null) return '0 ms'
  const n = Number(ms) || 0
  if (n < 1000) {
    return `${n} ms`
  } else {
    return `${(n / 1000).toFixed(1)} s`
  }
}

const colorForType = (t: string) => {
  const key = (t || '').toLowerCase()
  if (key.includes('llm')) return '#7c3aed'
  if (key.includes('workflow')) return '#0ea5e9'
  if (key.includes('start')) return '#16a34a'
  if (key.includes('end')) return '#dc2626'
  if (key.includes('plugin')) return '#f59e0b'
  if (key.includes('agent')) return '#14b8a6'
  return '#6b7280'
}

const getNiceStep = (rough: number) => {
  if (!isFinite(rough) || rough <= 0) return 1
  const power = Math.floor(Math.log10(rough))
  const base = Math.pow(10, power)
  const norm = rough / base
  const grid = 0.25
  const niceNorm = Math.min(10, Math.ceil(norm / grid) * grid)
  return niceNorm * base
}

const pickTickStep = (total: number, targetTicks = 5) => {
  const rough = Math.max(1, total) / Math.max(1, targetTicks)
  return getNiceStep(rough)
}

const computeAxis = (total: number): { step: number; max: number; marks: { value: number; label: string }[] } => {
  const step = pickTickStep(total)
  let max = Math.ceil(Math.max(1, total) / step) * step
  const msMarks: { value: number; label: string }[] = []
  for (let v = step; v <= max; v += step) {
    msMarks.push({ value: v, label: `${v} ms` })
  }
  return { step, max, marks: msMarks }
}

const useContainerSize = () => {
  const ref = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const cr = e.contentRect
        setSize({ width: Math.max(0, cr.width), height: Math.max(0, cr.height) })
      }
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return { ref, size }
}

const buildBars = (roots: ExecNode[], rootLabel?: string, defaultNodeLabel?: string): BarItem[] => {
  const res: BarItem[] = []
  const walk = (node: ExecNode, depth: number) => {
    const start = Number(node.start_timestamp || 0)
    const dur = Number(node.duration || 0)
    const end = start + dur
    res.push({
      id: String(node.invoke_id || `${start}-${end}-${depth}-${Math.random()}`),
      label: depth === 0 && rootLabel ? rootLabel : node.invoke_name || node.invoke_type || defaultNodeLabel,
      type: node.invoke_type || 'node',
      start,
      end,
      duration: dur,
      depth,
      node,
    })
    const children = getChildren(node)
    let cursor = start
    for (const c of children) {
      const hasStart = c.start_timestamp != null
      const cStart = hasStart ? Number(c.start_timestamp || 0) : cursor
      const cDur = Number(c.duration || 0)
      const next: ExecNode = { ...c, start_timestamp: cStart, duration: cDur }
      cursor = cStart + cDur
      walk(next as ExecNode, depth + 1)
    }
  }
  for (const r of roots) walk(r as ExecNode, 0)
  return res
}

const FlameGraph: React.FC<FlameGraphProps> = ({ execList, onSelect, rootLabel }) => {
  const { t } = useScopedTranslation('agents.agentEditor.previewDebug.agentDebugPanel.flameGraph')
  const defaultNodeLabel = t('labels.nodeFallback')
  const bars = useMemo(() => buildBars(execList as ExecNode[], rootLabel, defaultNodeLabel), [execList, rootLabel, defaultNodeLabel])
  const totalStart = useMemo(() => (bars.length ? Math.min(...bars.map(b => b.start)) : 0), [bars])
  const totalEnd = useMemo(() => (bars.length ? Math.max(...bars.map(b => b.end)) : 0), [bars])
  const totalDuration = Math.max(0, totalEnd - totalStart)
  const [windowRange, setWindowRange] = useState<[number, number]>([totalStart, totalEnd])

  const { ref, size } = useContainerSize()
  const contentWidth = Math.max(300, size.width - 16)
  const rowHeight = 28
  const sliderHeight = 44
  const maxDepth = useMemo(() => (bars.length ? Math.max(...bars.map(b => b.depth)) : 0), [bars])
  const laneCount = useMemo(() => maxDepth + 1, [maxDepth])

  const scaleX = (t: number) => {
    const [w0, w1] = windowRange
    const d = Math.max(1, w1 - w0)
    return ((t - w0) / d) * contentWidth
  }

  const axis = useMemo(() => computeAxis(totalDuration), [totalDuration])
  const marks = useMemo(() => {
    const arr: { value: number; label: string }[] = [{ value: totalStart, label: '0 ms' }]
    for (const m of axis.marks) arr.push({ value: totalStart + m.value, label: m.label })
    return arr
  }, [axis, totalStart])

  useEffect(() => {
    setWindowRange([totalStart, totalStart + axis.max])
  }, [totalStart, axis.max])

  const visibleBars = useMemo(() => bars.filter(b => b.end >= windowRange[0] && b.start <= windowRange[1]), [bars, windowRange])

  const height = laneCount * rowHeight + 36 + sliderHeight

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-700">
          {t('labels.totalDuration')}：{formatMs(totalDuration)}
        </span>
      </div>
      <div ref={ref} className="relative w-full">
        <div style={{ width: contentWidth, height }} className="">
          <div className="w-full px-2 py-2">
            <Slider
              value={windowRange}
              onChange={(_, v) => {
                const arr = Array.isArray(v) ? (v as number[]) : [Number(v), Number(v)]
                const axisMax = totalStart + axis.max
                const a = Math.max(totalStart, Math.min(arr[0], axisMax))
                const b = Math.max(totalStart, Math.min(arr[1] ?? arr[0], axisMax))
                const lo = Math.min(a, b)
                const hi = Math.max(a, b)
                setWindowRange([lo, hi])
              }}
              min={totalStart}
              max={totalStart + axis.max}
              marks={marks}
              size="small"
              valueLabelDisplay="auto"
              valueLabelFormat={v => `${Math.max(0, v - totalStart)} ms`}
              sx={{
                height: 22,
                '& .MuiSlider-track': { height: 3 },
                '& .MuiSlider-rail': { height: 3 },
                '& .MuiSlider-thumb': { width: 10, height: 10, boxShadow: 'none' },
                '& .MuiSlider-mark': { height: 6, width: 2 },
                '& .MuiSlider-markLabel': { fontSize: '10px', color: '#6b7280', marginTop: '2px' },
                '& .MuiSlider-valueLabel': { fontSize: '10px' },
              }}
            />
          </div>

          <div className="absolute left-0 w-full" style={{ top: sliderHeight + 36, height: laneCount * rowHeight }}>
            {visibleBars.map(b => {
              const x = Math.max(0, Math.min(contentWidth, scaleX(b.start)))
              const x2 = Math.max(0, Math.min(contentWidth, scaleX(b.end)))
              const minBarPx = 6
              let w = Math.max(minBarPx, x2 - x)
              let left = x
              if (left + w > contentWidth) {
                left = Math.max(0, contentWidth - w)
              }
              const y = b.depth * rowHeight
              const bg = colorForType(b.type)
              return (
                <Tooltip key={b.id} title={`${b.label} • ${formatMs(b.duration)}`} placement="top">
                  <div
                    className="absolute rounded-sm shadow-sm cursor-pointer"
                    style={{ left, top: y + 4, width: w, height: rowHeight - 8, backgroundColor: bg }}
                    onClick={() => onSelect && onSelect(b.node)}
                  >
                    {w > 60 && (
                      <div className="px-2 w-full h-full flex items-center text-[11px] text-white whitespace-nowrap overflow-hidden">
                        <span className="truncate">
                          {b.label} ({formatMs(b.duration)})
                        </span>
                      </div>
                    )}
                  </div>
                </Tooltip>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FlameGraph
