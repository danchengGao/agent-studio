import React, { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { NodeData, NODE_DIMENSIONS, ThoughtNodeType } from '../types';
import { TaskStatus } from '../../../../stores/useConversationStore';
import {
  ClockIcon,
  LoadingIcon,
  WordTagIcon,
  FailedIcon,
  CancelIcon,
} from '../../utils/icon';

const SubReportNode: React.FC<{ data: NodeData }> = ({ data }) => {
  const { title, status, messageId, onNodeClick } = data;
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 判断是否有内容：与聊天框保持一致
  const hasContent = data.message && (
    (typeof data.message.content === 'string' && data.message.content.trim() !== '') ||
    (typeof data.message.content === 'object' && data.message.content !== null)
  );

  // 可点击条件：有内容就可以点击
  const isClickable = hasContent;

  // 处理节点点击
  const handleClick = () => {
    if (isClickable && onNodeClick && messageId) {
      onNodeClick(messageId);
    }
  };

  // 处理鼠标悬停
  const handleMouseEnter = () => {
    setIsHovered(true);
    if (containerRef.current) {
      // 失败状态使用红色边框，其他状态使用紫色边框
      const borderColor = status === TaskStatus.FAILED ? '#e02128' : '#6366f1';
      containerRef.current.style.borderColor = borderColor;
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (containerRef.current) {
      containerRef.current.style.borderColor = 'transparent';
    }
  };

  // 根据状态获取图标和颜色
  const getStatusConfig = () => {
    switch (status) {
      case TaskStatus.PENDING:
      case TaskStatus.DEFAULT:
        return { icon: <ClockIcon />, color: '#777777' };
      case TaskStatus.IN_PROGRESS:
      case TaskStatus.REPORTING:
        return { icon: <LoadingIcon />, color: '#191919' };
      case TaskStatus.COMPLETED:
      case TaskStatus.UNKNOWN:
        return { icon: <WordTagIcon />, color: '#191919' };
      case TaskStatus.FAILED:
        return { icon: <FailedIcon />, color: '#e02128' };
      case TaskStatus.CANCELLED:
        return { icon: <CancelIcon />, color: '#c9c9c9' };
      default:
        return { icon: <ClockIcon />, color: '#777777' };
    }
  };

  const { icon, color } = getStatusConfig();

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        relative flex items-center px-3
        transition-all duration-200
        ${isClickable ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default'}
      `}
      style={{
        width: `${NODE_DIMENSIONS[ThoughtNodeType.SUB_REPORT].width}px`,
        height: `${NODE_DIMENSIONS[ThoughtNodeType.SUB_REPORT].height}px`,
        // 失败状态时底色不变（保持白色），其他状态悬停时变色
        backgroundColor: (isHovered && status !== TaskStatus.FAILED) ? 'rgb(245, 242, 250)' : '#FFFFFF',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        border: '2px solid transparent',
        transition: 'background-color 0.2s, border-color 0.2s',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-blue-400 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-blue-400 !border-2 !border-white"
      />

      {/* Icon + 《标题 */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* 图标 */}
        <div className="flex-shrink-0">
          {icon}
        </div>

        {/* 《标题 */}
        <div
          className="flex items-center gap-1 min-w-0"
          style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "San Francisco", "Helvetica Neue", sans-serif',
            fontSize: '14px',
            lineHeight: '22px',
            color: color,
          }}
        >
          {/* 《 - 不换行 */}
          <span className="flex-shrink-0">《</span>

          {/* 标题 - 超长省略 */}
          <span className="truncate">
            {title || '章节报告'}
          </span>

          {/* 》 - 不换行 */}
          <span className="flex-shrink-0">》</span>
        </div>
      </div>
    </div>
  );
};

export default memo(SubReportNode);