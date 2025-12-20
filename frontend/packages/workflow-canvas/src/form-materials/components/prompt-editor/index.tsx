/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { lazySuspense } from '../../shared/lazy-suspense'

export const PromptEditor = lazySuspense(() => import('./editor').then(module => ({ default: module.PromptEditor })))

export type { PromptEditorPropsType } from './editor'

// Export useEditor hook for other components
export { useEditor, useEditorEvent } from './editor'
