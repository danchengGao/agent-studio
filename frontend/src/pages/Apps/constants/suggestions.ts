/**
 * 建议提示词配置
 */

export interface Suggestion {
  id: number
  text: string
  icon: string
}

/**
 * 根据智能体 ID 获取建议提示词
 */
export const getSuggestionsByAgent = (agentId: string): Suggestion[] => {
  switch (agentId) {
    case 'deepsearch':
      return [
        { id: 1, text: '育儿补贴政策发布是否增加总和生育率', icon: '📊' },
        { id: 2, text: '请对安徽合肥汽车产业链的情况进行分析', icon: '🏭' },
      ]
    default:
      return []
  }
}

