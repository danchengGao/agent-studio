/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

export const colors = {
  background: '#f4f5f5',
  foreground: '#444d56',
  selection: '#0366d625',
  cursor: '#044289',
  dropdownBackground: '#fff',
  dropdownBorder: '#e1e4e8',
  activeLine: '#c6c6c622',
  matchingBracket: '#34d05840',
  keyword: '#d73a49',
  storage: '#d73a49',
  variable: '#e36209',
  parameter: '#24292e',
  function: '#005cc5',
  string: '#032f62',
  constant: '#005cc5',
  type: '#005cc5',
  class: '#6f42c1',
  number: '#005cc5',
  comment: '#6a737d',
  heading: '#005cc5',
  invalid: '#cb2431',
  regexp: '#032f62',
}

/**
 * Light theme extension for CodeMirror 6
 */
export const lightTheme: Extension = [
  EditorView.theme({
    '&': {
      backgroundColor: colors.background,
      color: colors.foreground,
    },
    '.cm-content': {
      caretColor: colors.cursor,
    },
    '.cm-cursor': {
      borderLeftColor: colors.cursor,
    },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: colors.selection,
    },
    '.cm-activeLine': {
      backgroundColor: colors.activeLine,
    },
    '.cm-gutters': {
      backgroundColor: colors.background,
      color: colors.foreground,
      border: 'none',
    },
    '.cm-lineNumbers': {
      color: colors.foreground,
    },
    '.cm-line': {
      borderRight: `1px solid ${colors.dropdownBorder}`,
      padding: '0 0 0 4px',
    },
    '.cm-matchingBracket': {
      backgroundColor: colors.matchingBracket,
    },
    // Syntax highlighting - Token styles
    '.cm-keyword': {
      color: colors.keyword,
      fontWeight: '500',
    },
    '.cm-storage': {
      color: colors.storage,
      fontWeight: '500',
    },
    '.cm-variableName': {
      color: colors.variable,
    },
    '.cm-variable': {
      color: colors.variable,
    },
    '.cm-variable-2': {
      color: colors.variable,
    },
    '.cm-parameter': {
      color: colors.parameter,
    },
    '.cm-property': {
      color: colors.function,
    },
    '.cm-propertyName': {
      color: colors.function,
    },
    '.cm-string': {
      color: colors.string,
    },
    '.cm-string-2': {
      color: colors.string,
    },
    '.cm-number': {
      color: colors.number,
    },
    '.cm-atom': {
      color: colors.constant,
    },
    '.cm-boolean': {
      color: colors.constant,
    },
    '.cm-def': {
      color: colors.function,
    },
    '.cm-variable-3': {
      color: colors.function,
    },
    '.cm-type': {
      color: colors.type,
    },
    '.cm-typeName': {
      color: colors.type,
    },
    '.cm-className': {
      color: colors.class,
    },
    '.cm-tag': {
      color: colors.keyword,
    },
    '.cm-attribute': {
      color: colors.variable,
    },
    '.cm-operator': {
      color: colors.keyword,
    },
    '.cm-operatorKeyword': {
      color: colors.keyword,
    },
    '.cm-special': {
      color: colors.regexp,
    },
    '.cm-regex': {
      color: colors.regexp,
    },
    '.cm-comment': {
      color: colors.comment,
      fontStyle: 'italic',
    },
    '.cm-header': {
      color: colors.heading,
      fontWeight: 'bold',
    },
    '.cm-strong': {
      fontWeight: 'bold',
    },
    '.cm-em': {
      fontStyle: 'italic',
    },
    '.cm-link': {
      color: colors.regexp,
      textDecoration: 'underline',
    },
    '.cm-invalidchar': {
      color: colors.invalid,
      borderBottom: `1px dotted ${colors.invalid}`,
    },
    '.cm-error': {
      color: colors.invalid,
      borderBottom: `1px dotted ${colors.invalid}`,
    },
    // Editor UI elements
    '.cm-focused': {
      outline: 'none',
    },
    '.cm-scroller': {
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
      fontSize: '14px',
      lineHeight: '1.5',
    },
    '.cm-placeholder': {
      color: colors.comment,
      fontStyle: 'italic',
      pointerEvents: 'none',
    },
    // Scrollbar styling
    '.cm-scroller::-webkit-scrollbar': {
      width: '8px',
      height: '8px',
    },
    '.cm-scroller::-webkit-scrollbar-track': {
      backgroundColor: colors.background,
    },
    '.cm-scroller::-webkit-scrollbar-thumb': {
      backgroundColor: '#d1d5da',
      borderRadius: '4px',
    },
    '.cm-scroller::-webkit-scrollbar-thumb:hover': {
      backgroundColor: '#9ca3af',
    },
    // Tooltip and completion styling
    '.cm-tooltip': {
      backgroundColor: colors.dropdownBackground,
      border: `1px solid ${colors.dropdownBorder}`,
      color: colors.foreground,
      boxShadow: '0 0 1px rgba(0, 0, 0, .3), 0 4px 14px rgba(0, 0, 0, .1)',
      maxWidth: '400px',
    },
    '.cm-tooltip-autocomplete': {
      backgroundColor: colors.dropdownBackground,
      border: `1px solid ${colors.dropdownBorder}`,
      boxShadow: '0 0 1px rgba(0, 0, 0, .3), 0 4px 14px rgba(0, 0, 0, .1)',
    },
    '.cm-tooltip-autocomplete ul': {
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
    },
    '.cm-completionIcon': {
      color: '#4B5563',
    },
    '.cm-completionLabel': {
      color: colors.foreground,
    },
    '.cm-completionDetail': {
      color: '#4B5563',
    },
    '.cm-completionSelected': {
      backgroundColor: colors.selection,
      color: colors.foreground,
    },
    '.cm-completionMatchedText': {
      color: colors.keyword,
      fontWeight: 'bold',
    },
    // Panel styling (search, etc.)
    '.cm-panel': {
      backgroundColor: colors.dropdownBackground,
      border: `1px solid ${colors.dropdownBorder}`,
      color: colors.foreground,
      boxShadow: '0 0 1px rgba(0, 0, 0, .3), 0 4px 14px rgba(0, 0, 0, .1)',
    },
    '.cm-panel.cm-search': {
      backgroundColor: colors.dropdownBackground,
      border: `1px solid ${colors.dropdownBorder}`,
      padding: '4px',
      boxShadow: '0 0 1px rgba(0, 0, 0, .3), 0 4px 14px rgba(0, 0, 0, .1)',
    },
    '.cm-search input': {
      backgroundColor: colors.background,
      border: `1px solid ${colors.dropdownBorder}`,
      color: colors.foreground,
      outline: 'none',
      padding: '2px 6px',
      borderRadius: '3px',
    },
    '.cm-search input:focus': {
      borderColor: colors.keyword,
    },
    '.cm-search button': {
      backgroundColor: colors.background,
      border: `1px solid ${colors.dropdownBorder}`,
      color: colors.foreground,
      padding: '2px 6px',
      borderRadius: '3px',
      cursor: 'pointer',
    },
    '.cm-search button:hover': {
      backgroundColor: '#F3F4F6',
    },
  }),
  // Additional highlighting rules for better syntax coverage
  EditorView.theme({
    '.cm-meta': {
      color: colors.comment,
    },
    '.cm-punctuation': {
      color: colors.foreground,
    },
    '.cm-bracket': {
      color: colors.foreground,
    },
    '.cm-squareBracket': {
      color: colors.foreground,
    },
    '.cm-paren': {
      color: colors.foreground,
    },
    '.cm-curlyBracket': {
      color: colors.foreground,
    },
    '.cm-angleBracket': {
      color: colors.foreground,
    },
  }),
]
