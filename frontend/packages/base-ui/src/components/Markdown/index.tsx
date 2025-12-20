import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { Link } from './Link'
import { Image } from './Image'
import { MarkdownProps } from './types'
import type { Components } from 'react-markdown'

// 定义Markdown组件
export const Markdown: React.FC<MarkdownProps> = ({ content, className = '', components = {}, enableMath = true }) => {
  // 使用useMemo缓存组件映射，避免每次渲染重新创建
  const defaultComponents = useMemo(() => {
    // 创建符合 react-markdown 类型要求的组件映射
    const markdownComponents: Components = {
      // 使用内联函数处理 a 标签
      a: ({ node, href, children, ...rest }) => {
        return (
          <Link href={href || '#'} {...rest}>
            {children}
          </Link>
        )
      },
      // 使用内联函数处理 img 标签
      img: ({ node, src, alt, ...rest }) => {
        return <Image src={src || ''} alt={alt || ''} {...rest} />
      },
    }

    // 合并用户提供的自定义组件
    for (const [key, Component] of Object.entries(components)) {
      if (Component) {
        // 使用类型断言解决索引签名问题
        ;(markdownComponents as Record<string, React.ComponentType<any>>)[key] = Component
      }
    }

    return markdownComponents
  }, [components])

  return (
    <div className={`markdown-content prose dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        components={defaultComponents}
        remarkPlugins={enableMath ? [remarkGfm, remarkMath] : [remarkGfm]}
        rehypePlugins={enableMath ? [rehypeKatex] : []}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

// Export components
export { Link } from './Link'
export { Image } from './Image'
export * from './types'

export default Markdown
