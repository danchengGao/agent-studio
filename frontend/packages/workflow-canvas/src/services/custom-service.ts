/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FreeLayoutPluginContext, SelectionService, Playground, WorkflowDocument } from '@flowgram.ai/free-layout-editor'

/**
 * Docs: https://inversify.io/docs/introduction/getting-started/
 * Warning: Use decorator legacy
 *   // rsbuild.config.ts
 *   {
 *     source: {
 *       decorators: {
 *         version: 'legacy'
 *       }
 *     }
 *   }
 * Usage:
 *  1.
 *    const myService = useService(CustomService)
 *    myService.save()
 *  2.
 *    const myService = useClientContext().get(CustomService)
 *  3.
 *    const myService = node.getService(CustomService)
 */
export class CustomService {
  ctx!: FreeLayoutPluginContext
  selectionService!: SelectionService
  playground!: Playground
  document!: WorkflowDocument

  save() {
    console.log(this.document.toJSON())
  }
}
