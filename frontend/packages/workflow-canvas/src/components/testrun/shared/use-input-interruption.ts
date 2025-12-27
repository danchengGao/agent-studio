/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useState, useCallback } from 'react'

import { testRunRuntimeService } from '../runtime/testrun-runtime-service'
import { InputInterruption } from '../runtime/types'

export function useInputInterruption() {
  const [interruption, setInterruption] = useState<InputInterruption | null>(null)
  const [inputValues, setInputValues] = useState<Record<string, unknown>>({})

  const handleInputRequired = useCallback((data: InputInterruption) => {
    setInterruption(data)
    setInputValues({})
  }, [])

  const resume = useCallback(
    async (values: Record<string, unknown>) => {
      if (!interruption) return false

      const nodeId = interruption.nodeId

      setInterruption(null)
      setInputValues({})

      try {
        await testRunRuntimeService.resumeStreamExecution({
          node_id: nodeId,
          input_value: values,
        })
        return true
      } catch (error) {
        setInterruption({ nodeId, message: interruption.message })
        return false
      }
    },
    [interruption],
  )

  const clear = useCallback(() => {
    setInterruption(null)
    setInputValues({})
  }, [])

  return {
    interruption,
    inputValues,
    setInputValues,
    handleInputRequired,
    resume,
    clear,
  }
}
