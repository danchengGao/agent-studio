/**
 * Markdown 核心渲染组件
 */

import React, { useMemo } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import 'katex/dist/katex.min.css'
import type { Components } from 'react-markdown'
import type { MarkdownProps } from './types'
import { MarkdownLink } from './MarkdownLink'
import { CitationLink } from '../CitationPanel/CitationLink'
import { InferenceLink } from '../InferenceGraph'
import { SmartImage } from './SmartImage'
import { MermaidChart } from './MermaidChart/index'
import { normalizeProblematicStrongPercentForRender } from '@/utils/markdownCleaner'
import {
  createVLMChartReference,
  getChartDataUrl,
  getChartIdFromReference,
  insertVLMChartsIntoReportContent,
  isVLMChartReference,
} from '@/utils/reportUtils'

export const MarkdownRenderer: React.FC<{
  instanceId?: MarkdownProps['instanceId']
  content: string
  citations?: MarkdownProps['citations']
  inferMessages?: MarkdownProps['inferMessages']
  chartMessages?: MarkdownProps['chartMessages']
}> = ({ content, citations, instanceId, chartMessages }) => {
  const chartDataUrlMap = useMemo(() => {
    const entries = (chartMessages || [])
      .map(chart => {
        const dataUrl = getChartDataUrl(chart)
        return dataUrl ? [chart.chart_id, dataUrl] as const : null
      })
      .filter((entry): entry is readonly [string, string] => entry !== null)

    return new Map(entries)
  }, [chartMessages])

  const renderableContent = useMemo(
    () => insertVLMChartsIntoReportContent(
      content,
      chartMessages,
      chart => createVLMChartReference(chart.chart_id)
    ),
    [chartMessages, content]
  )

  const normalizedContent = useMemo(
    () => normalizeProblematicStrongPercentForRender(renderableContent),
    [renderableContent]
  )

  const defaultComponents = useMemo(() => {
    const markdownComponents: Components = {
      a: ({ href, children, ...rest }) => {
        const childrenText = children !== undefined && children !== null ? children.toString() : ''
        const isInferenceLink = /#inference:\d+/.test(href || '')
        const isCitation = /^\[(\d+)\]$/.test(childrenText)

        if (isInferenceLink) {
          return (
            <InferenceLink
              key={`${instanceId || 'no-id'}-inference-${childrenText}`}
              href={href ?? ''}
              instanceId={instanceId ?? 'no-id'}
            >
              {children}
            </InferenceLink>
          )
        }

        if (isCitation) {
          return (
            <CitationLink
              key={`${instanceId || 'no-id'}-citation-${childrenText}`}
              href={href ?? ''}
              citations={citations}
              markdownInstanceId={instanceId}
            >
              {children}
            </CitationLink>
          )
        }

        return (
          <MarkdownLink key={`${instanceId || 'no-id'}-link-${childrenText}`} href={href ?? '#'} {...rest}>
            {children}
          </MarkdownLink>
        )
      },

      img: ({ src, alt, ...rest }) => {
        if (src && isVLMChartReference(src)) {
          const chartId = getChartIdFromReference(src)
          const resolvedSrc = chartDataUrlMap.get(chartId)

          if (!resolvedSrc) {
            return null
          }

          return <SmartImage src={resolvedSrc} alt={alt || ''} {...rest} />
        }

        return <SmartImage src={src || ''} alt={alt || ''} {...rest} />
      },

      pre: ({ children, ...rest }) => {
        if (React.isValidElement(children)) {
          const childElement = children as React.ReactElement<any>
          if (childElement.props?.className?.includes('language-mermaid')) {
            const codeContent = childElement.props?.children
            const code = Array.isArray(codeContent) ? codeContent.join('') : String(codeContent || '')
            return <MermaidChart code={code.replace(/\n$/, '')} />
          }
        }

        return <pre {...rest}>{children}</pre>
      },

      code({ className, children, ...rest }) {
        return (
          <code className={className} {...rest}>
            {children}
          </code>
        )
      },
    }

    return markdownComponents
  }, [chartDataUrlMap, citations, instanceId])

  const sanitizeSchema = useMemo(
    () => ({
      ...defaultSchema,
      attributes: {
        ...defaultSchema.attributes,
        span: [...(defaultSchema.attributes?.span || []), 'className', 'style'],
        div: [...(defaultSchema.attributes?.div || []), 'className', 'style'],
      },
      tagNames: (defaultSchema.tagNames || []).filter(
        tag => !['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea'].includes(tag)
      ),
      protocols: {
        ...defaultSchema.protocols,
        src: [...(defaultSchema.protocols?.src || []), 'data', 'vlm-chart'],
      },
    }),
    []
  )

  const urlTransform = useMemo(
    () => (url: string, key: string, node: { tagName?: string }) => {
      if (
        key === 'src' &&
        node.tagName === 'img' &&
        (url.startsWith('data:image/') || isVLMChartReference(url))
      ) {
        return url
      }

      return defaultUrlTransform(url)
    },
    []
  )

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeKatex]}
      components={defaultComponents}
      urlTransform={urlTransform}
    >
      {normalizedContent}
    </ReactMarkdown>
  )
}
