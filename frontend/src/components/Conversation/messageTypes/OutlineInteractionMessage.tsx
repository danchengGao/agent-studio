import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Message, TaskStatus, useConversationStore } from '../../../stores/useConversationStore';
import { Play, ChevronDown, ChevronUp } from 'lucide-react';

interface OutlineInteractionMessageProps {
  message: Message;
}

interface OutlineSection {
  id?: string;
  title: string;
  description?: string;
  is_core_section?: boolean;
  parent_ids?: string[];
  relationships?: any[];
  plans?: any[];
}

interface OutlineContent {
  id?: string;
  language?: string;
  thought?: string;
  title?: string;
  sections?: OutlineSection[];
}

export const OutlineInteractionMessage: React.FC<OutlineInteractionMessageProps> = ({ message }) => {
  const { t } = useTranslation();
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const updateMessage = useConversationStore(state => state.updateMessage);
  const updateMessageItems = useConversationStore(state => state.updateMessageItems);
  const getCurrentMessageItems = useConversationStore(state => state.getCurrentMessageItems);

  const outlineContent: OutlineContent = typeof message.content === 'string'
    ? (() => {
        try {
          return JSON.parse(message.content);
        } catch {
          return {};
        }
      })()
    : (message.content as OutlineContent) || {};

  const { sections } = outlineContent;

  const isWaiting = message.status === TaskStatus.PENDING || message.status === TaskStatus.IN_PROGRESS;

  const toggleSection = (index: number) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleStartResearch = async () => {
    const messageItemsList = getCurrentMessageItems();
    if (!messageItemsList || messageItemsList.length === 0) return;
    
    const lastMessageItems = messageItemsList[messageItemsList.length - 1];
    if (!lastMessageItems) return;

    updateMessage(lastMessageItems.id, message.id, {
      status: TaskStatus.COMPLETED
    });
    updateMessageItems(lastMessageItems.id, { status: TaskStatus.COMPLETED });

    const userMessage = t('apps.outlineInteraction.startResearch');
    useConversationStore.getState().triggerOutlineInteractionAccept(message.id, userMessage);
  };

  return (
    <div className="outline-interaction-message w-full bg-white rounded-xl mt-3">
      <div className="flex items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h4 className="text-[16px] leading-[22px] font-semibold text-gray-900">
                {t('apps.outlineInteraction.researchOutline')}
              </h4>
            </div>
          </div>

          {sections && sections.length > 0 && (
            <div className="bg-white">
              {sections.map((section, index) => {
                const isExpanded = expandedSections.has(index);
                return (
                  <div
                    key={index}
                    className={index !== sections.length - 1 ? 'bg-white border-b border-gray-200' : 'bg-white'}
                  >
                    <div
                      className="flex items-center gap-2 pl-2 pr-4 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => toggleSection(index)}
                    >
                      <span className="flex-1 text-[14px] leading-[22px] font-semibold text-gray-900">
                        {section.title}
                      </span>
                      {isExpanded ? (
                        <ChevronUp size={16} className="text-gray-500 flex-shrink-0" />
                      ) : (
                        <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />
                      )}
                    </div>
                    {isExpanded && section.description && (
                      <div className="pl-2 pr-4 pb-4 pt-0">
                        <div className="text-sm text-gray-600 leading-7">
                          {section.description}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-3 border-t border-gray-200">
            {isWaiting && (
              <div className="text-xs text-gray-500 mb-2">
                {t('apps.outlineInteraction.modifyTip')}
              </div>
            )}
            <button
              onClick={handleStartResearch}
              disabled={!isWaiting}
              className="btn-primary w-full h-10 flex items-center justify-center gap-1.5 text-base font-semibold transition-all"
            >
              <Play size={12} />
              {t('apps.outlineInteraction.startResearch')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OutlineInteractionMessage;
