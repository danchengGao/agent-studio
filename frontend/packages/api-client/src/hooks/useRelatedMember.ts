import { useMutation, useQuery, UseMutationOptions, UseQueryOptions } from 'react-query'
import { RelatedMemberService, RelatedMemberInfo, RegisterRelationResponse, GetRelationsResponse } from '../services/relatedMemberService'

/**
 * 注册 prompt 与其他成员（agent 或 workflow）的关联关系的 hook
 */
export const useRegisterPromptRelation = (
  options?: UseMutationOptions<RegisterRelationResponse, Error, { spaceId: string; promptInfo: RelatedMemberInfo; relatedMemberInfo: RelatedMemberInfo }>,
) => {
  return useMutation({
    mutationKey: ['registerPromptRelation'],
    mutationFn: async ({ spaceId, promptInfo, relatedMemberInfo }) => {
      return RelatedMemberService.registerPromptRelation(spaceId, promptInfo, relatedMemberInfo)
    },
    ...options,
  })
}

/**
 * 获取指定成员的关联关系的 hook
 */
export const usePromptRelations = (spaceId: string, keyMemberInfo: RelatedMemberInfo, options?: UseQueryOptions<GetRelationsResponse, Error>) => {
  return useQuery({
    queryKey: ['promptRelations', spaceId, keyMemberInfo.id, keyMemberInfo.type, keyMemberInfo.only_active],
    queryFn: async () => {
      return RelatedMemberService.getPromptRelations(spaceId, keyMemberInfo)
    },
    enabled: !!spaceId && !!keyMemberInfo.id && !!keyMemberInfo.type,
    ...options,
  })
}

/**
 * 删除指定成员的关联关系的 hook
 */
export const useDeletePromptRelation = (
  options?: UseMutationOptions<RegisterRelationResponse, Error, { spaceId: string; keyMemberInfo: RelatedMemberInfo }>,
) => {
  return useMutation({
    mutationKey: ['deletePromptRelation'],
    mutationFn: async ({ spaceId, keyMemberInfo }) => {
      return RelatedMemberService.deletePromptRelation(spaceId, keyMemberInfo)
    },
    ...options,
  })
}
