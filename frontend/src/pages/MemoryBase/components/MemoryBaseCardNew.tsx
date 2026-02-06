import React from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, Edit, Trash2, Clock } from 'lucide-react';
import { ConfigCard, ConfigCardAction, EditingState } from '@/components/Common/common-grid';
import { CardFooterRow } from '@/components/Common/common-grid';
import { useEmbeddingModel, useModels } from '@test-agentstudio/api-client';
import { useAuthStore } from '@/stores/useAuthStore';
import type { MemoryBase } from '@/types/memoryBase';

interface ModelDetail {
  model_id: number;
  model_name: string;
  model_type: string;
  model_provider: string;
  max_tokens: number;
  temperature: number;
  top_p: number;
  timeout: number;
  retry_count: number;
  enable_streaming: boolean;
  enable_function_calling: boolean;
  is_active: boolean;
  api_key: string;
  api_base: string;
  streaming: boolean;
}

const EMPTY_EDITING_STATE: EditingState = {
  id: null,
  field: null,
  value: '',
  isEditing: false,
};

function formatRelativeTime(
  value: string | number | undefined,
  t: (k: string, opts?: Record<string, unknown>) => string
): string {
  if (!value) return '';
  const date = new Date(typeof value === 'number' ? value * 1000 : value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return t('common.messages.relativeTime.justNow');
  if (diffMins < 60) return t('common.messages.relativeTime.minutesAgo', { count: diffMins });
  if (diffHours < 24) return t('common.messages.relativeTime.hoursAgo', { count: diffHours });
  if (diffDays < 7) return t('common.messages.relativeTime.daysAgo', { count: diffDays });
  return date.toLocaleDateString();
}

export interface MemoryBaseCardNewProps {
  memoryBase: MemoryBase;
  onEdit: (mb: MemoryBase) => void;
  onDelete: (mb: MemoryBase) => void;
}

/**
 * 基于 ConfigCard 的记忆库网格卡片，用于 CommonPageLayout 下的网格视图。
 * 本迭代不做卡片内联编辑，编辑即跳转编辑页。
 */
export const MemoryBaseCardNew: React.FC<MemoryBaseCardNewProps> = ({
  memoryBase,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const { data: embeddingModel, isLoading: embeddingLoading } = useEmbeddingModel(
    memoryBase.embedding_model_config_id?.toString() || '',
    memoryBase.space_id || user?.spaceId || '',
  );

  const { data: modelsData, isLoading: modelsLoading } = useModels({
    spaceId: user?.spaceId || '0',
    size: 100,
    sort_by: 'update_time',
    sort_order: 'desc',
  });

  const [modelsList, setModelsList] = React.useState<ModelDetail[]>([]);

  // 转换LLM模型数据格式
  React.useEffect(() => {
    if (modelsData?.items) {
      const convertedModels: ModelDetail[] = modelsData.items.map(model => ({
        model_id: parseInt(model.id),
        model_name: model.name || '',
        model_type: model.modelId || '',
        model_provider: model.provider || '',
        max_tokens: model.maxTokens || 0,
        temperature: model.temperature || 0,
        top_p: model.topp || 0,
        timeout: model.timeout || 0,
        retry_count: model.retryCount || 0,
        enable_streaming: model.enableStreaming || false,
        enable_function_calling: model.enableFunctionCalling || false,
        is_active: model.isActive || false,
        api_key: model.apiKey || '',
        api_base: model.baseUrl || '',
        streaming: model.enableStreaming || false,
      }));

      setModelsList(convertedModels);
    }
  }, [modelsData]);

  const llmModel = modelsList.find(model => model.model_id === memoryBase.llm_model_config_id);

  const actions: ConfigCardAction[] = [
    {
      key: 'edit',
      label: t('common.buttons.edit'),
      icon: <Edit className="w-4 h-4" />,
      onClick: () => onEdit(memoryBase),
    },
    {
      key: 'delete',
      label: t('common.buttons.delete'),
      icon: <Trash2 className="w-4 h-4" />,
      onClick: () => onDelete(memoryBase),
    },
  ];

  const icon = <Brain className="w-6 h-6" />;
  const timeDisplay = formatRelativeTime(
    memoryBase.updated_at || memoryBase.created_at,
    t,
  );

  // 参考知识库卡片：Embedding 模型 + LLM 模型标签
  const tags: Array<{
    label: string;
    color?: string;
    variant?: 'default' | 'error' | 'loading';
    tooltip?: React.ReactNode;
  }> = [
  ];

  if (embeddingLoading) {
    tags.push({ label: t('memoryBases.form.loadingModels'), variant: 'loading' });
  } else if (embeddingModel?.name) {
    if (embeddingModel.isActive === false) {
      // 模型已被禁用：错误态 + 提示，参考知识库卡片
      tags.push({
        label: embeddingModel.name,
        variant: 'error',
        tooltip: t('memoryBases.form.modelUnavailable'),
      });
    } else {
      tags.push({ label: embeddingModel.name });
    }
  }

  if (llmModel) {
    if (!llmModel.is_active) {
      tags.push({
        label: llmModel.model_name,
        variant: 'error',
        tooltip: t('memoryBases.form.llmModelUnavailable'),
      });
    } else {
      tags.push({ label: llmModel.model_name });
    }
  }

  return (
    <ConfigCard
      id={memoryBase.mdb_id}
      icon={icon}
      iconBgColor="bg-gradient-to-br from-purple-50 to-indigo-50"
      iconTextColor="text-purple-600"
      title={memoryBase.name}
      description={memoryBase.description}
      tags={tags}
      editingState={EMPTY_EDITING_STATE}
      actions={actions}
      onClick={() => onEdit(memoryBase)}
      footer={
        <CardFooterRow className="flex flex-col gap-1">
          <div className="flex items-center text-[11px] text-[#9CA3AF]">
            <Clock className="w-3 h-3 mr-1" />
            <span>
              {t('common.card.editedAgo')} {timeDisplay}
            </span>
          </div>
        </CardFooterRow>
      }
    />
  );
};

export default MemoryBaseCardNew;
