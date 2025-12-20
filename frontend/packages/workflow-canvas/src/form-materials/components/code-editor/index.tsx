/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

// Language-specific editors
export { TypeScriptCodeEditor } from './editor-ts'
export { JsonCodeEditor } from './editor-json'
export { PythonCodeEditor } from './editor-python'

// Re-export BaseEditor from its new location
export { BaseEditor, type BaseEditorProps, type BaseEditorRef } from '../base-editor'
