/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */
import { useEffect } from 'react'
import { useAvailableVariables } from '@flowgram.ai/free-layout-editor'
import { Button } from '@douyinfe/semi-ui'
import { Plus } from 'lucide-react'

import { VariableGroupManagerProps, VariableGroup } from '../types'
import { GroupCard } from './group-card'
import { inferVariableType } from './type-inference'
import { useTranslation } from '../../../i18n'

export const VariableGroupManager = ({ groups, onGroupsChange, onNodeStructureChange }: VariableGroupManagerProps) => {
  const { t } = useTranslation()
  const availableVariables = useAvailableVariables()

  useEffect(() => {
    if (onNodeStructureChange && groups.length > 0) {
      const { inputParameters, outputs } = generateNodeStructure(groups)
      onNodeStructureChange(inputParameters, outputs, groups)
    }
  }, [groups, onNodeStructureChange])

  const generateNodeStructure = (groups: VariableGroup[]) => {
    const inputParameters: Record<string, any> = {}
    const outputs: Record<string, any> = {}

    let inputCounter = 1

    groups.forEach((group, groupIndex) => {
      group.items.forEach(item => {
        const inputName = `input${inputCounter}`
        inputParameters[inputName] = {
          type: 'ref',
          content: item.split('.'),
          extra: { index: groupIndex },
        }
        inputCounter++
      })

      outputs[group.name] = {
        type: group.type,
        extra: { index: groupIndex + 1 },
      }
    })

    return { inputParameters, outputs }
  }

  const updateGroup = (index: number, updatedGroup: VariableGroup) => {
    const newGroups = [...groups]
    newGroups[index] = updatedGroup
    onGroupsChange(newGroups)
    updateNodeStructure(newGroups)
  }

  const deleteGroup = (index: number) => {
    const newGroups = groups.filter((_, i) => i !== index)
    onGroupsChange(newGroups)
    updateNodeStructure(newGroups)
  }

  const generateUniqueGroupName = (existingGroups: VariableGroup[]) => {
    let counter = 1
    let name = `Group${counter}`

    while (existingGroups.some(group => group.name === name)) {
      counter++
      name = `Group${counter}`
    }

    return name
  }

  const addGroup = () => {
    const newGroup: VariableGroup = {
      name: generateUniqueGroupName(groups),
      items: [''],
      type: 'string',
    }
    const newGroups = [...groups, newGroup]
    onGroupsChange(newGroups)
    updateNodeStructure(newGroups)
  }

  const updateNodeStructure = (currentGroups: VariableGroup[]) => {
    if (onNodeStructureChange) {
      const { inputParameters, outputs } = generateNodeStructure(currentGroups)
      onNodeStructureChange(inputParameters, outputs, currentGroups)
    }
  }

  const getGroupType = (group: VariableGroup): string => {
    if (group.items.length > 0 && group.items[0]) {
      const firstItem = group.items[0]
      return inferVariableType(firstItem, availableVariables || [])
    }
    return group.type || 'string'
  }

  return (
    <div>
      {groups.map((group, groupIndex) => (
        <GroupCard
          key={groupIndex}
          group={group}
          groupIndex={groupIndex}
          groupsLength={groups.length}
          onUpdate={updateGroup}
          onDelete={deleteGroup}
          availableVariables={availableVariables || []}
          inferVariableType={inferVariableType}
          getGroupType={getGroupType}
        />
      ))}

      {groups.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: 40,
            backgroundColor: '#f5f5f5',
            borderRadius: 8,
            color: '#999',
          }}
        >
          <Plus style={{ fontSize: 24, marginBottom: 8 }} />
          <div>{t('workflowCanvas.nodes.variableMerge.noGroups')}</div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Button type="primary" icon={<Plus />} block onClick={addGroup}>
          {t('workflowCanvas.nodes.variableMerge.addGroup')}
        </Button>
      </div>
    </div>
  )
}
