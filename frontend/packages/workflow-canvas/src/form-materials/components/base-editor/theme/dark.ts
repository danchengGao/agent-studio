/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

export const colors = {
  background: '#24292e',
  foreground: '#d1d5da',
  selection: '#3392FF44',
  cursor: '#c8e1ff',
  dropdownBackground: '#24292e',
  dropdownBorder: '#1b1f23',
  activeLine: '#4d566022',
  matchingBracket: '#888892',
  keyword: '#9197F1',
  storage: '#f97583',
  variable: '#ffab70',
  variableName: '#D9DCFA',
  parameter: '#e1e4e8',
  function: '#FFCA66',
  string: '#FF9878',
  constant: '#79b8ff',
  type: '#79b8ff',
  class: '#b392f0',
  number: '#2EC7D9',
  comment: '#568B2A',
  heading: '#79b8ff',
  invalid: '#f97583',
  regexp: '#9ecbff',
  propertyName: '#9197F1',
  separator: '#888892',
  gutters: '#888892',
  moduleKeyword: '#CC4FD4',
}

/**
 * Dark theme extension for CodeMirror 6
 */
export const darkTheme: Extension = [
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
      color: colors.gutters,
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
      color: colors.variableName,
    },
    '.cm-variable': {
      color: colors.variable,
    },
    '.cm-variable-2': {
      color: colors.variableName,
    },
    '.cm-parameter': {
      color: colors.parameter,
    },
    '.cm-property': {
      color: colors.propertyName,
    },
    '.cm-propertyName': {
      color: colors.propertyName,
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
    '.cm-qualifier': {
      color: colors.moduleKeyword,
    },
    '.cm-operator': {
      color: colors.keyword,
    },
    '.cm-operatorKeyword': {
      color: colors.keyword,
    },
    '.cm-moduleKeyword': {
      color: colors.moduleKeyword,
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
      backgroundColor: '#586069',
      borderRadius: '4px',
    },
    '.cm-scroller::-webkit-scrollbar-thumb:hover': {
      backgroundColor: '#6e7681',
    },
    // Tooltip and completion styling
    '.cm-tooltip': {
      backgroundColor: colors.dropdownBackground,
      border: `1px solid ${colors.dropdownBorder}`,
      color: colors.foreground,
    },
    '.cm-tooltip-autocomplete': {
      backgroundColor: colors.dropdownBackground,
      border: `1px solid ${colors.dropdownBorder}`,
    },
    '.cm-tooltip-autocomplete ul': {
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
    },
    '.cm-completionIcon': {
      color: colors.gutters,
    },
    '.cm-completionLabel': {
      color: colors.foreground,
    },
    '.cm-completionDetail': {
      color: colors.comment,
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
    },
    '.cm-panel.cm-search': {
      backgroundColor: colors.dropdownBackground,
      border: `1px solid ${colors.dropdownBorder}`,
      padding: '4px',
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
      backgroundColor: colors.activeLine,
    },
  }),
  // Additional highlighting rules for better syntax coverage
  EditorView.theme({
    '.cm-meta': {
      color: colors.comment,
    },
    '.cm-punctuation': {
      color: colors.separator,
    },
    '.cm-bracket': {
      color: colors.separator,
    },
    '.cm-squareBracket': {
      color: colors.separator,
    },
    '.cm-paren': {
      color: colors.separator,
    },
    '.cm-curlyBracket': {
      color: colors.separator,
    },
    '.cm-angleBracket': {
      color: colors.separator,
    },
  }),
]
