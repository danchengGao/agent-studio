/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import React from 'react'

import { FieldArray, Field, WorkflowNodePortsData } from '@flowgram.ai/free-layout-editor'

import { useNodeRenderContext } from '../../../hooks'
import { FormDisplay } from '../../../form-components'
import { PortContainer } from './display-styles'
import { ConditionContentDisplay } from './condition-content-display'
import { AlignedFormDisplayGroup } from './aligned-form-display-group'
import { determineBranchType, getBranchTitle, generateBranchPortId, BranchValue } from './utils'

export const ConditionDisplay: React.FC = () => {
  const { node } = useNodeRenderContext()

  React.useLayoutEffect(() => {
    window.requestAnimationFrame(() => {
      const portsData = node.getData<WorkflowNodePortsData>(WorkflowNodePortsData)
      if (portsData) {
        portsData.updateDynamicPorts()
      }
    })
  }, [node])

  return (
    <FieldArray name="branches">
      {({ field }) => {
        const rawBranches = Array.isArray(field.value) ? (field.value as BranchValue[]) : []
        const branches = rawBranches.map((branch, index) => ({
          ...branch,
          branchId: branch.branchId || `branch_${index}`,
          conditions: Array.isArray(branch.conditions) ? branch.conditions : [],
          logic: branch.logic || 2,
        }))

        return (
          <>
            <div className="relative">
              {branches.map((branch: BranchValue, index: number) => {
                const conditions = branch?.conditions || []
                const conditionCount = conditions.length
                const logicCount = conditionCount > 0 ? conditionCount - 1 : 0
                const contentHeight = conditionCount === 0 ? 32 : conditionCount * 24 + logicCount * 16 + 8
                const rowHeight = Math.max(20, contentHeight)

                let topOffset: number
                if (index === 0) {
                  topOffset = rowHeight / 2
                } else {
                  topOffset =
                    branches.slice(0, index).reduce((sum, prevBranch) => {
                      const prevConditions = prevBranch?.conditions || []
                      const prevConditionCount = prevConditions.length
                      const prevLogicCount = prevConditionCount > 0 ? prevConditionCount - 1 : 0
                      const prevContentHeight = prevConditionCount === 0 ? 32 : prevConditionCount * 24 + prevLogicCount * 16 + 8
                      const prevRowHeight = Math.max(20, prevContentHeight)
                      return sum + prevRowHeight + 2
                    }, 0) +
                    rowHeight / 2
                }

                return (
                  // eslint-disable-next-line react/jsx-key
                  <PortContainer style={{ top: `${topOffset}px` }} data-port-id={generateBranchPortId(branch)} data-port-type="output" />
                )
              })}
            </div>

            <AlignedFormDisplayGroup>
              {branches.map((branch: BranchValue, index: number) => {
                const currentBranchType = determineBranchType(branch, index, branches)
                const branchTitle = getBranchTitle(currentBranchType)

                return (
                  <FormDisplay
                    key={branch.branchId || index}
                    label={branchTitle}
                    content={<Field name={`branches.${index}`}>{({ field }) => <ConditionContentDisplay branch={field.value || branch} />}</Field>}
                  />
                )
              })}
            </AlignedFormDisplayGroup>
          </>
        )
      }}
    </FieldArray>
  )
}

ConditionDisplay.displayName = 'ConditionDisplay'
