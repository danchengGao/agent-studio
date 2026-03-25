import React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { ReactFlowProvider } from '@xyflow/react';
import { MindMapFlow } from './index';
import { useConversationStore } from '../../../stores/useConversationStore';

interface MindMapPanelProps {
  messageItemsId: string;
  onClose: () => void;
  className?: string;
  graphType?: 'sectionGraph' | 'taskGraph';
  onGraphTypeChange?: (graphType: 'sectionGraph' | 'taskGraph') => void;
}

const MindMapPanel: React.FC<MindMapPanelProps> = ({
  messageItemsId,
  onClose,
  className = '',
  graphType,
  onGraphTypeChange,
}) => {
  const { t } = useTranslation();

  const messageItems = useConversationStore(state => state.messageItemsMap.get(messageItemsId));

  return (
    <div className={`w-full h-full flex flex-col bg-gray-50 ${className}`}>
      <div className="flex-1 min-h-0 relative">
        <ReactFlowProvider>
          <MindMapFlow
            messageItemsId={messageItemsId}
            className="w-full h-full"
            graphType={graphType}
            onGraphTypeChange={onGraphTypeChange}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
};

export default MindMapPanel;