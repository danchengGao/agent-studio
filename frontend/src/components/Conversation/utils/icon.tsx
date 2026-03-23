import React from 'react';
import { Clock, ListTodo, AlertCircle, MinusCircle, Circle, CheckCircle2 } from 'lucide-react';
import loadingSpinnerSvg from '@/assets/icons/loading-spinner.svg';
import documentGeneratingSvg from '@/assets/icons/document-generating.svg';
import documentReportSvg from '@/assets/icons/document-report.svg';

/**
 * 时钟（等待）图标
 * 尺寸: 16x16px
 * 颜色: #777777
 */
export const ClockIcon: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <Clock
      size={16}
      color="#777777"
      strokeWidth={2}
      className={className}
    />
  );
};

/**
 * 任务已完成图标
 * 尺寸: 16x16px
 * 颜色: #777777
 */
export const TaskCompletedIcon: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <ListTodo
      size={16}
      color="#777777"
      strokeWidth={2}
      className={className}
    />
  );
};

/**
 * 任务进行中图标（加载中）
 * 尺寸: 16x16px
 * 转速: 2.5秒/圈
 */
export const LoadingIcon: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <img
      src={loadingSpinnerSvg}
      alt="Loading"
      className={className}
      style={{
        width: '16px',
        height: '16px',
        animation: 'spin 2.5s linear infinite',
      }}
    />
  );
};

// 添加旋转动画的关键帧
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;
if (!document.head.querySelector('style[data-spin-animation]')) {
  style.setAttribute('data-spin-animation', 'true');
  document.head.appendChild(style);
}

/**
 * 失败标志图标
 * 尺寸: 16x16px
 * 颜色: #E02128
 */
export const FailedIcon: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <AlertCircle
      size={16}
      color="#E02128"
      strokeWidth={2}
      className={className}
    />
  );
};

/**
 * 取消标志图标
 * 尺寸: 16x16px
 * 颜色: #C9C9C9
 */
export const CancelIcon: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <MinusCircle
      size={16}
      color="#C9C9C9"
      strokeWidth={2}
      className={className}
    />
  );
};

/**
 * Step 等待标志图标
 * 尺寸: 16x16px
 * 颜色: #777777
 */
export const StepWaitingIcon: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <Circle
      size={16}
      color="#777777"
      strokeWidth={2}
      className={className}
    />
  );
};

/**
 * Step 进行中标志图标（虚线旋转）
 * 尺寸: 16x16px
 * 描边: #0A59F7
 * 填充: #e6eeff
 * 转速: 3秒/圈
 */
export const StepInProgressIcon: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{ width: '16px', height: '16px' }}
    >
      <div
        className="rounded-full border-2 border-dashed"
        style={{
          width: '16px',
          height: '16px',
          borderColor: '#0A59F7',
          backgroundColor: '#e6eeff',
          animation: 'spin 3s linear infinite',
        }}
      />
    </div>
  );
};

/**
 * Step 完成图标
 * 尺寸: 16x16px
 * 颜色: #0a59f7
 */
export const StepCompletedIcon: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <CheckCircle2
      size={16}
      color="#0a59f7"
      strokeWidth={2}
      className={className}
    />
  );
};

/**
 * Word 标签图标
 * 尺寸: 18x21px
 * 颜色: #0A59F7（蓝色）
 */
export const WordTagIcon: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <img
      src={documentReportSvg}
      alt="Word Document"
      className={className}
      style={{
        width: '21px',
        height: '21px',
      }}
    />
  );
};

/**
 * 最终报告文档基础组件
 * 尺寸: 27x32px
 * 使用 SVG 图片 + CSS filter 控制状态
 * 支持自定义颜色（通过 hue-rotate 实现）
 */
const ReportIconBase: React.FC<{
  grayscale?: boolean;
  opacity?: number;
  hueRotate?: number; // 色相旋转角度，用于调整颜色
  className?: string;
}> = ({
  grayscale = false,
  opacity = 1,
  hueRotate = 0,
  className = ''
}) => {
  // 构建滤镜字符串
  let filter = '';
  if (grayscale && hueRotate === 0) {
    filter = 'grayscale(100%)'; // 纯灰色
  } else if (hueRotate !== 0) {
    // 使用 hue-rotate 实现不同颜色
    // 先转为灰度，再调整色相
    filter = `grayscale(100%) sepia(100%) saturate(500%) hue-rotate(${hueRotate}deg)`;
  }

  return (
    <img
      src={documentGeneratingSvg}
      alt="Document"
      className={className}
      style={{
        width: '27px',
        height: '32px',
        opacity: opacity,
        filter: filter || 'none',
      }}
    />
  );
};

/**
 * 最终报告文档 - 等待撰写
 * 灰色 + 透明度 0.4
 */
export const ReportWaitingIcon: React.FC<{ className?: string }> = (props) => {
  return <ReportIconBase grayscale={true} opacity={0.4} {...props} />;
};

/**
 * 最终报告文档 - 撰写中
 * 原始渐变 + 透明度 0.4
 */
export const ReportInProgressIcon: React.FC<{ className?: string }> = (props) => {
  return <ReportIconBase grayscale={false} opacity={0.4} {...props} />;
};

/**
 * 最终报告文档 - 失败
 * 浅红色 + 透明度 0.4 + 中间叠加 FailedIcon
 * 使用 hue-rotate 实现浅红色效果
 */
export const ReportFailedIcon: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`relative inline-block ${className}`} style={{ width: '27px', height: '32px' }}>
      <ReportIconBase grayscale={true} hueRotate={310} opacity={0.3} />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <FailedIcon />
      </div>
    </div>
  );
};

/**
 * 最终报告文档 - 取消
 * 灰色 + 透明度 0.2
 */
export const ReportCancelledIcon: React.FC<{ className?: string }> = (props) => {
  return <ReportIconBase grayscale={true} opacity={0.2} {...props} />;
};

/**
 * 最终报告文档 - 完成
 * 原始渐变 + 不透明
 */
export const ReportCompletedIcon: React.FC<{ className?: string }> = (props) => {
  return <ReportIconBase grayscale={false} opacity={1} {...props} />;
};
