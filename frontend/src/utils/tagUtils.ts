/**
 * Tag相关的工具函数
 * 用于处理标签颜色显示和样式
 */

export interface Tag {
  primary_id: number
  space_id: string
  tag_name: string
  tag_color?: string
  is_active: boolean
  usage_count?: number
  create_time?: number
  update_time?: number
  create_user?: string
  update_user?: string
}

// 预定义颜色选项
export const colorOptions = [
  { name: '蓝色', hex: '#3B82F6', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  { name: '绿色', hex: '#10B981', className: 'bg-green-100 text-green-800 border-green-200' },
  { name: '紫色', hex: '#8B5CF6', className: 'bg-purple-100 text-purple-800 border-purple-200' },
  { name: '粉色', hex: '#EC4899', className: 'bg-pink-100 text-pink-800 border-pink-200' },
  { name: '靛蓝', hex: '#6366F1', className: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { name: '黄色', hex: '#F59E0B', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { name: '红色', hex: '#EF4444', className: 'bg-red-100 text-red-800 border-red-200' },
  { name: '灰色', hex: '#6B7280', className: 'bg-gray-100 text-gray-800 border-gray-200' },
  { name: '青色', hex: '#06B6D4', className: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { name: '橙色', hex: '#F97316', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  { name: '琥珀色', hex: '#F59E0B', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  { name: '石灰色', hex: '#84CC16', className: 'bg-lime-100 text-lime-800 border-lime-200' },
]

// 颜色缓存
const colorCache = new Map<string, string>()

// 获取标签的完整样式信息
export const getTagStyleInfo = (tag: Tag) => {
  console.log('[DFX:TagUtils] 计算标签样式', {
    tagId: tag.primary_id,
    tagName: tag.tag_name,
    tagColor: tag.tag_color,
  })

  const colorClass = getTagColor(tag)

  if (colorClass === 'custom-tag-color' && tag.tag_color) {
    console.log('[DFX:TagUtils] 使用自定义颜色样式', {
      customColor: tag.tag_color,
      tagName: tag.tag_name,
    })

    // 计算颜色亮度以确定文字颜色
    const hex = tag.tag_color.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)

    // 计算相对亮度 (使用标准的亮度计算公式)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    console.log('[DFX:TagUtils] 颜色亮度计算', {
      color: tag.tag_color,
      brightness: brightness.toFixed(2),
      r,
      g,
      b,
    })

    // 使用更严格的阈值确保文字清晰可读
    // 对于 #7C2D12 这样的深棕色，亮度约为 46.6，应该使用白色文字
    const textColor = brightness > 140 ? '#1f2937' : 'white'
    console.log('[DFX:TagUtils] 文字颜色选择', {
      brightnessThreshold: 140,
      calculatedBrightness: brightness.toFixed(2),
      selectedTextColor: textColor,
      isDarkBackground: textColor === 'white',
    })

    // 对于深色背景，使用更柔和的边框处理
    const isDarkBackground = textColor === 'white'
    const borderColor = isDarkBackground ? `${tag.tag_color}60` : tag.tag_color // 深色背景时边框增加透明度

    const result = {
      className: isDarkBackground ? '' : 'border', // 深色背景时移除边框类
      style: {
        backgroundColor: `${tag.tag_color}25`, // 稍微增加背景不透明度
        borderColor: borderColor,
        color: textColor,
        fontWeight: 600, // 增加字重提高可读性
        textShadow: isDarkBackground ? '0 1px 2px rgba(0,0,0,0.3)' : 'none', // 深色背景时添加文字阴影
        boxShadow: isDarkBackground ? 'inset 0 0 0 1px rgba(255,255,255,0.15)' : 'none', // 深色背景时添加内阴影边框
        filter: isDarkBackground ? 'contrast(1.1)' : 'none', // 深色背景时增加对比度
      },
    }

    console.log('[DFX:TagUtils] 样式计算完成', {
      tagName: tag.tag_name,
      isDarkBackground,
      hasBorder: !!result.className,
      styleKeys: Object.keys(result.style),
    })

    return result
  }

  console.log('[DFX:TagUtils] 使用预定义颜色样式', {
    tagName: tag.tag_name,
    colorClass,
  })

  return {
    className: colorClass,
    style: {},
  }
}

export const getTagColor = (tag: Tag): string => {
  const cacheKey = `${tag.tag_name}_${tag.tag_color || ''}`
  if (colorCache.has(cacheKey)) {
    console.log('[DFX:TagUtils] 从缓存获取颜色', {
      tagName: tag.tag_name,
      cacheKey,
      cachedColor: colorCache.get(cacheKey),
    })
    return colorCache.get(cacheKey)!
  }

  // 如果有用户设置的颜色，优先使用
  if (tag.tag_color) {
    const colorOption = colorOptions.find(option => option.hex === tag.tag_color)
    if (colorOption) {
      // 如果是预定义颜色，使用对应的CSS类
      console.log('[DFX:TagUtils] 使用预定义颜色', {
        tagName: tag.tag_name,
        customColor: tag.tag_color,
        colorOption: colorOption.name,
        className: colorOption.className,
      })
      colorCache.set(cacheKey, colorOption.className)
      return colorOption.className
    } else {
      // 如果是自定义颜色，返回特殊标记
      console.log('[DFX:TagUtils] 检测到自定义颜色', {
        tagName: tag.tag_name,
        customColor: tag.tag_color,
        cacheKey,
      })
      colorCache.set(cacheKey, 'custom-tag-color')
      return 'custom-tag-color'
    }
  }

  // 如果没有用户设置的颜色，使用算法生成（保持向后兼容）
  const colors = [
    'bg-blue-100 text-blue-800 border-blue-200',
    'bg-green-100 text-green-800 border-green-200',
    'bg-purple-100 text-purple-800 border-purple-200',
    'bg-pink-100 text-pink-800 border-pink-200',
    'bg-indigo-100 text-indigo-800 border-indigo-200',
    'bg-yellow-100 text-yellow-800 border-yellow-200',
    'bg-red-100 text-red-800 border-red-200',
    'bg-gray-100 text-gray-800 border-gray-200',
  ]

  const hash = tag.tag_name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const color = colors[hash % colors.length]

  console.log('[DFX:TagUtils] 生成算法颜色', {
    tagName: tag.tag_name,
    hash,
    colorIndex: hash % colors.length,
    generatedColor: color,
  })

  colorCache.set(cacheKey, color)
  return color
}

// 清除颜色缓存（在标签更新后调用）
export const clearColorCache = () => {
  const cacheSize = colorCache.size
  colorCache.clear()
  console.log(`[DFX:TagUtils] 颜色缓存已清除，清理了 ${cacheSize} 个缓存项，标签样式将重新计算`)
}
