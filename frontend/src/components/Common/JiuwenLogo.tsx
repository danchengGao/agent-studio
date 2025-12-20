import React from 'react'

interface JiuwenLogoProps {
  className?: string
  width?: number
  height?: number
}

const JiuwenLogo: React.FC<JiuwenLogoProps> = ({ className = '', width = 32, height = 32 }) => {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 89.7 89.76" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          {`
            .cls-1,.cls-2,.cls-3{fill-rule:evenodd;}
            .cls-1{fill:url(#未命名的渐变_8);}
            .cls-2,.cls-3{opacity:1;isolation:isolate;}
            .cls-2{fill:url(#未命名的渐变_2);}
            .cls-3{fill:url(#未命名的渐变_3);}
          `}
        </style>
        <linearGradient id="未命名的渐变_8" x1="22.85" y1="64.59" x2="121.23" y2="39.3" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5f81ff" />
          <stop offset="0.39" stopColor="#6ea6ff" />
          <stop offset="0.52" stopColor="#73b3ff" />
          <stop offset="1" stopColor="#8ff4ff" />
        </linearGradient>
        <linearGradient id="未命名的渐变_2" x1="82.62" y1="59.99" x2="92.63" y2="59.99" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5abfe2" />
          <stop offset="1" stopColor="#56b0e4" />
        </linearGradient>
        <linearGradient id="未命名的渐变_3" x1="48.17" y1="55" x2="58.14" y2="55" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#56a8e6" />
          <stop offset="1" stopColor="#509ae6" />
        </linearGradient>
      </defs>
      <title>openJiuwen Logo</title>
      <path
        className="cls-1"
        d="M35.47,42.76h-10v54.5h10M58.14,17.48h47.15V87.29H92.63v10H115.2V7.5H91.8l-33.66,0M25.5,7.5h20V32.79h-20V27H38.8V23.59H25.5Zm6.65,6.9H38.8v3.44H32.15ZM92.63,42.76H48.17v-10H92.63ZM79,77.21H48.17v-10H79Z"
        transform="translate(-25.5 -7.5)"
      />
      <path className="cls-2" d="M82.62,42.76h10V77.21h-10Z" transform="translate(-25.5 -7.5)" />
      <path className="cls-3" d="M48.17,42.76h10V67.24h-10Z" transform="translate(-25.5 -7.5)" />
    </svg>
  )
}

export default JiuwenLogo
