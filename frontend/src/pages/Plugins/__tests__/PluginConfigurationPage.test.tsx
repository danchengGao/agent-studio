import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PluginConfigurationPage from '../PluginConfigurationPage'
import { PluginService } from '@test-agentstudio/api-client'

// Mock the PluginService
jest.mock('@test-agentstudio/api-client', () => ({
  PluginService: {
    getPlugin: jest.fn(),
  },
}))

// Mock the auth store
jest.mock('../../stores/useAuthStore', () => ({
  useAuthStore: () => ({
    user: { spaceId: 'test-space-id' },
  }),
}))

// Mock the environment config
jest.mock('../../config/environment', () => ({
  ENV_CONFIG: {
    DEFAULT_SPACE_ID: 'default-space-id',
  },
}))

describe('PluginConfigurationPage', () => {
  const mockPluginData = {
    code: 200,
    data: {
      plugin_info: {
        name: 'Test Plugin',
        desc: 'Test plugin description',
        plugin_type: 1,
        published: true,
        icon_uri: '⚙️',
      },
    },
  }

  beforeEach(() => {
    ;(PluginService.getPlugin as jest.Mock).mockResolvedValue(mockPluginData)
  })

  it('renders loading state initially', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/plugins/test-plugin-id']}>
        <Routes>
          <Route path="/dashboard/plugins/:plugin_id" element={<PluginConfigurationPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('正在加载插件配置...')).toBeInTheDocument()
  })

  it('renders plugin information after loading', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/plugins/test-plugin-id']}>
        <Routes>
          <Route path="/dashboard/plugins/:plugin_id" element={<PluginConfigurationPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Test Plugin')).toBeInTheDocument()
      expect(screen.getByText('云侧插件')).toBeInTheDocument()
      expect(screen.getByText('基本信息')).toBeInTheDocument()
      expect(screen.getByText('配置选项')).toBeInTheDocument()
      expect(screen.getByText('API 配置')).toBeInTheDocument()
      expect(screen.getByText('连接测试')).toBeInTheDocument()
    })
  })

  it('navigates back to plugin management when back button is clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/plugins/test-plugin-id']}>
        <Routes>
          <Route path="/dashboard/plugins/:plugin_id" element={<PluginConfigurationPage />} />
          <Route path="/dashboard/plugins" element={<div>Plugin Management Page</div>} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      const backButton = screen.getByText('返回插件管理')
      expect(backButton).toBeInTheDocument()

      fireEvent.click(backButton)
      expect(screen.getByText('Plugin Management Page')).toBeInTheDocument()
    })
  })

  it('shows save confirmation dialog when save is clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/plugins/test-plugin-id']}>
        <Routes>
          <Route path="/dashboard/plugins/:plugin_id" element={<PluginConfigurationPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      const saveButton = screen.getByText('保存配置')
      expect(saveButton).toBeInTheDocument()

      fireEvent.click(saveButton)
      expect(screen.getByText('确认保存')).toBeInTheDocument()
    })
  })

  it('shows plugin not found when plugin_id is invalid', async () => {
    ;(PluginService.getPlugin as jest.Mock).mockRejectedValue(new Error('Plugin not found'))

    render(
      <MemoryRouter initialEntries={['/dashboard/plugins/invalid-plugin-id']}>
        <Routes>
          <Route path="/dashboard/plugins/:plugin_id" element={<PluginConfigurationPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('插件未找到')).toBeInTheDocument()
      expect(screen.getByText('请检查插件ID是否正确')).toBeInTheDocument()
    })
  })
})
