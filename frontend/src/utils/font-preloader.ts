/**
 * 字体预加载器工具
 * 使用更智能的预加载策略来避免字体预加载警告
 */

// 字体预加载配置
const fontConfig = {
  critical: [
    {
      url: '/fonts/HarmonyOS_Sans_SC_Regular.ttf',
      family: 'HarmonyOS Sans SC',
      weight: '400',
      style: 'normal',
    },
    {
      url: '/fonts/HarmonyOS_Sans_Regular.ttf',
      family: 'HarmonyOS Sans',
      weight: '400',
      style: 'normal',
    },
  ],
  nonCritical: [
    {
      url: '/fonts/HarmonyOS_Sans_SC_Medium.ttf',
      family: 'HarmonyOS Sans SC',
      weight: '500',
      style: 'normal',
    },
    {
      url: '/fonts/HarmonyOS_Sans_Medium.ttf',
      family: 'HarmonyOS Sans',
      weight: '500',
      style: 'normal',
    },
    {
      url: '/fonts/HarmonyOS_Sans_SC_Bold.ttf',
      family: 'HarmonyOS Sans SC',
      weight: '600',
      style: 'normal',
    },
    {
      url: '/fonts/HarmonyOS_Sans_Bold.ttf',
      family: 'HarmonyOS Sans',
      weight: '600',
      style: 'normal',
    },
  ],
}

/**
 * 智能字体预加载
 * 只预加载关键字体，其他字体延迟加载
 */
export const smartFontPreload = (): void => {
  // 立即预加载关键字体
  preloadCriticalFonts()

  // 延迟预加载非关键字体
  setTimeout(preloadNonCriticalFonts, 1000)
}

/**
 * 预加载关键字体
 */
const preloadCriticalFonts = (): void => {
  fontConfig.critical.forEach(font => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.href = font.url
    link.as = 'font'
    link.type = 'font/ttf'
    link.crossOrigin = 'anonymous'

    // 添加字体加载事件监听
    link.addEventListener('load', () => {
      console.log(`关键字体加载完成: ${font.family}`)
    })

    document.head.appendChild(link)
  })
}

/**
 * 预加载非关键字体
 */
const preloadNonCriticalFonts = (): void => {
  fontConfig.nonCritical.forEach(font => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.href = font.url
    link.as = 'font'
    link.type = 'font/ttf'
    link.crossOrigin = 'anonymous'

    document.head.appendChild(link)
  })
}

/**
 * 检查字体是否已预加载
 */
export const isFontPreloaded = (url: string): boolean => {
  const links = document.querySelectorAll('link[rel="preload"]')
  return Array.from(links).some(link => link.getAttribute('href') === url)
}

/**
 * 移除字体预加载标签
 * 在字体加载完成后调用，避免预加载警告
 */
export const removeFontPreload = (url: string): void => {
  const links = document.querySelectorAll('link[rel="preload"]')
  links.forEach(link => {
    if (link.getAttribute('href') === url) {
      link.remove()
    }
  })
}

// 自动初始化
if (typeof window !== 'undefined') {
  // 在页面加载完成后启动智能预加载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', smartFontPreload)
  } else {
    smartFontPreload()
  }
}
