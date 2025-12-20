/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

/**
 * 代码语言模板定义
 * 用于在切换编程语言时提供对应的默认模板
 */
export interface CodeTemplate {
  language: string
  template: string
  description: string
}

/**
 * 预定义的代码模板
 */
export const CODE_TEMPLATES: Record<string, CodeTemplate> = {
  javascript: {
    language: 'javascript',
    description: 'JavaScript 基础模板',
    template: `function main(args) {
  const input = args.params.input;
  return {
    result: input
  };
}`,
  },
  python: {
    language: 'python',
    description: 'Python 基础模板',
    template: `def main(args: Args):
  import time
  time.sleep(3)
  return {'result': args.params['input']}`,
  },
}

/**
 * 获取指定语言的模板
 */
export function getCodeTemplate(language: string): CodeTemplate {
  return CODE_TEMPLATES[language] || CODE_TEMPLATES.javascript
}

/**
 * 获取所有可用语言模板
 */
export function getAvailableLanguages(): string[] {
  return Object.keys(CODE_TEMPLATES)
}

/**
 * 检查是否需要更新模板
 * 如果当前代码为空或者只包含空白字符，则提供新模板
 */
export function shouldUpdateTemplate(currentCode: string | undefined | null): boolean {
  if (!currentCode) return true
  // 确保转换为字符串后再调用 trim()
  return String(currentCode).trim().length === 0
}

/**
 * 检查当前代码是否是指定语言的模板
 */
export function isTemplateForLanguage(code: string, language: string): boolean {
  const template = getCodeTemplate(language)
  return template.template === code.trim()
}

/**
 * 生成带注释的新模板
 * 在模板顶部添加生成说明
 */
export function generateTemplateWithComment(language: string): string {
  const template = getCodeTemplate(language)
  const timestamp = new Date().toLocaleString('zh-CN')

  return `// 模板生成时间: ${timestamp}
// 语言: ${template.description}

${template.template}`
}
