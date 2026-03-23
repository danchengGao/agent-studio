import React, { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { NodeData, NODE_DIMENSIONS, ThoughtNodeType } from '../types';
import { TaskStatus } from '../../../../stores/useConversationStore';
import { useConversationStore } from '../../../../stores/useConversationStore';
import {
  ReportWaitingIcon,
  ReportInProgressIcon,
  ReportCompletedIcon,
  ReportFailedIcon,
  ReportCancelledIcon,
} from '../../utils/icon';
import aiIconSvg from '@/assets/icons/ai-icon.svg';
import dayjs from 'dayjs';

const FinalReportNode: React.FC<{ data: NodeData }> = ({ data }) => {
  const { t } = useTranslation();
  const { status, message, messageId, onNodeClick } = data;
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 获取 store 中的方法
  const getMessageById = useConversationStore(state => state.getMessageById);
  const getMessageItemsById = useConversationStore(state => state.getMessageItemsById);

  // 判断是否有内容：与 DeepSearchReportCard 的逻辑保持一致
  const hasContent = message && (
    (typeof message.content === 'string' && message.content.trim() !== '') ||
    (typeof message.content === 'object' && message.content !== null)
  );

  // 可点击条件：有内容就可以点击（与左侧聊天框保持一致）
  const isClickable = hasContent;

  // 是否显示上部分：只在 COMPLETE 和 UNKNOWN 状态显示
  const showTopSection = status === TaskStatus.COMPLETED || status === TaskStatus.UNKNOWN;

  // 获取显示的标题：从本报告 message 所属的 messageItems 的 messagesIds 中找到 type=task 的 message 的 title
  const getDisplayTitle = () => {
    if (!message) return t('apps.deepSearch.finalReport');

    // 获取本报告 message 所属的 messageItems
    const messageItems = getMessageItemsById(message.messageItemsId);
    if (!messageItems || !messageItems.messagesIds || messageItems.messagesIds.length === 0) {
      return t('apps.deepSearch.finalReport');
    }

    // 遍历 messageItems.messagesIds，找到第一个 type=task 的 message
    for (const msgId of messageItems.messagesIds) {
      const msg = getMessageById(msgId);
      if (msg && msg.type === 'task' && msg.title) {
        return msg.title;
      }
    }

    // 如果没找到，返回默认值
    return t('apps.deepSearch.finalReport');
  };

  const displayTitle = getDisplayTitle();

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

  // 根据状态获取图标和文字配置
  const getStatusConfig = () => {
    switch (status) {
      case TaskStatus.PENDING:
      case TaskStatus.DEFAULT:
        return {
          icon: <ReportWaitingIcon />,
          titleColor: '#aeaeae',
          descriptionColor: '#aeaeae',
          description: t('apps.deepSearch.mindMap.finalReport.waitingForWriting'),
          titleAnimated: false,
        };
      case TaskStatus.IN_PROGRESS:
      case TaskStatus.REPORTING:
        return {
          icon: <ReportInProgressIcon />,
          titleColor: 'animated-gradient',
          descriptionColor: '#777777',
          description: t('apps.deepSearch.mindMap.finalReport.writingInProgress'),
          titleAnimated: true,
        };
      case TaskStatus.COMPLETED:
      case TaskStatus.UNKNOWN:
        return {
          icon: <ReportCompletedIcon />,
          titleColor: '#191919',
          descriptionColor: '#777777',
          description: t('apps.deepSearch.mindMap.finalReport.writingCompleted', {
            time: message?.createdAt ? dayjs(message.createdAt).format('YYYY/MM/DD HH:mm:ss') : '--'
          }),
          titleAnimated: false,
        };
      case TaskStatus.FAILED:
        return {
          icon: <ReportFailedIcon />,
          titleColor: '#777777',
          descriptionColor: '#777777',
          description: t('apps.deepSearch.mindMap.finalReport.writingException'),
          titleAnimated: false,
        };
      case TaskStatus.CANCELLED:
        return {
          icon: <ReportCancelledIcon />,
          titleColor: '#c9c9c9',
          descriptionColor: '#c9c9c9',
          description: t('apps.deepSearch.mindMap.finalReport.cancelled'),
          titleAnimated: false,
        };
      default:
        return {
          icon: <ReportWaitingIcon />,
          titleColor: '#aeaeae',
          descriptionColor: '#aeaeae',
          description: t('apps.deepSearch.mindMap.finalReport.waitingForWriting'),
          titleAnimated: false,
        };
    }
  };

  const { icon, titleColor, descriptionColor, description, titleAnimated } = getStatusConfig();

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        relative rounded-lg
        transition-all duration-200
        ${isClickable ? 'cursor-pointer' : 'cursor-default'}
      `}
      style={{
        width: `${NODE_DIMENSIONS[ThoughtNodeType.FINAL_REPORT].width}px`,
        // 如果显示上部分，总高度是 48 + 80 = 128px；否则只有 80px
        height: showTopSection
          ? `${NODE_DIMENSIONS[ThoughtNodeType.FINAL_REPORT].height}px`
          : '80px',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        border: '2px solid transparent',
        display: 'flex',
        flexDirection: 'column',
        // 确保内部元素不超出圆角边界，保证边框完整显示
        overflow: 'hidden',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-blue-400 !border-2 !border-white"
      />

      {/* 上部分 - 研究完成标识（只在 COMPLETE 和 UNKNOWN 状态显示） */}
      {showTopSection && (
        <div
          style={{
            height: '48px',
            backgroundColor: '#e6eeff',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: '12px',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px',
            borderBottomLeftRadius: '0px',
            borderBottomRightRadius: '0px',
          }}
        >
          {/* AI icon */}
          <img
            src={aiIconSvg}
            alt="AI"
            style={{
              width: '12px',
              height: '12px',
              opacity: 1,
              marginRight: '6px',
            }}
          />
          {/* 研究完成文字 - 线性渐变色 */}
          <span
            style={{
              fontFamily: 'HarmonyHeiTi, sans-serif',
              fontWeight: 'bold',
              fontSize: '14px',
              lineHeight: '24px',
              // 线性渐变：从 #1A56F8 平滑过渡到 #9628FF
              background: 'linear-gradient(90deg, #1A56F8 0%, #9628FF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {t('apps.deepSearch.mindMap.researchCompleted')}
          </span>
        </div>
      )}

      {/* 下部分 - 主要内容 */}
      <div
        style={{
          flex: 1,
          // 失败状态时底色不变（保持白色），其他状态悬停时变色
          backgroundColor: (showTopSection && isHovered) ? 'rgb(245, 242, 250)' : '#ffffff',
          // 如果没有上部分，下部分是完整的圆角；否则只有底部圆角
          borderBottomLeftRadius: showTopSection ? '0px' : '12px',
          borderBottomRightRadius: showTopSection ? '0px' : '12px',
          borderTopLeftRadius: showTopSection ? '0px' : '12px',
          borderTopRightRadius: showTopSection ? '0px' : '12px',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '12px',
          paddingRight: '12px',
          transition: 'background-color 0.2s',
          minHeight: '80px',
        }}
      >
        {/* 左边图标 */}
        <div style={{ flexShrink: 0, marginRight: '8px' }}>
          {icon}
        </div>

        {/* 右边文字区域 */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            minWidth: 0,
          }}
        >
          {/* 标题 */}
          <div
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "San Francisco", "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
              fontWeight: 'bold',
              fontSize: '14px',
              lineHeight: '22px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              width: '100%',
            }}
          >
            {titleAnimated ? (
              <span
                style={{
                  // 跑马灯效果：背景渐变 + 动画
                  background: 'linear-gradient(90deg, #1A56F8, #9628FF, #1A56F8)',
                  backgroundSize: '200% 100%',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  animation: 'marquee 3s linear infinite',
                }}
              >
                {displayTitle}
              </span>
            ) : (
              <span style={{ color: titleColor }}>
                {displayTitle}
              </span>
            )}
          </div>

          {/* 状态描述 */}
          <div
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "San Francisco", "Helvetica Neue", "PingFang SC", sans-serif',
              fontSize: '12px',
              lineHeight: '20px',
              color: descriptionColor,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              width: '100%',
            }}
          >
            {description}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 200% 50%;
          }
        }
      `}</style>
    </div>
  );
};

export default memo(FinalReportNode);
