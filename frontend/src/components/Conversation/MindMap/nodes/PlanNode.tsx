import React, { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { NodeData, NODE_DIMENSIONS, ThoughtNodeType } from '../types';
import { TaskStatus, Message, MessageType, useConversationStore } from '../../../../stores/useConversationStore';
import {
  ClockIcon,
  TaskCompletedIcon,
  LoadingIcon,
  FailedIcon,
  CancelIcon,
  StepWaitingIcon,
  StepCompletedIcon,
  StepInProgressIcon,
} from '../../utils/icon';
import { X, ChevronDown, ChevronRight as ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ReportMarkdown } from '@/pages/Apps/components/Markdown';

// 跑马灯动画样式 - 使用 #0a59f7
const marqueeStyle = document.createElement('style');
marqueeStyle.textContent = `
  @keyframes marquee {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
`;
if (!document.head.querySelector('style[data-marquee-animation]')) {
  marqueeStyle.setAttribute('data-marquee-animation', 'true');
  document.head.appendChild(marqueeStyle);
}

// 全局状态：当前打开的悬浮窗口的节点ID
let currentOpenPopupId: string | null = null;
const popupStateListeners: Set<(id: string | null) => void> = new Set();

function setCurrentOpenPopupId(id: string | null) {
  currentOpenPopupId = id;
  popupStateListeners.forEach(listener => listener(id));
}

interface PlanNodeProps {
  data: NodeData;
}

// ========== PLAN节点专用样式函数 ==========

/**
 * 获取网站的favicon URL
 * @returns favicon URL 或 🌐 emoji（作为备用图标）
 *
 * 备用服务：
 * - Google（国内不可用）: https://www.google.com/s2/favicons?domain=${domain}&sz=32
 * - DuckDuckGo: https://icons.duckduckgo.com/ip3/${domain}.ico
 * - Favicon Kit: https://api.faviconkit.com/${domain}/32
 * - Yandex（当前使用）: https://favicon.yandex.net/favicon/${domain}
 */
const getFaviconUrl = (url: string): string => {
  try {
    const domain = new URL(url).hostname;
    return `https://favicon.yandex.net/favicon/${domain}`;
  } catch {
    return '🌐';
  }
};

/**
 * 截断文本到指定长度
 */
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 2) + '...';
};

/**
 * 获取Plan图标
 */
function getPlanIcon(status?: TaskStatus): React.ReactElement {
  switch (status) {
    case TaskStatus.PENDING:
    case TaskStatus.DEFAULT:
      return <ClockIcon />;
    case TaskStatus.IN_PROGRESS:
    case TaskStatus.REPORTING:
      return <LoadingIcon />;
    case TaskStatus.COMPLETED:
    case TaskStatus.UNKNOWN:
      return <TaskCompletedIcon />;
    case TaskStatus.CANCELLED:
      return <CancelIcon />;
    case TaskStatus.FAILED:
      return <FailedIcon />;
    default:
      return <ClockIcon />;
  }
}

/**
 * 获取Plan状态描述文本
 */
function getPlanStatusText(status: TaskStatus, t: any): string {
  switch (status) {
    case TaskStatus.PENDING:
    case TaskStatus.DEFAULT:
      return t('apps.deepSearch.mindMapStatus.pending');
    case TaskStatus.IN_PROGRESS:
      return t('apps.deepSearch.mindMapStatus.inProgress');
    case TaskStatus.REPORTING:
      return t('apps.deepSearch.mindMapStatus.reporting');
    case TaskStatus.COMPLETED:
    case TaskStatus.UNKNOWN:
      return t('apps.deepSearch.mindMapStatus.completed');
    case TaskStatus.CANCELLED:
      return t('apps.deepSearch.mindMapStatus.cancelled');
    case TaskStatus.FAILED:
      return t('apps.deepSearch.mindMapStatus.failed');
    default:
      return t('apps.deepSearch.mindMapStatus.pending');
  }
}

/**
 * 获取状态描述颜色
 */
function getStatusDescriptionColor(status?: TaskStatus): string {
  switch (status) {
    case TaskStatus.PENDING:
    case TaskStatus.DEFAULT:
      return '#777777';
    case TaskStatus.IN_PROGRESS:
    case TaskStatus.REPORTING:
      return '#191919';
    case TaskStatus.COMPLETED:
    case TaskStatus.UNKNOWN:
      return '#191919';
    case TaskStatus.CANCELLED:
      return '#c9c9c9';
    case TaskStatus.FAILED:
      return '#e02128';
    default:
      return '#777777';
  }
}

/**
 * 获取Plan标题颜色
 */
function getPlanTitleColor(status?: TaskStatus): string {
  switch (status) {
    case TaskStatus.PENDING:
    case TaskStatus.DEFAULT:
      return '#777777';
    case TaskStatus.IN_PROGRESS:
    case TaskStatus.REPORTING:
    case TaskStatus.COMPLETED:
    case TaskStatus.UNKNOWN:
    case TaskStatus.CANCELLED:
      return '#191919';
    case TaskStatus.FAILED:
      return '#191919';
    default:
      return '#777777';
  }
}

/**
 * 获取Step图标
 */
function getStepIcon(status?: TaskStatus): React.ReactElement {
  switch (status) {
    case TaskStatus.PENDING:
    case TaskStatus.DEFAULT:
      return <StepWaitingIcon />;
    case TaskStatus.IN_PROGRESS:
    case TaskStatus.REPORTING:
      return <StepInProgressIcon />;
    case TaskStatus.COMPLETED:
    case TaskStatus.UNKNOWN:
      return <StepCompletedIcon />;
    case TaskStatus.CANCELLED:
      return <CancelIcon />;
    case TaskStatus.FAILED:
      return <FailedIcon />;
    default:
      return <StepWaitingIcon />;
  }
}

/**
 * 获取Step标题颜色
 */
function getStepTitleColor(status?: TaskStatus): string {
  switch (status) {
    case TaskStatus.PENDING:
    case TaskStatus.DEFAULT:
      return '#777777';
    case TaskStatus.IN_PROGRESS:
    case TaskStatus.REPORTING:
    case TaskStatus.COMPLETED:
    case TaskStatus.UNKNOWN:
      return '#191919';
    case TaskStatus.CANCELLED:
      return '#c9c9c9';
    case TaskStatus.FAILED:
      return '#e02128';
    default:
      return '#777777';
  }
}

/**
 * 判断是否需要跑马灯效果（仅在IN_PROGRESS或REPORTING状态时）
 */
function shouldUseMarquee(status?: TaskStatus): boolean {
  return status === TaskStatus.IN_PROGRESS || status === TaskStatus.REPORTING;
}

const PlanNode: React.FC<PlanNodeProps> = ({ data }) => {
  const { t } = useTranslation();
  const { title, status, message } = data;
  const getChildMessages = useConversationStore(state => state.getChildMessages);

  // 订阅 messagesMap 的变化以触发重新渲染
  // 使用 selector 来订阅相关的消息数据
  const messagesVersion = useConversationStore(state => {
    if (!message) return 0;
    // 订阅当前消息和其子消息的数据变化
    const currentMessage = state.messagesMap.get(message.id);
    if (!currentMessage?.childMessageIds) return 0;

    // 为每个子消息创建一个版本标识（基于关键属性）
    let version = state.messagesMap.size; // 整体 messagesMap 大小变化
    currentMessage.childMessageIds.forEach(childId => {
      const childMsg = state.messagesMap.get(childId);
      if (childMsg) {
        // 包含 status, title, content, childMessageIds 的变化
        version += childMsg.status?.length || 0;
        version += childMsg.title?.length || 0;
        version += (childMsg.childMessageIds?.length || 0);
      }
    });
    return version;
  });

  // 获取子步骤列表（使用 memo 避免不必要的重新计算）
  const subSteps: Message[] = React.useMemo(() => {
    return message ? getChildMessages(message.id) : [];
  }, [message, getChildMessages, messagesVersion]);

  const [isClicked, setIsClicked] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  // 使用全局状态来控制悬浮窗口
  const [showPopup, setShowPopup] = useState(false);
  // 悬浮窗口位置（左侧或右侧）
  const [popupPosition, setPopupPosition] = useState<'right' | 'left'>('right');

  // Refs for node and popup elements
  const nodeRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // 监听全局状态变化
  useEffect(() => {
    const handlePopupChange = (openId: string | null) => {
      // 如果打开的不是当前节点，关闭当前节点的悬浮窗口
      if (openId !== message?.id) {
        setShowPopup(false);
        setIsClicked(false);
      }
    };

    popupStateListeners.add(handlePopupChange);

    return () => {
      popupStateListeners.delete(handlePopupChange);
    };
  }, [message?.id]);

  // 点击外部关闭悬浮窗口
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showPopup && popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setShowPopup(false);
        setIsClicked(false);
        setCurrentOpenPopupId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPopup]);

  // 智能判断悬浮窗口位置
  useEffect(() => {
    if (showPopup && nodeRef.current) {
      const nodeRect = nodeRef.current.getBoundingClientRect();
      const spaceOnRight = window.innerWidth - nodeRect.right;
      const popupWidth = 484; // w-[460px] + ml-6 (24px) + buffer

      setPopupPosition(spaceOnRight >= popupWidth ? 'right' : 'left');
    }
  }, [showPopup]);

  // 获取悬浮窗口定位类名
  const getPositionClass = () => {
    return popupPosition === 'right'
      ? 'left-full top-0 ml-2'
      : 'right-full top-0 mr-2';
  };

  const displaySubTasks = subSteps.slice(0, 3);

  // Parse title to generate display format with i18n
  const getDisplayTitle = (title: string) => {
    const match = title?.match(/^(\d+)\.(\d+)\s*(.*)$/);
    if (match) {
      const sectionId = match[1];
      const planIndex = match[2];
      const customTitle = match[3].trim();
      return customTitle
        ? `${t('apps.deepSearch.informationCollection', { sectionId, planIndex })} ${customTitle}`.trim()
        : t('apps.deepSearch.informationCollection', { sectionId, planIndex });
    }
    return title;
  };

  const displayTitle = title ? getDisplayTitle(title) : t('apps.deepSearch.planNode', { defaultValue: '任务计划' });

  // 处理点击事件
  const handleClick = () => {
    const newShowPopup = !showPopup;
    setIsClicked(newShowPopup);
    setShowPopup(newShowPopup);

    // 更新全局状态
    if (newShowPopup) {
      setCurrentOpenPopupId(message?.id || null);
    } else {
      setCurrentOpenPopupId(null);
    }
  };

  // 处理鼠标悬停
  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  // 获取节点尺寸
  const nodeWidth = NODE_DIMENSIONS[ThoughtNodeType.PLAN].width;
  const nodeHeight = NODE_DIMENSIONS[ThoughtNodeType.PLAN].height;

  return (
    <div
      ref={nodeRef}
      className="relative cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        width: `${nodeWidth}px`,
        height: `${nodeHeight}px`,
        backgroundColor: isClicked ? 'rgb(245, 242, 250)' : '#ffffff',
        borderRadius: '12px',
        padding: '12px 16px',
        boxShadow: isClicked ? '0 2px 8px rgba(99, 102, 241, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
        border: (isHovered || isClicked) ? '2px solid #6366f1' : '1px solid transparent',
        transition: 'all 0.2s ease',
      }}
      onClick={handleClick}
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

      <div className="flex flex-col h-full" style={{ fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif' }}>
        {/* 第1行：plan图标 + 状态描述 */}
        <div className="flex items-center gap-2" style={{ height: '20px', fontSize: '12px', lineHeight: '20px' }}>
          {getPlanIcon(status)}
          <span style={{ color: getStatusDescriptionColor(status) }}>
            {getPlanStatusText(status!, t)}
          </span>
        </div>

        {/* 第2行：plan标题 */}
        <div
          className="font-bold truncate"
          style={{
            height: '22px',
            fontSize: '14px',
            lineHeight: '22px',
            color: getPlanTitleColor(status),
            fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
          }}
        >
          {displayTitle}
        </div>

        {/* 后面N行：steps展示 */}
        {displaySubTasks.length > 0 && (
          <div className="flex-1 relative" style={{ marginLeft: '0' }}>
            {/* 连接线 - 绝对定位的竖线 */}
            <div
              className="absolute"
              style={{
                left: '3px',
                top: '4px',
                bottom: '4px',
                width: '0.5px',
                backgroundColor: '#c9c9c9',
              }}
            ></div>

            {/* Step列表 */}
            <div className="flex flex-col gap-1" style={{ paddingLeft: '0' }}>
              {displaySubTasks.map((task, index) => {
                const taskTitle = task.title || `${t('apps.deepSearch.subTask', { defaultValue: '任务' })} ${index + 1}`;
                const stepTitleColor = getStepTitleColor(task.status);
                const useMarquee = shouldUseMarquee(task.status);

                return (
                  <div
                    key={task.id || index}
                    className="flex items-center gap-2"
                    style={{ height: '21px', fontSize: '12px', lineHeight: '21px' }}
                  >
                    {/* Step图标 */}
                    <div className="flex-shrink-0" style={{ marginLeft: '10px', marginRight: '2px' }}>
                      {getStepIcon(task.status)}
                    </div>

                    {/* Step标题 */}
                    <div
                      className="truncate flex-1"
                      style={{
                        fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
                        ...(useMarquee ? {
                          background: 'linear-gradient(90deg, rgba(10, 89, 247, 0.5) 0%, rgba(10, 89, 247, 1) 50%, rgba(10, 89, 247, 0.5) 100%)',
                          backgroundSize: '200% 100%',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          animation: 'marquee 2s linear infinite',
                        } : {
                          color: stepTitleColor,
                        }),
                      }}
                    >
                      {taskTitle}
                    </div>
                  </div>
                );
              })}
              {subSteps.length > 3 && (
                <div
                  className="flex items-center gap-2"
                  style={{ height: '21px', fontSize: '12px', lineHeight: '21px', marginLeft: '18px' }}
                >
                  <span className="text-gray-400">
                    +{subSteps.length - 3} {t('apps.deepSearch.more', { defaultValue: '更多...' })}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showPopup && subSteps.length > 0 && message && (
        <div ref={popupRef} className={`absolute z-[9999] ${getPositionClass()}`}>
          <PlanDetailPopup
            planMessage={message}
            getChildMessages={getChildMessages}
            onClose={() => {
              setShowPopup(false);
              setIsClicked(false);
              setCurrentOpenPopupId(null);
            }}
          />
        </div>
      )}
    </div>
  );
};

interface PlanDetailPopupProps {
  planMessage: Message;
  getChildMessages: (messageId: string) => Message[];
  onClose: () => void;
}

const PlanDetailPopup: React.FC<PlanDetailPopupProps> = ({
  planMessage,
  getChildMessages,
  onClose
}) => {
  const { t } = useTranslation();
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(0);
  const [isUrlExpanded, setIsUrlExpanded] = useState(false);

  // 订阅 messagesMap 的变化以触发重新渲染
  const messagesVersion = useConversationStore(state => {
    // 订阅 planMessage 的所有子消息及其孙消息的变化
    const subSteps = getChildMessages(planMessage.id);
    let version = state.messagesMap.size;

    subSteps.forEach(step => {
      // 订阅每个 step 的变化
      const stepMsg = state.messagesMap.get(step.id);
      if (stepMsg?.childMessageIds) {
        version += stepMsg.childMessageIds.length;
        // 订阅每个 step 的子消息（LINK 和 TEXT）
        stepMsg.childMessageIds.forEach(childId => {
          const childMsg = state.messagesMap.get(childId);
          if (childMsg) {
            version += childMsg.type?.length || 0;
            version += (childMsg.content as any)?.url?.length || 0;
            version += (childMsg.content as string)?.length || 0;
          }
        });
      }
    });

    return version;
  });

  // 获取子步骤列表（使用 memo 避免不必要的重新计算）
  const subSteps = React.useMemo(() => {
    return getChildMessages(planMessage.id);
  }, [planMessage.id, getChildMessages, messagesVersion]);

  // 处理子步骤标签点击
  const handleSubStepClick = (index: number) => {
    setSelectedTaskIndex(index);
    setIsUrlExpanded(false); // 切换子步骤时重置URL展开状态
  };

  if (subSteps.length === 0) {
    return null;
  }

  const selectedTask = subSteps[selectedTaskIndex];

  // 获取选中子步骤的子消息（URL和总结）- 使用 memo
  const selectedTaskChildren = React.useMemo(() => {
    return selectedTask ? getChildMessages(selectedTask.id) : [];
  }, [selectedTask, getChildMessages, messagesVersion]);

  // 分离LINK和TEXT类型的消息 - 使用 memo
  const { linkMessages, textMessages } = React.useMemo(() => {
    return {
      linkMessages: selectedTaskChildren.filter(m => m.type === MessageType.LINK),
      textMessages: selectedTaskChildren.filter(m => m.type === MessageType.TEXT),
    };
  }, [selectedTaskChildren]);

  // 最后一个TEXT消息作为总结 - 使用 memo
  const summaryMessage = React.useMemo(() => {
    return textMessages.length > 0 ? textMessages[textMessages.length - 1] : null;
  }, [textMessages]);

  // 限制子步骤标题长度为5个字
  const getTruncatedTitle = (title: string | undefined, index: number) => {
    if (!title) return `${t('apps.deepSearch.subTask', { defaultValue: '任务' })} ${index + 1}`;
    return title.length > 5 ? title.slice(0, 5) : title;
  };

  // 获取子步骤标题颜色
  const getSubStepTextColor = (status: TaskStatus, isSelected: boolean) => {
    if (status === TaskStatus.FAILED) return 'text-red-500';
    if (status === TaskStatus.CANCELLED) return 'text-yellow-600';
    return isSelected ? 'text-gray-900' : 'text-gray-600';
  };

  return (
    <div className="w-[460px] bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
      {/* 顶部：子步骤标签栏 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 overflow-x-auto">
        {subSteps.map((task, index) => {
          const isSelected = index === selectedTaskIndex;
          const taskTitle = getTruncatedTitle(task.title, index);

          return (
            <button
              key={task.id || index}
              onClick={(e) => {
                e.stopPropagation();
                handleSubStepClick(index);
              }}
              className={`
                px-2 py-1 rounded text-xs whitespace-nowrap transition-colors
                ${isSelected ? 'font-bold bg-blue-100' : 'hover:bg-gray-100'}
                ${getSubStepTextColor(task.status, isSelected)}
              `}
            >
              {taskTitle}
            </button>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* 中部：选中子步骤的详细信息 */}
      <div className="p-3 max-h-96 overflow-y-auto hover:overflow-y-auto">
        {/* 所选子步骤的标题 */}
        <h4 className="text-sm font-bold text-gray-900 mb-2">
          {selectedTask?.title || t('apps.deepSearch.subTaskDetail', { defaultValue: '子任务详情' })}
        </h4>

        {/* 所选子步骤的内容 */}
        {selectedTask?.content && typeof selectedTask.content === 'string' && (
          <div className="text-gray-700 mb-3" style={{ fontSize: '11px' }}>
            <ReportMarkdown
              content={selectedTask.content}
              className="prose prose-xs max-w-none prose-p:text-gray-700 prose-p:my-1 prose-headings:text-gray-900 prose-headings:my-2 prose-pre:overflow-x-auto prose-pre:max-w-full prose-p:text-xs prose-li:text-xs prose-h1:text-sm prose-h2:text-sm prose-h3:text-sm"
              instanceId={`plan-popup-${planMessage.id}-${selectedTaskIndex}`}
            />
          </div>
        )}

        {/* URL区域 */}
        {linkMessages.length > 0 && (
          <div className="mb-3 bg-gray-50 rounded-lg p-2" onClick={(e) => e.stopPropagation()}>
            {/* URL折叠头部 */}
            {!isUrlExpanded && (
              <div
                className="cursor-pointer hover:bg-gray-100 rounded p-1 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsUrlExpanded(!isUrlExpanded);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {(() => {
                      const firstLink = linkMessages[0]?.content as any;
                      const url = firstLink?.url || '';
                      const title = firstLink?.title || url;
                      const faviconUrl = getFaviconUrl(url);

                      return (
                        <>
                          {faviconUrl.startsWith('🌐') ? (
                            <span className="text-xs flex-shrink-0">{faviconUrl}</span>
                          ) : faviconUrl && (
                            <img
                              src={faviconUrl}
                              alt=""
                              className="w-3 h-3 flex-shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                          <span className="text-xs text-gray-700 truncate">
                            {truncateText(title, 30)}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {linkMessages.length > 1 && (
                      <span className="text-xs text-gray-400">
                        {t('apps.deepSearch.moreLinks', { count: linkMessages.length - 1, defaultValue: '+{{count}}篇' })}
                      </span>
                    )}
                    <ArrowRight className="w-3 h-3 text-gray-400" />
                  </div>
                </div>
              </div>
            )}

            {/* 展开的URL列表 - 卡片式布局 */}
            {isUrlExpanded && (
              <div className="space-y-1">
                <div
                  className="flex items-center gap-1 px-1 py-1 text-xs text-gray-500 cursor-pointer hover:bg-gray-200 rounded transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsUrlExpanded(false);
                  }}
                >
                  <ChevronDown className="w-3 h-3" />
                  <span>{t('apps.deepSearch.collapse', { defaultValue: '收起' })}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {linkMessages.map((linkMsg, index) => {
                    const linkContent = linkMsg.content as any;
                    const url = linkContent?.url || '';
                    const title = linkContent?.title || url;
                    const faviconUrl = getFaviconUrl(url);

                    return (
                      <a
                        key={linkMsg.id || index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full flex-shrink-0 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
                        title={title}
                      >
                        {faviconUrl.startsWith('🌐') ? (
                          <span className="text-xs flex-shrink-0">{faviconUrl}</span>
                        ) : (
                          <img
                            src={faviconUrl}
                            alt=""
                            className="w-3 h-3 flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                        <span className="text-xs text-gray-700 group-hover:text-blue-700 truncate max-w-[90px]">
                          {truncateText(title, 9)}
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 信息总结区域 */}
        {summaryMessage && summaryMessage.content && typeof summaryMessage.content === 'string' && (
          <div className="pt-2">
            <div className="text-gray-600" style={{ fontSize: '11px' }}>
              <ReportMarkdown
                content={summaryMessage.content}
                className="prose prose-xs max-w-none prose-p:text-gray-600 prose-p:my-1 prose-headings:text-gray-900 prose-headings:my-2 prose-pre:overflow-x-auto prose-pre:max-w-full prose-p:text-xs prose-li:text-xs prose-h1:text-sm prose-h2:text-sm prose-h3:text-sm"
                instanceId={`plan-popup-summary-${planMessage.id}`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(PlanNode);