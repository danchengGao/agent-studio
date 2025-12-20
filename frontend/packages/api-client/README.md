# @test-agentstudio/api-client

通用 API 客户端包，提供 RESTful 接口和 React Query hooks。

## 功能特性

- 🚀 基于 Axios 的 HTTP 客户端
- ⚡ React Query hooks 集成
- 🔄 自动缓存管理
- 🛡️ 类型安全的 TypeScript 支持
- 🔧 灵活的配置选项
- 📦 模块化设计

## 安装

```bash
npm install @test-agentstudio/api-client
```

## 快速开始

### 1. 基础使用

```tsx
import { apiRequest, API_CONFIG } from '@test-agentstudio/api-client'

// 配置 API 基础 URL
API_CONFIG.BASE_URL = 'https://api.example.com'

// 发送请求
const data = await apiRequest.get('/users')
```

### 2. 使用 React Query Hooks

```tsx
import { useModels, useCreateModel } from '@test-agentstudio/api-client'

function ModelsPage() {
  const { data: models, isLoading, error } = useModels()
  const createModel = useCreateModel()

  const handleCreate = async (modelData) => {
    await createModel.mutateAsync(modelData)
  }

  if (isLoading) return <div>加载中...</div>
  if (error) return <div>错误: {error.message}</div>

  return (
    <div>
      {models?.map(model => (
        <div key={model.id}>{model.name}</div>
      ))}
    </div>
  )
}
```

### 3. 配置认证

```tsx
import { createApiClientInstance } from '@test-agentstudio/api-client'

// 创建带认证的客户端
const apiClient = createApiClientInstance(
  () => localStorage.getItem('token'), // token 提供者
  {
    logout: () => {
      localStorage.removeItem('token')
      // 处理登出逻辑
    },
    updateToken: (token) => {
      localStorage.setItem('token', token)
    }
  }
)
```

## API 参考

### 核心客户端

#### `apiRequest`

通用的 HTTP 请求方法：

```tsx
import { apiRequest } from '@test-agentstudio/api-client'

// GET 请求
const users = await apiRequest.get('/users')

// POST 请求
const newUser = await apiRequest.post('/users', { name: 'John' })

// PUT 请求
const updatedUser = await apiRequest.put('/users/1', { name: 'Jane' })

// DELETE 请求
await apiRequest.delete('/users/1')

// 文件上传
const formData = new FormData()
formData.append('file', file)
await apiRequest.upload('/upload', formData)

// 文件下载
await apiRequest.download('/files/1', 'filename.pdf')
```

#### `apiUtils`

工具函数：

```tsx
import { apiUtils } from '@test-agentstudio/api-client'

// 构建查询字符串
const queryString = apiUtils.buildQueryString({ page: 1, size: 20 })

// 替换 URL 参数
const url = apiUtils.replaceUrlParams('/users/:id', { id: '123' })

// 重试请求
const result = await apiUtils.retry(() => apiRequest.get('/data'))
```

### React Query Hooks

#### 工作流相关

```tsx
import {
  useWorkflowsFrom,
  useCreateWorkflow,
  useWorkflowCanvas,
  useSaveWorkflow
} from '@test-agentstudio/api-client'

// 获取工作流列表
const { data: workflows } = useWorkflowsFrom({ space_id: 'space-1' })

// 创建工作流
const createWorkflow = useCreateWorkflow()

// 获取工作流画布
const { data: canvas } = useWorkflowCanvas({
  workflow_id: 'workflow-1',
  space_id: 'space-1'
})

// 保存工作流
const saveWorkflow = useSaveWorkflow()
```

#### 模型相关

```tsx
import {
  useModels,
  useCreateModel,
  useUpdateModel,
  useDeleteModel,
  useTestModel
} from '@test-agentstudio/api-client'

// 获取模型列表
const { data: models } = useModels()

// 创建模型
const createModel = useCreateModel()

// 更新模型
const updateModel = useUpdateModel()

// 删除模型
const deleteModel = useDeleteModel()

// 测试模型
const testModel = useTestModel()
```

### 配置选项

#### `API_CONFIG`

```tsx
import { API_CONFIG } from '@test-agentstudio/api-client'

API_CONFIG.BASE_URL = 'https://api.example.com'
API_CONFIG.TIMEOUT = 30000
API_CONFIG.MAX_RETRIES = 3
API_CONFIG.RETRY_DELAY = 1000
```

#### `API_ENDPOINTS`

预定义的 API 端点：

```tsx
import { API_ENDPOINTS } from '@test-agentstudio/api-client'

// 工作流端点
API_ENDPOINTS.WORKFLOWS.LIST
API_ENDPOINTS.WORKFLOWS.CREATE
API_ENDPOINTS.WORKFLOWS.CANVAS
API_ENDPOINTS.WORKFLOWS.SAVE

// 模型端点
API_ENDPOINTS.MODELS.LIST
API_ENDPOINTS.MODELS.CREATE
API_ENDPOINTS.MODELS.TEST
```

## 类型定义

包提供了完整的 TypeScript 类型定义：

```tsx
import type {
  Workflow,
  WorkflowListRequest,
  CreateWorkflowRequest,
  FrontendModelConfig,
  ModelProvider
} from '@test-agentstudio/api-client'
```

## 错误处理

所有请求都包含统一的错误处理：

```tsx
import { ERROR_TYPES } from '@test-agentstudio/api-client'

try {
  const data = await apiRequest.get('/data')
} catch (error) {
  if (error.type === ERROR_TYPES.AUTH) {
    // 处理认证错误
  } else if (error.type === ERROR_TYPES.NETWORK) {
    // 处理网络错误
  }
}
```

## 开发

### 构建

```bash
npm run build
```

### 开发模式

```bash
npm run dev
```

### 类型检查

```bash
npm run type-check
```

## 许可证

MIT
