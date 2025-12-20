/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import React from 'react'

import type { IInputsValues } from '../../'
import { PromptEditor, PromptEditorPropsType } from '../../'
import { EditorInputsTree } from '../../'

export interface PromptEditorWithInputsProps extends PromptEditorPropsType {
  inputsValues: IInputsValues
}

export function PromptEditorWithInputs({ inputsValues, ...restProps }: PromptEditorWithInputsProps) {
  return (
    <PromptEditor {...restProps}>
      <EditorInputsTree inputsValues={inputsValues} />
    </PromptEditor>
  )
}
