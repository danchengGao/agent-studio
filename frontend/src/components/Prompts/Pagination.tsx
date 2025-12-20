import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalCount: number
  pageSize: number
  loading?: boolean
  error?: string | null
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  pageSizeOptions?: number[]
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalCount,
  pageSize,
  loading = false,
  error = null,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
}) => {
  const { t } = useTranslation()

  // 计算总页数
  const totalPages = Math.ceil(totalCount / pageSize)

  // 处理页码输入变化
  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const page = parseInt(e.target.value)
    if (page >= 1 && page <= totalPages) {
      onPageChange(page)
    }
  }

  // 处理页码输入键盘事件
  const handlePageInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
  }

  // 如果正在加载或有错误，不显示分页
  if (loading || error) {
    return null
  }

  return (
    <div className="flex items-center justify-end mt-8 space-x-6">
      {/* 每页条数选择器 */}
      <div className="flex items-center space-x-2">
        <span className="text-sm text-gray-700">{t('common.pagination.pageSize')}</span>
        <select
          value={pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
          className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {(pageSizeOptions && pageSizeOptions.length > 0 ? pageSizeOptions : [10, 20, 30, 40, 50]).map(opt => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-700">{t('common.pagination.items')}</span>
      </div>

      {/* 分页信息和控制 */}
      {totalCount > 0 && (
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-700">{t('common.pagination.total', { total: totalCount })}</span>
          <div className="flex items-center space-x-1">
            {/* 首页 */}
            <button
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="p-2 text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title={t('common.pagination.first')}
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            {/* 上一页 */}
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title={t('common.pagination.previous')}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* 页码显示 */}
            <div className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700">
              <span>第</span>
              <input
                type="number"
                value={currentPage}
                onChange={handlePageInputChange}
                onKeyPress={handlePageInputKeyPress}
                min={1}
                max={totalPages}
                className="w-12 px-2 py-1 text-center text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span>/ {totalPages} 页</span>
            </div>

            {/* 下一页 */}
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="p-2 text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title={t('common.pagination.next')}
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* 末页 */}
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage >= totalPages}
              className="p-2 text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title={t('common.pagination.last')}
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Pagination
