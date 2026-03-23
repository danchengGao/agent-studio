import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { NodeData, getNodeWidth, getNodeHeight, ThoughtNodeType } from '../types';
import { TaskStatus } from '../../../../stores/useConversationStore';
import { useTranslation } from 'react-i18next';
import {
  StepCompletedIcon,
  LoadingIcon,
  ClockIcon,
  CancelIcon,
  FailedIcon,
} from '../../utils/icon';

interface SectionNodeProps {
  data: NodeData;
}

const SectionNode: React.FC<SectionNodeProps> = ({ data }) => {
  const { t } = useTranslation();
  const { title, content, status } = data;

  // 根据状态获取图标和状态描述
  const getStatusInfo = () => {
    switch (status) {
      case TaskStatus.COMPLETED:
      case TaskStatus.UNKNOWN:
        return {
          icon: <StepCompletedIcon />,
          statusText: t('apps.deepSearch.mindMapStatus.completed'),
        };
      case TaskStatus.IN_PROGRESS:
        return {
          icon: <LoadingIcon />,
          statusText: t('apps.deepSearch.mindMapStatus.inProgress'),
        };
      case TaskStatus.REPORTING:
        return {
          icon: <LoadingIcon />,
          statusText: t('apps.deepSearch.mindMapStatus.reporting'),
        };
      case TaskStatus.PENDING:
      case TaskStatus.DEFAULT:
        return {
          icon: <ClockIcon />,
          statusText: t('apps.deepSearch.mindMapStatus.pending'),
        };
      case TaskStatus.CANCELLED:
        return {
          icon: <CancelIcon />,
          statusText: t('apps.deepSearch.mindMapStatus.cancelled'),
        };
      case TaskStatus.FAILED:
        return {
          icon: <FailedIcon />,
          statusText: t('apps.deepSearch.mindMapStatus.failed'),
        };
      default:
        return {
          icon: <ClockIcon />,
          statusText: t('apps.deepSearch.mindMapStatus.default'),
        };
    }
  };

  // 根据状态获取颜色和背景
  const getStatusColors = () => {
    switch (status) {
      case TaskStatus.COMPLETED:
      case TaskStatus.UNKNOWN:
      case TaskStatus.IN_PROGRESS:
      case TaskStatus.REPORTING:
        return {
          statusColor: '#191919',
          titleColor: '#191919',
          contentColor: '#777777',
          backgroundColor: '#ffffff',
          backgroundImage: 'radial-gradient(circle at 100% 0%, rgba(94, 25, 255, 0.06) 0%, transparent 50%), radial-gradient(circle at 50% 0%, rgba(38, 62, 255, 0.09) 0%, transparent 50%), radial-gradient(circle at 0% 0%, rgba(11, 103, 255, 0.09) 0%, transparent 50%)',
        };
      case TaskStatus.PENDING:
      case TaskStatus.DEFAULT:
        return {
          statusColor: '#777777',
          titleColor: '#777777',
          contentColor: '#777777',
          backgroundColor: '#ffffff',
        };
      case TaskStatus.CANCELLED:
        return {
          statusColor: '#c9c9c9',
          titleColor: '#c9c9c9',
          contentColor: '#c9c9c9',
          backgroundColor: '#ffffff',
        };
      case TaskStatus.FAILED:
        return {
          statusColor: '#e02128',
          titleColor: '#777777',
          contentColor: '#777777',
          backgroundColor: '#fee7e8',
        };
      default:
        return {
          statusColor: '#777777',
          titleColor: '#777777',
          contentColor: '#777777',
          backgroundColor: '#ffffff',
        };
    }
  };

  const { icon, statusText } = getStatusInfo();
  const { statusColor, titleColor, contentColor, backgroundColor, backgroundImage } = getStatusColors();

  // 根据状态确定悬停边框颜色
  const getHoverBorderColor = () => {
    if (status === TaskStatus.FAILED) {
      return 'hover:border-red-300';
    }
    return 'hover:border-blue-200';
  };

  return (
    <div
      className={`relative rounded-[12px] p-5 border border-transparent ${getHoverBorderColor()} transition-all duration-200`}
      style={{
        width: getNodeWidth(ThoughtNodeType.SECTION),
        height: getNodeHeight(ThoughtNodeType.SECTION),
        backgroundColor: backgroundColor,
        backgroundImage: backgroundImage,
        boxShadow: '0px 5px 45px -10px #00000019',
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

      {/* 内容区域 - 基于节点尺寸减去padding */}
      <div
        className="flex flex-col"
        style={{
          width: getNodeWidth(ThoughtNodeType.SECTION) - 40, // 360 - 40 = 320
          height: getNodeHeight(ThoughtNodeType.SECTION) - 40, // 160 - 40 = 120
        }}
      >
        {/* 第1行：icon + 状态描述 */}
        <div className="flex items-center gap-1" style={{ height: '20px' }}>
          {icon}
          <span
            style={{
              fontFamily: 'Sans Sc',
              fontSize: '12px',
              lineHeight: '20px',
              color: statusColor,
            }}
          >
            {statusText}
          </span>
        </div>

        {/* 第2行：标题 */}
        <div style={{ height: '24px' }}>
          <h3
            style={{
              fontFamily: 'HeiTi',
              fontWeight: 'bold',
              fontSize: '14px',
              lineHeight: '24px',
              color: titleColor,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title || '章节'}
          </h3>
        </div>

        {/* 第3行：内容 */}
        <div
          className="flex-1"
          style={{
            fontSize: '12px',
            lineHeight: '20px',
            color: contentColor,
            fontFamily: 'Sans Sc',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            textOverflow: 'ellipsis',
          }}
        >
          {content}
        </div>
      </div>
    </div>
  );
};

export default memo(SectionNode);