import React from 'react';
import { useTranslation } from 'react-i18next';
import { TaskStatus } from '../../../../stores/useConversationStore';
import { Clock, Loader2, CheckCircle, XCircle, Ban, HelpCircle, FileText } from 'lucide-react';

interface StatusIndicatorProps {
  status?: TaskStatus;
  showText?: boolean;
  size?: 'sm' | 'md';
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  showText = true,
  size = 'sm',
}) => {
  const { t } = useTranslation();

  const statusConfig: Record<TaskStatus, { icon: typeof Clock; text: string; iconClass: string; textClass: string }> = {
    [TaskStatus.PENDING]: {
      icon: Clock,
      text: t('apps.deepSearch.mindMapStatus.pending'),
      iconClass: 'text-gray-400',
      textClass: 'text-gray-400',
    },
    [TaskStatus.IN_PROGRESS]: {
      icon: Loader2,
      text: t('apps.deepSearch.mindMapStatus.inProgress'),
      iconClass: 'text-blue-500 animate-spin',
      textClass: 'text-blue-600',
    },
    [TaskStatus.REPORTING]: {
      icon: FileText,
      text: t('apps.deepSearch.mindMapStatus.reporting'),
      iconClass: 'text-purple-500 animate-bounce',
      textClass: 'text-purple-600',
    },
    [TaskStatus.COMPLETED]: {
      icon: CheckCircle,
      text: t('apps.deepSearch.mindMapStatus.completed'),
      iconClass: 'text-blue-500',
      textClass: 'text-blue-600',
    },
    [TaskStatus.FAILED]: {
      icon: XCircle,
      text: t('apps.deepSearch.mindMapStatus.failed'),
      iconClass: 'text-red-500',
      textClass: 'text-red-600',
    },
    [TaskStatus.CANCELLED]: {
      icon: Ban,
      text: t('apps.deepSearch.mindMapStatus.cancelled'),
      iconClass: 'text-yellow-500',
      textClass: 'text-yellow-600',
    },
    [TaskStatus.UNKNOWN]: {
      icon: CheckCircle,
      text: t('apps.deepSearch.mindMapStatus.unknown'),
      iconClass: 'text-blue-500',
      textClass: 'text-blue-600',
    },
    [TaskStatus.DEFAULT]: {
      icon: HelpCircle,
      text: t('apps.deepSearch.mindMapStatus.default'),
      iconClass: 'text-gray-400',
      textClass: 'text-gray-500',
    },
  };

  const currentStatus = status || TaskStatus.UNKNOWN;
  const config = statusConfig[currentStatus];
  const IconComponent = config.icon;
  const iconSize = size === 'sm' ? 14 : 16;
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className="inline-flex items-center gap-1">
      <IconComponent className={`${config.iconClass}`} size={iconSize} />
      {showText && (
        <span className={`${config.textClass} ${textSize} font-medium`}>
          {config.text}
        </span>
      )}
    </div>
  );
};

export default StatusIndicator;

export function getStatusTextColor(status?: TaskStatus): string {
  switch (status) {
    case TaskStatus.PENDING:
      return 'text-gray-400';
    case TaskStatus.IN_PROGRESS:
      return 'text-gray-800';
    case TaskStatus.REPORTING:
      return 'text-purple-800';
    case TaskStatus.COMPLETED:
    case TaskStatus.UNKNOWN:
      return 'text-gray-800';
    case TaskStatus.FAILED:
      return 'text-red-600';
    case TaskStatus.CANCELLED:
      return 'text-gray-800';
    default:
      return 'text-gray-500';
  }
}

export function getStatusTitleColor(status?: TaskStatus): string {
  switch (status) {
    case TaskStatus.PENDING:
      return 'text-gray-400';
    case TaskStatus.REPORTING:
      return 'text-gray-900 font-bold';
    case TaskStatus.FAILED:
      return 'text-red-600 font-bold';
    case TaskStatus.CANCELLED:
      return 'text-gray-800 font-bold';
    default:
      return 'text-gray-900 font-bold';
  }
}

export function getStatusBgClass(status?: TaskStatus): string {
  switch (status) {
    case TaskStatus.PENDING:
      return 'bg-white';
    case TaskStatus.IN_PROGRESS:
    case TaskStatus.UNKNOWN:
    case TaskStatus.COMPLETED:
      return 'bg-gradient-to-b from-blue-50/80 to-white';
    case TaskStatus.REPORTING:
      return 'bg-gradient-to-b from-purple-50/80 to-white';
    case TaskStatus.FAILED:
      return 'bg-gradient-to-b from-red-50/80 to-white';
    case TaskStatus.CANCELLED:
      return 'bg-gradient-to-b from-yellow-50/80 to-white';
    default:
      return 'bg-gradient-to-b from-blue-50/80 to-white';
  }
}