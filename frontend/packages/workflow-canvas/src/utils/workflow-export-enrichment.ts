/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { modelService, PluginService } from '@test-agentstudio/api-client'
import type { FrontendModelConfig, PluginApiInfo, PluginInfo } from '@test-agentstudio/api-client'
import { WorkflowNodeType } from '../nodes/constants'

function getUrlSpaceId(): string {
  if (typeof window === 'undefined') return ''
  try {
    return new URLSearchParams(window.location.search).get('spaceId') || ''
  } catch {
    return ''
  }
}

function getPersistedDefaultSpaceId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const raw = window.localStorage.getItem('auth-storage')
    if (!raw) return ''
    const parsed = JSON.parse(raw) as { state?: { user?: { spaceId?: string } } }
    return parsed?.state?.user?.spaceId?.trim() || ''
  } catch {
    return ''
  }
}

function buildCandidateSpaceIds(primarySpaceId: string): string[] {
  return [
    ...new Set(
      [primarySpaceId, getUrlSpaceId(), getPersistedDefaultSpaceId(), '1']
        .map(s => (typeof s === 'string' ? s.trim() : ''))
        .filter((s): s is string => Boolean(s)),
    ),
  ]
}

function scoreModelMatch(model: FrontendModelConfig, modelConfigId: string, snapshot?: WorkflowNodeModelSnapshot): number {
  let score = 0

  if (String(model.id) === String(modelConfigId)) score += 1000
  if (snapshot?.model_type && model.modelId === snapshot.model_type) score += 100
  if (snapshot?.name && model.name === snapshot.name) score += 20
  if (snapshot?.name && model.name.toLowerCase() === snapshot.name.toLowerCase()) score += 10
  if (snapshot?.model_type && model.name === snapshot.model_type) score += 5

  return score
}

async function loadModelsByPages(spaceId: string): Promise<FrontendModelConfig[]> {
  const pageSize = 100
  const collected: FrontendModelConfig[] = []

  for (let page = 1; page <= 10; page++) {
    const { items, total, size } = await modelService.getModelConfigs({
      spaceId,
      page,
      size: pageSize,
      sort_by: 'update_time',
      sort_order: 'desc',
    })

    collected.push(...items)

    if (items.length < size || collected.length >= total) {
      break
    }
  }

  return collected
}

/**
 * 更稳健地按空间解析模型配置：
 * 1. 先尝试多空间的单条 getModelConfig(id, spaceId)
 * 2. 若失败，再分页扫描模型列表
 * 3. 列表中优先按 id 命中，其次按节点快照的 model_type / name 匹配
 */
async function resolveModelConfigForExport(
  modelConfigId: string,
  primarySpaceId: string,
  snapshot?: WorkflowNodeModelSnapshot,
): Promise<FrontendModelConfig | null> {
  const candidates = buildCandidateSpaceIds(primarySpaceId)

  for (const sid of candidates) {
    try {
      const exact = await modelService.getModelConfig(modelConfigId, sid)
      if (exact) {
        return exact
      }
    } catch {
      // continue
    }
  }

  const scanned = new Map<string, FrontendModelConfig>()
  for (const sid of candidates) {
    try {
      const items = await loadModelsByPages(sid)
      for (const item of items) {
        scanned.set(`${sid}:${item.id}`, item)
      }
    } catch {
      // continue
    }
  }

  let best: FrontendModelConfig | null = null
  let bestScore = 0
  for (const item of scanned.values()) {
    const score = scoreModelMatch(item, modelConfigId, snapshot)
    if (score > bestScore) {
      best = item
      bestScore = score
    }
  }

  return bestScore > 0 ? best : null
}

/** 画布中引用的插件及工具（用于对齐智能体导出 dependencies.plugins[].tool_list） */
export interface WorkflowPluginUsageSpec {
  plugin_id: string
  /** 节点上 pluginParam.pluginVersion，可能有多个取值时全部保留 */
  versions: string[]
  /** 节点上 pluginParam.toolID，用于只导出实际用到的工具 */
  tool_ids: string[]
}

/**
 * 与节点 `inputs.llmParam.model.id` 关联：以 model_id 为 model_references 的 key，
 * 内含模型配置 ID 与参数，便于导入或其它环境还原。
 */
export interface WorkflowExportModelReference {
  /** 模型配置 ID，与画布节点中 model.id 一致 */
  model_id: string
  provider: string
  model_type: string
  name: string
  base_url: string | null
  api_key: null
  timeout: number
  parameters: {
    temperature: number
    max_tokens: number
    top_p: number
  }
  retry_count: number
  enable_streaming: boolean
  enable_function_calling: boolean
  description: string
  tags: string[]
  is_active: boolean
  is_system_model: boolean
  /**
   * 为 true 时表示条目已由模型管理 API 补全；为 false 时表示仅来自节点上的 model 字段（接口失败或未登录时仍可与 model.id 关联）
   */
  resolved_from_api?: boolean
}

const LLM_NODE_TYPES = new Set<string>([
  WorkflowNodeType.LLM,
  WorkflowNodeType.Intent,
  WorkflowNodeType.Questioner,
])

function walkBlocks(blocks: unknown[] | undefined, visit: (node: Record<string, unknown>) => void): void {
  if (!Array.isArray(blocks)) return
  for (const raw of blocks) {
    if (!raw || typeof raw !== 'object') continue
    const node = raw as Record<string, unknown>
    visit(node)
    const nested = node.blocks as unknown[] | undefined
    if (nested?.length) {
      walkBlocks(nested, visit)
    }
  }
}

function getDocumentRootNodeArrays(documentJson: unknown): unknown[] {
  if (!documentJson || typeof documentJson !== 'object') {
    return []
  }
  const doc = documentJson as Record<string, unknown>
  if (Array.isArray((doc.root as Record<string, unknown> | undefined)?.blocks)) {
    return (doc.root as Record<string, unknown>).blocks as unknown[]
  }
  if (Array.isArray(doc.nodes)) {
    return doc.nodes as unknown[]
  }
  return []
}

/** 节点上 llmParam.model 的快照，用于在拉取 API 失败时仍写出 model_references */
export interface WorkflowNodeModelSnapshot {
  name: string
  model_type: string
}

function createPluginUsageMap(): Map<string, { versions: string[]; toolIds: Set<string> }> {
  return new Map()
}

function notePluginUsage(map: Map<string, { versions: string[]; toolIds: Set<string> }>, pluginId: unknown, version?: unknown, toolId?: unknown) {
  if (pluginId === undefined || pluginId === null) return
  const pid = String(pluginId).trim()
  if (!pid) return
  let entry = map.get(pid)
  if (!entry) {
    entry = { versions: [], toolIds: new Set() }
    map.set(pid, entry)
  }
  if (version !== undefined && version !== null && String(version).trim() !== '') {
    const v = String(version).trim()
    if (!entry.versions.includes(v)) {
      entry.versions.push(v)
    }
  }
  if (toolId !== undefined && toolId !== null && String(toolId).trim() !== '') {
    entry.toolIds.add(String(toolId).trim())
  }
}

/**
 * 从画布 document.toJSON() 结果中收集模型配置 ID 与插件 ID（递归子画布 blocks）
 */
export function collectWorkflowExportIds(documentJson: unknown): { modelConfigIds: string[]; pluginIds: string[] } {
  const { modelSnapshots, pluginUsageSpecs } = collectWorkflowExportModelsAndPlugins(documentJson)
  return {
    modelConfigIds: Object.keys(modelSnapshots),
    pluginIds: pluginUsageSpecs.map(s => s.plugin_id),
  }
}

/**
 * 一次遍历：模型 id -> 节点上可见的 name/type；插件引用（含版本、工具 ID）
 */
export function collectWorkflowExportModelsAndPlugins(documentJson: unknown): {
  modelSnapshots: Record<string, WorkflowNodeModelSnapshot>
  pluginIds: string[]
  pluginUsageSpecs: WorkflowPluginUsageSpec[]
} {
  const modelSnapshots: Record<string, WorkflowNodeModelSnapshot> = {}
  const pluginUsage = createPluginUsageMap()
  const roots = getDocumentRootNodeArrays(documentJson)

  walkBlocks(roots, node => {
    const type = String(node.type ?? '')
    const data = (node.data as Record<string, unknown> | undefined) || {}
    const inputs = (data.inputs as Record<string, unknown> | undefined) || {}

    if (LLM_NODE_TYPES.has(type)) {
      const llmParam = inputs.llmParam as Record<string, unknown> | undefined
      const model = llmParam?.model as Record<string, unknown> | undefined
      const id = model?.id
      if (id !== undefined && id !== null && String(id).trim() !== '') {
        const key = String(id)
        if (!modelSnapshots[key]) {
          modelSnapshots[key] = {
            name: String(model?.name ?? ''),
            model_type: String(model?.type ?? ''),
          }
        }
      }
    }

    const pluginParam = inputs.pluginParam as Record<string, unknown> | undefined
    const pId = pluginParam?.pluginID ?? pluginParam?.plugin_id
    if (pId !== undefined && pId !== null && String(pId).trim() !== '') {
      notePluginUsage(pluginUsage, pId, pluginParam?.pluginVersion, pluginParam?.toolID)
    }

    if (type === WorkflowNodeType.Plugin) {
      const plugin = data.plugin as Record<string, unknown> | undefined
      const fromPlugin = plugin?.plugin_id
      if (fromPlugin !== undefined && fromPlugin !== null && String(fromPlugin).trim() !== '') {
        const selected = plugin?.selectedTool as Record<string, unknown> | undefined
        const apiInfo = plugin?.api_info as unknown[] | undefined
        const firstTool = Array.isArray(apiInfo) && apiInfo[0] ? (apiInfo[0] as Record<string, unknown>) : undefined
        const toolId = selected?.tool_id ?? firstTool?.tool_id
        notePluginUsage(pluginUsage, fromPlugin, plugin?.plugin_version, toolId)
      }
    }
  })

  const pluginUsageSpecs: WorkflowPluginUsageSpec[] = [...pluginUsage.entries()].map(([plugin_id, u]) => ({
    plugin_id,
    versions: u.versions,
    tool_ids: [...u.toolIds],
  }))

  return {
    modelSnapshots,
    pluginIds: pluginUsageSpecs.map(s => s.plugin_id),
    pluginUsageSpecs,
  }
}

/**
 * 将工具详情整理为与智能体导出 dependencies.plugins[].tool_list[] 相近的结构
 * （含 request_params / input_parameters、response_params / output_parameters）
 */
export function normalizeToolForAgentStyleExport(tool: Record<string, unknown>): Record<string, unknown> {
  const req = (tool.request_params ?? tool.input_parameters) as unknown
  const resp = (tool.response_params ?? tool.output_parameters) as unknown
  return {
    ...tool,
    request_params: req ?? [],
    input_parameters: tool.input_parameters ?? req ?? [],
    response_params: resp ?? [],
    output_parameters: tool.output_parameters ?? resp ?? [],
  }
}

/**
 * 拉取插件基本信息 + API 工具列表，组装为智能体导出中 dependencies.plugins 单项形态
 */
export async function fetchPluginExportLikeAgentDeps(
  spaceId: string,
  spec: WorkflowPluginUsageSpec,
): Promise<Record<string, unknown> | null> {
  const preferVersion = spec.versions.find(v => v && v.toLowerCase() !== 'draft') ?? spec.versions[0]
  const plugin_version = preferVersion && preferVersion.trim() !== '' ? preferVersion.trim() : undefined

  try {
    const [getRes, listRes] = await Promise.all([
      PluginService.getPlugin({ space_id: spaceId, plugin_id: spec.plugin_id, plugin_version }),
      PluginService.getPluginApiList({
        space_id: spaceId,
        plugin_id: spec.plugin_id,
        plugin_version,
        page: 1,
        size: 500,
      }),
    ])

    if (getRes?.code !== 200 || !getRes.data?.plugin_info) {
      return null
    }

    const pi = getRes.data.plugin_info as PluginInfo & { request_params?: unknown[] }
    let apiInfos: PluginApiInfo[] = listRes?.code === 200 && listRes.data?.api_info ? listRes.data.api_info : []

    if (spec.tool_ids.length > 0) {
      const idSet = new Set(spec.tool_ids)
      const filtered = apiInfos.filter(t => idSet.has(String(t.tool_id)))
      if (filtered.length > 0) {
        apiInfos = filtered
      }
    }

    const tool_list = apiInfos.map(t =>
      normalizeToolForAgentStyleExport(JSON.parse(JSON.stringify(t)) as Record<string, unknown>),
    )

    return {
      plugin_id: pi.plugin_id,
      plugin_version: pi.plugin_version ?? plugin_version ?? 'draft',
      name: pi.name,
      desc: pi.desc,
      desc_mk: pi.desc_mk ?? '',
      url: pi.url ?? '',
      space_id: pi.space_id,
      icon_uri: pi.icon_uri ?? '',
      plugin_type: pi.plugin_type,
      tools: null,
      inputs: pi.request_params ?? [],
      tool_list,
    }
  } catch (e) {
    console.warn(`[workflow-export] fetchPluginExportLikeAgentDeps failed plugin_id=${spec.plugin_id}`, e)
    return null
  }
}

function minimalReferenceFromNode(modelId: string, snap: WorkflowNodeModelSnapshot): WorkflowExportModelReference {
  return {
    model_id: modelId,
    provider: '',
    model_type: snap.model_type,
    name: snap.name,
    base_url: null,
    api_key: null,
    timeout: 60,
    parameters: {
      temperature: 0.7,
      max_tokens: 4000,
      top_p: 0.9,
    },
    retry_count: 3,
    enable_streaming: true,
    enable_function_calling: false,
    description: '',
    tags: [],
    is_active: true,
    is_system_model: false,
    resolved_from_api: false,
  }
}

function frontendModelToReference(mc: FrontendModelConfig): WorkflowExportModelReference {
  const id = String(mc.id)
  return {
    model_id: id,
    provider: mc.provider,
    model_type: mc.modelId,
    name: mc.name,
    base_url: mc.baseUrl || null,
    api_key: null,
    timeout: mc.timeout ?? 60,
    parameters: {
      temperature: mc.temperature ?? 0.7,
      max_tokens: mc.maxTokens ?? 4000,
      top_p: mc.topp ?? 0.9,
    },
    retry_count: mc.retryCount ?? 3,
    enable_streaming: mc.enableStreaming ?? true,
    enable_function_calling: mc.enableFunctionCalling ?? false,
    description: mc.description ?? '',
    tags: mc.tags ?? [],
    is_active: mc.isActive ?? true,
    is_system_model: mc.isSystemModel ?? false,
    resolved_from_api: true,
  }
}

export interface WorkflowExportEnrichment {
  plugins: Record<string, unknown>[]
  /** key 与节点 model.id 一致，便于按 model_id 关联 */
  model_references: Record<string, WorkflowExportModelReference>
}

/**
 * 根据画布 JSON 与 spaceId 拉取插件、模型详情，生成 plugins 与按 model_id 索引的 model_references
 */
export async function buildWorkflowExportEnrichment(documentJson: unknown, spaceId: string): Promise<WorkflowExportEnrichment> {
  const { modelSnapshots, pluginUsageSpecs } = collectWorkflowExportModelsAndPlugins(documentJson)
  const modelConfigIds = Object.keys(modelSnapshots)

  /** 先写入节点上的 model 信息，保证与 inputs.llmParam.model.id 一定能关联；API 成功再覆盖为完整配置 */
  const modelReferences: Record<string, WorkflowExportModelReference> = {}
  for (const id of modelConfigIds) {
    modelReferences[id] = minimalReferenceFromNode(id, modelSnapshots[id]!)
  }

  const [pluginResults] = await Promise.all([
    Promise.all(pluginUsageSpecs.map(spec => fetchPluginExportLikeAgentDeps(spaceId, spec))),
    Promise.all(
      modelConfigIds.map(async id => {
        const mc = await resolveModelConfigForExport(id, spaceId, modelSnapshots[id])
        if (mc) {
          modelReferences[String(mc.id)] = frontendModelToReference(mc)
        } else {
          console.warn(
            `[workflow-export] 无法拉取模型配置 model_id=${id}，已保留节点快照。已尝试 space_id: ${buildCandidateSpaceIds(spaceId).join(', ')}；请确认 URL 带 ?spaceId=、浏览器已登录，或 auth-storage 中存在正确 spaceId。`,
          )
        }
      }),
    ),
  ])

  const plugins: Record<string, unknown>[] = []
  for (let i = 0; i < pluginResults.length; i++) {
    const row = pluginResults[i]
    if (row) {
      plugins.push(row)
      continue
    }
    const spec = pluginUsageSpecs[i]
    try {
      const res = await PluginService.getPlugin({ space_id: spaceId, plugin_id: spec.plugin_id })
      if (res?.code === 200 && res.data?.plugin_info) {
        const pi = res.data.plugin_info as PluginInfo & { request_params?: unknown[] }
        plugins.push({
          ...pi,
          tools: null,
          inputs: pi.request_params ?? [],
          tool_list: [],
        })
      }
    } catch (e) {
      console.warn(`[workflow-export] skip plugin id=${spec.plugin_id}:`, e)
    }
  }

  return {
    plugins,
    model_references: modelReferences,
  }
}

/**
 * 导出文件：在画布 JSON 根级合并 `plugins`、`model_references`（无 export_format_version / schema / metadata）
 */
export function mergeWorkflowExportDocument(documentJson: unknown, enrichment: WorkflowExportEnrichment): Record<string, unknown> {
  const base =
    documentJson !== undefined && documentJson !== null && typeof documentJson === 'object'
      ? (JSON.parse(JSON.stringify(documentJson)) as Record<string, unknown>)
      : {}

  return {
    ...base,
    plugins: enrichment.plugins,
    model_references: enrichment.model_references,
  }
}

/**
 * 导入时去掉导出附加字段；兼容历史带 schema / export_format_version 的文件
 */
export function unwrapWorkflowImportPayload(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== 'object') {
    return parsed
  }
  const o = parsed as Record<string, unknown>
  if (o.export_format_version === '2.0' && o.schema !== undefined) {
    return o.schema
  }
  if (typeof o.schema === 'object' && o.schema !== null && ('root' in o.schema || 'nodes' in o.schema)) {
    return o.schema
  }
  if (typeof o.workflow_document === 'object' && o.workflow_document !== null) {
    return o.workflow_document
  }
  if (typeof o.document === 'object' && o.document !== null) {
    return o.document
  }

  const hasExportExtras = 'plugins' in o || 'model_references' in o
  if (hasExportExtras) {
    const deep = JSON.parse(JSON.stringify(parsed)) as Record<string, unknown>
    delete deep.plugins
    delete deep.model_references
    delete deep.export_format_version
    delete deep.schema
    delete deep.metadata
    return deep
  }

  return parsed
}
