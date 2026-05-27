/**
 * DeepSearch 思维链工具函数
 */

// Edge标签国际化映射表
const EDGE_LABEL_KEYS = {
  // 中文映射
  '框架支撑': 'apps.deepSearch.mindMap.edge.frameworkSupport',
  '基础依赖': 'apps.deepSearch.mindMap.edge.basicDependence',
  '理论指导': 'apps.deepSearch.mindMap.edge.theoreticalGuidance',
  '结论延伸': 'apps.deepSearch.mindMap.edge.conclusionExtension',
  '信息整合': 'apps.deepSearch.mindMap.edge.informationIntegration',
  '问题导向': 'apps.deepSearch.mindMap.edge.problemOriented',

  // 英文映射
  'Framework Support':    'apps.deepSearch.mindMap.edge.frameworkSupport',
  'Basic Dependence':     'apps.deepSearch.mindMap.edge.basicDependence',
  'Theoretical Guidance': 'apps.deepSearch.mindMap.edge.theoreticalGuidance',
  'Conclusion Extension': 'apps.deepSearch.mindMap.edge.conclusionExtension',
  'Information Integration': 'apps.deepSearch.mindMap.edge.informationIntegration',
  'Problem-Oriented':     'apps.deepSearch.mindMap.edge.problemOriented',
} as const;

/**
 * 获取Edge标签的国际化文本
 *
 * @param label - 原始标签（可能是中文或英文）
 * @param t - i18n翻译函数
 * @returns 翻译后的文本，如果不在映射中则返回原值
 *
 * @example
 * ```tsx
 * const { t } = useTranslation();
 * const translatedLabel = getEdgeLabelI18n('Framework Support', t);
 * // 中文环境返回: '框架支撑'
 * // 英文环境返回: 'Framework Support'
 *
 * const unknownLabel = getEdgeLabelI18n('未知标签', t);
 * // 返回: '未知标签' (原值)
 * ```
 */
export function getEdgeLabelI18n(
  label: string | undefined,
  t: (key: string) => string
): string | undefined {
  if (!label) {
    return undefined;
  }

  const i18nKey = EDGE_LABEL_KEYS[label as keyof typeof EDGE_LABEL_KEYS];
  return i18nKey ? t(i18nKey) : label;
}
