/**
 * 字体加载器工具 - 优化版本
 * 确保HarmonyOS字体在页面加载时被正确应用，减少阻塞时间
 */

// import { smartFontPreload } from './font-preloader';

// 字体加载状态
let fontsLoaded = false
let fontsLoading = false

// 预加载的字体列表 - 按优先级排序
const fontUrls = [
  // 主要字体，优先加载
  { url: '/fonts/HarmonyOS_Sans_SC_Regular.ttf', name: 'HarmonyOS Sans SC', weight: '400', style: 'normal' },
  { url: '/fonts/HarmonyOS_Sans_Regular.ttf', name: 'HarmonyOS Sans', weight: '400', style: 'normal' },
  // 次要字体，延迟加载
  { url: '/fonts/HarmonyOS_Sans_SC_Medium.ttf', name: 'HarmonyOS Sans SC', weight: '500', style: 'normal' },
  { url: '/fonts/HarmonyOS_Sans_Medium.ttf', name: 'HarmonyOS Sans', weight: '500', style: 'normal' },
  { url: '/fonts/HarmonyOS_Sans_SC_Bold.ttf', name: 'HarmonyOS Sans SC', weight: '700', style: 'normal' },
  { url: '/fonts/HarmonyOS_Sans_Bold.ttf', name: 'HarmonyOS Sans', weight: '700', style: 'normal' },
]

/**
 * 异步加载字体文件，不阻塞渲染
 */
export const loadFonts = async (): Promise<void> => {
  if (fontsLoaded || fontsLoading) {
    return
  }

  fontsLoading = true

  try {
    // 使用FontFace API加载字体
    if ('FontFace' in window) {
      // 立即加载主要字体
      const primaryFonts = fontUrls.slice(0, 2)
      const secondaryFonts = fontUrls.slice(2)

      // 加载主要字体
      const primaryFontPromises = primaryFonts.map(async fontInfo => {
        const font = new FontFace(fontInfo.name, `url(${fontInfo.url})`, {
          weight: fontInfo.weight,
          style: fontInfo.style,
          display: 'swap', // 使用swap策略，减少布局偏移
        })
        await font.load()
        document.fonts.add(font)
        return font
      })

      // 等待主要字体加载完成
      await Promise.all(primaryFontPromises)
      fontsLoaded = true

      // 异步加载次要字体，不阻塞
      setTimeout(async () => {
        try {
          const secondaryFontPromises = secondaryFonts.map(async fontInfo => {
            const font = new FontFace(fontInfo.name, `url(${fontInfo.url})`, {
              weight: fontInfo.weight,
              style: fontInfo.style,
              display: 'swap',
            })
            await font.load()
            document.fonts.add(font)
            return font
          })

          await Promise.all(secondaryFontPromises)
          console.log('所有字体加载完成')
        } catch (error) {
          console.warn('次要字体加载失败:', error)
        }
      }, 1000) // 延迟1秒加载次要字体
    } else {
      // 降级处理：使用CSS类名触发字体应用
      document.documentElement.classList.add('fonts-loaded')
      fontsLoaded = true
    }
  } catch (error) {
    console.warn('字体加载失败，使用系统字体:', error)
    fontsLoaded = true
  } finally {
    fontsLoading = false
  }
}

/**
 * 检查字体是否已加载
 */
export const areFontsLoaded = (): boolean => {
  return fontsLoaded
}

/**
 * 强制应用字体到页面
 */
export const applyFonts = (): void => {
  // 确保字体应用到根元素
  document.documentElement.style.fontFamily = 'HarmonyOS Sans SC, HarmonyOS Sans, system-ui, sans-serif'

  // 添加字体加载完成的类名
  document.documentElement.classList.add('fonts-loaded')
}

// 页面加载完成后自动加载字体
if (typeof window !== 'undefined') {
  // 在DOMContentLoaded后加载字体
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      loadFonts()
      applyFonts()
    })
  } else {
    loadFonts()
    applyFonts()
  }

  // 在页面完全加载后再次确保字体应用
  window.addEventListener('load', applyFonts)
}
