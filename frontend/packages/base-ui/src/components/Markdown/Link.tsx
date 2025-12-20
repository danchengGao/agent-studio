import React from 'react'

export interface BasicLinkProps {
  href: string
  children: React.ReactNode
  className?: string
  target?: string
  rel?: string
}

export const Link: React.FC<BasicLinkProps> = ({
  href,
  children,
  className = 'text-primary hover:underline',
  target = '_blank',
  rel = 'noopener noreferrer',
}) => {
  return (
    <a href={href} target={target} rel={rel} className={className}>
      {children}
    </a>
  )
}

export default Link
