import type { HybridDataSource } from '@/hooks/useHybridQuery';

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
  | 'move'
  | 'import';

export interface AssetOperationDataItem {
  id: string;
  name?: string | null;
  order_index?: number | null;
  metadata?: Record<string, any> | null;
  download_profiles?: string[] | null;
  project_id?: string | null;
  source_language_id?: string | null;
  creator_id?: string | null;
  link_id?: string | null;
  contents?: AssetContentSnapshot[];
}

export interface AssetContentSnapshot {
  id?: string | null;
  source_language_id?: string | null;
  languoid_id?: string | null;
  text?: string | null;
  audio?: string[] | null;
  download_profiles?: string[] | null;
  order_index?: number | null;
}

export interface AssetOperationTypes {
  domain: 'asset';
  action: AssetOperationAction;
  previousData: AssetOperationDataItem[];
  newData: AssetOperationDataItem[];
  canUndo: boolean;
}
