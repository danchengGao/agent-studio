import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MuiPagination from '@mui/material/Pagination';

export interface PagerState {
  total: number;
  currentPage: number;
  pageSize: number;
  pageSizeOptions?: number[];
}

export type PagerChangeHandler = (page: number, pageSize: number) => void;

interface PaginationProps {
  pager: PagerState;
  loading?: boolean;
  error?: string | null;
  onPagerChange: PagerChangeHandler;
}

const Pagination: React.FC<PaginationProps> = ({ pager, loading = false, error = null, onPagerChange }) => {
  const { t } = useTranslation();
  const { currentPage, total, pageSize, pageSizeOptions } = pager;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [jumpPage, setJumpPage] = useState(String(currentPage));

  useEffect(() => {
    setJumpPage(String(currentPage));
  }, [currentPage]);

  const handleGoToPage = () => {
    const parsedPage = Number(jumpPage);
    if (Number.isNaN(parsedPage)) {
      setJumpPage(String(currentPage));
      return;
    }

    const targetPage = Math.min(totalPages, Math.max(1, Math.floor(parsedPage)));
    onPagerChange(targetPage, pageSize);
    setJumpPage(String(targetPage));
  };

  const handleJumpInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleGoToPage();
    }
  };

  if (loading || error) {
    return null;
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <span className="text-sm text-gray-700">{t('common.pagination.total', { total })}</span>
      <div className="flex items-center gap-2">
        <select
          value={pageSize}
          onChange={e => onPagerChange(1, Number(e.target.value))}
          className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {(pageSizeOptions && pageSizeOptions.length > 0 ? pageSizeOptions : [10, 20, 30, 40, 50]).map(opt => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-700">{t('common.pagination.itemsPerPage')}</span>
      </div>
      <MuiPagination
        count={totalPages}
        page={Math.min(currentPage, totalPages)}
        shape="rounded"
        onChange={(_, page) => onPagerChange(page, pageSize)}
      />
      <input
        type="number"
        value={jumpPage}
        onChange={e => setJumpPage(e.target.value)}
        onKeyDown={handleJumpInputKeyDown}
        min={1}
        max={totalPages}
        className="w-16 px-2 py-1 text-center text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <button
        onClick={handleGoToPage}
        className="px-3 py-1 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
      >
        Go
      </button>
    </div>
  );
};

export default Pagination;
