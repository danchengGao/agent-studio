/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import React from 'react'

import { I18n } from '@flowgram.ai/editor'

// Simple Text interface for our implementation
interface Text {
  toString(): string
  replaceRange(from: number, to: number, text: string): void
}

// Simple transformer creator function
function transformerCreator(transformFn: (text: Text) => void) {
  return transformFn
}

import { EditorVariableTree, EditorVariableTagInject } from '../../'
import { JsonCodeEditor } from '../../'
import type { BaseEditorProps } from '../base-editor'

const TRIGGER_CHARACTERS = ['@']

type Match = { match: string; range: [number, number] }
function findAllMatches(inputString: string, regex: RegExp): Match[] {
  const globalRegex = new RegExp(regex, regex.flags.includes('g') ? regex.flags : regex.flags + 'g')
  let match
  const matches: Match[] = []

  while ((match = globalRegex.exec(inputString)) !== null) {
    if (match.index === globalRegex.lastIndex) {
      globalRegex.lastIndex++
    }
    matches.push({
      match: match[0],
      range: [match.index, match.index + match[0].length],
    })
  }

  return matches
}

const transformer = transformerCreator((text: Text) => {
  const originalSource = text.toString()
  const matches = findAllMatches(originalSource, /\{\{([^}]*)\}\}/g)

  if (matches.length > 0) {
    matches.forEach(({ range }) => {
      text.replaceRange(range[0], range[1], 'null')
    })
  }

  return text
})

export interface JsonEditorWithVariablesProps extends Omit<BaseEditorProps, 'language'> {}

export function JsonEditorWithVariables(props: JsonEditorWithVariablesProps) {
  return (
    <JsonCodeEditor
      activeLinePlaceholder={I18n.t("Press '@' to Select variable")}
      {...props}
      options={{
        transformer,
        ...(props.options || {}),
      }}
    >
      <EditorVariableTree triggerCharacters={TRIGGER_CHARACTERS} />
      <EditorVariableTagInject />
    </JsonCodeEditor>
  )
}
