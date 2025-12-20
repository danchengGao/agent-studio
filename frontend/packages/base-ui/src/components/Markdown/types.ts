import { ReactNode } from 'react'

export interface LinkProps {
  href: string
  children: ReactNode
}

export interface ImageProps {
  src: string
  alt?: string
  className?: string
}

export interface MarkdownComponentsType {
  a?: React.ComponentType<LinkProps>
  img?: React.ComponentType<ImageProps>
  [key: string]: React.ComponentType<any> | undefined
}

export interface MarkdownProps {
  content: string
  className?: string
  components?: MarkdownComponentsType
  enableMath?: boolean
}
