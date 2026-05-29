/**
 * CitationLink 组件
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@test-agentstudio/base-ui'
import type { CitationMessages } from '@/pages/Apps/types'
import { CitationTooltip } from './CitationTooltip'
import { CitationTooltipContent } from './CitationTooltipContent'

export interface CitationLinkProps {
  href?: string
  title?: string
  children: React.ReactNode
  citations?: CitationMessages | null
}

function parseCheckedCitationIndex(title?: string): number | null {
  if (!title) {
    return null
  }

  const match = title.match(/^checked_citation:(\d+)$/)
  if (!match) {
    return null
  }

  return Number(match[1])
}

export const CitationLink: React.FC<CitationLinkProps> = ({
  href,
  title,
  children,
  citations = null,
}) => {
  const citationIndex = useMemo(() => parseCheckedCitationIndex(title), [title])

  const citationData = useMemo(() => {
    if (
      !citations?.data ||
      citations.data.length === 0 ||
      citationIndex === null ||
      citationIndex < 0
    ) {
      return null
    }

    return citations.data[citationIndex] || null
  }, [citationIndex, citations])

  const [isTooltipOpen, setIsTooltipOpen] = useState(false)
  const tooltipRef = useRef<HTMLSpanElement>(null)

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsTooltipOpen(!isTooltipOpen)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsTooltipOpen(false)
      }
    }

    if (isTooltipOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isTooltipOpen])

  return (
    <span ref={tooltipRef}>
      <CitationTooltip
        open={isTooltipOpen}
        className="border border-gray-200 bg-white shadow-lg [&_svg]:!bg-white [&_svg]:!fill-white"
        title={citationData ? <CitationTooltipContent citationData={citationData} href={href} /> : null}
        side="top"
        sideOffset={2}
      >
        <a
          href="#"
          onClick={e => {
            e.preventDefault()
            handleClick(e)
          }}
          className={cn(
            'cursor-pointer font-semibold',
            'text-blue-600',
            'hover:text-blue-800',
            'hover:underline',
            'transition-colors duration-150',
          )}
          data-citation-index={citationIndex ?? -1}
        >
          {children}
        </a>
      </CitationTooltip>
    </span>
  )
}

export default CitationLink
