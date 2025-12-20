import { customAlphabet } from 'nanoid'

// 自定义字符集：只包含数字、字母和下划线
const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_'

// 创建自定义nanoid函数
const customNanoidGenerator = customAlphabet(alphabet)

export const customNanoid = (size: number = 5): string => {
  return customNanoidGenerator(size)
}
