import type { HybridDataSource } from '@/views/new/useHybridData';

export interface LayerStatus {
  visible: boolean;
  active: boolean;
  source: HybridDataSource;
}

export interface ProjectStatus extends LayerStatus {
  private: boolean;
}

export interface AssetStatus extends LayerStatus {
  quest_active: boolean;
  quest_visible: boolean;
}

export interface TranslationStatus extends LayerStatus {
  creator_id: string;
}

export type AssetOperationAction =
  | 'create'
  | 'rename'
  | 'merge'
  | 'delete'
  | 'replace'
  | 'move';

export interface AssetOperationDataItem {
  id: string;
  name?: string | null;
  // orderIndex?: number | null;
  order_index?: number | null;
  metadata?: Record<string, any> | null;
}

export interface AssetOperationTypes {
  domain: 'asset';
  action: AssetOperationAction;
  previousData: AssetOperationDataItem[];
  newData: AssetOperationDataItem[];
  canUndo: boolean;
}
