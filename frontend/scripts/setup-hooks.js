#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up Git hooks...');

try {
  // 获取项目根目录（frontend目录的上一级）
  const projectRoot = path.resolve(__dirname, '..');
  const gitHooksDir = path.join(projectRoot, '..', '.git', 'hooks');

  console.log('📍 Project root:', projectRoot);
  console.log('📍 Git hooks directory:', gitHooksDir);

  // 确保 .git/hooks 目录存在
  if (!fs.existsSync(gitHooksDir)) {
    fs.mkdirSync(gitHooksDir, { recursive: true });
    console.log('📁 Created hooks directory');
  }

  // pre-commit hook 内容
  const preCommitContent = `#!/bin/bash

cd frontend
echo "🔍 Running pre-commit hooks..."
echo "📝 Running lint-staged..."
npx lint-staged

if [ $? -ne 0 ]; then
    echo "❌ Lint-staged failed. Please fix the issues and try again."
    exit 1
fi

echo "✅ Pre-commit hooks passed!"
`;

  // 写入 pre-commit hook
  const preCommitPath = path.join(gitHooksDir, 'pre-commit');
  console.log('📝 Writing hook to:', preCommitPath);
  fs.writeFileSync(preCommitPath, preCommitContent);

  // 设置执行权限（跨平台兼容）
  try {
    fs.chmodSync(preCommitPath, '755');
    console.log('🔐 Set executable permissions');
  } catch (error) {
    console.log('⚠️  Could not set executable permissions automatically');
  }

  console.log('✅ Git hooks installed successfully!');
} catch (error) {
  console.error('❌ Failed to set up Git hooks:', error.message);
  // 不退出进程，让 npm install 继续执行
}
