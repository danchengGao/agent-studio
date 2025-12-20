import React from 'react'
import { ImageProps } from './types'

export const Image: React.FC<ImageProps> = ({ src, alt = '', className = 'rounded' }) => {
  return (
    <a href={src} target="_blank" rel="noopener noreferrer">
      <img src={src} alt={alt} className={className} loading="lazy" />
    </a>
  )
}

export default Image
