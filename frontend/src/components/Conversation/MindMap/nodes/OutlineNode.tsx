import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { NodeData, getNodeWidth, getNodeHeight } from '../types';

const OutlineNode: React.FC<{ data: NodeData }> = ({ data }) => {
  const { t } = useTranslation();
  const { title } = data;
  const width = getNodeWidth(data.type);
  const minHeight = getNodeHeight(data.type);

  return (
    <div
      className={`
        relative px-4 py-3 rounded-lg
        bg-white
        shadow-sm hover:shadow-md
        border border-transparent hover:border-indigo-200
        transition-all duration-200
        hover:scale-[1.02]
      `}
      style={{
        width: `${width}px`,
        minHeight: `${minHeight}px`,
      }}
    >
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-indigo-400 !border-2 !border-white"
      />

      <div className="text-center">
        <h3
          className="mb-1"
          style={{
            color: '#191919',
            fontFamily: 'HarmonyHeiTi',
            fontWeight: 'bold',
            fontSize: '14px',
            lineHeight: '24px',
            letterSpacing: '0px',
          }}
        >
          {t('apps.deepSearch.mindMap.researchTopic')}
        </h3>
        {title && (
          <p
            className="whitespace-pre-wrap break-words"
            style={{
              color: '#191919',
              fontFamily: 'HarmonyHeiTi',
              fontWeight: 'regular',
              fontSize: '14px',
              lineHeight: '24px',
              letterSpacing: '0px',
            }}
          >
            {title}
          </p>
        )}
      </div>
    </div>
  );
};

export default memo(OutlineNode);