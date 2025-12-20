/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Extension } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { markdown } from '@codemirror/lang-markdown'

function LanguageSupport() {
  // Return language support extension for prompt editing
  // Combining JavaScript (for TypeScript-like syntax) and Markdown support
  const languageSupportExtension: Extension[] = [
    javascript({ typescript: true }),
    markdown()
  ]

  return languageSupportExtension
}

export default LanguageSupport
