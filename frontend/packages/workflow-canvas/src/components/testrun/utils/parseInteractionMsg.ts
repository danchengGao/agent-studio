/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import type { TestRunFormMetaItem } from '../testrun-form/type'
import type { InteractionMessage } from '../runtime/types'

export function parseInteractionMsgToFormMeta(msg: InteractionMessage | undefined): TestRunFormMetaItem[] {
  const normalizeType = (t?: string): TestRunFormMetaItem['type'] => {
    const s = String(t || '').toLowerCase()
    if (s.includes('boolean')) return 'boolean'
    if (s.includes('integer')) return 'integer'
    if (s.includes('number')) return 'number'
    if (s.includes('array')) return 'array'
    if (s.includes('object')) return 'object'
    return 'string'
  }

  const items: TestRunFormMetaItem[] = []

  if (!msg) return items

  if (Array.isArray(msg)) {
    for (const f of msg) {
      const name = String(f?.input_name || f?.name || f?.label || '').trim()
      if (!name) continue
      items.push({
        name,
        description: String(f?.description || '').trim() || undefined,
        type: normalizeType(f?.type),
        defaultValue: f?.default ?? '',
        required: Boolean(f?.required),
        itemsType: undefined,
      })
    }
    return items
  }

  if (typeof msg === 'string') {
    const name = msg.trim() || 'input'
    items.push({ name, type: 'string', defaultValue: '', required: false })
    return items
  }

  if (msg && typeof msg === 'object') {
    const objMsg = msg as any
    if (objMsg.properties && typeof objMsg.properties === 'object') {
      const requiredArr: string[] = Array.isArray(objMsg.required) ? objMsg.required : []
      for (const [name, prop] of Object.entries<any>(objMsg.properties)) {
        const type = normalizeType(prop?.type)
        const itemsType = prop?.items?.type ? normalizeType(prop.items.type) : undefined
        items.push({
          name,
          type,
          itemsType,
          defaultValue: prop?.default ?? '',
          required: requiredArr.includes(name),
        })
      }
      return items
    }

    for (const [name, val] of Object.entries<any>(msg)) {
      const type = typeof val === 'string' ? normalizeType(val) : normalizeType(val?.type)
      items.push({ name, type, defaultValue: '', required: false })
    }
    return items
  }

  return items
}
