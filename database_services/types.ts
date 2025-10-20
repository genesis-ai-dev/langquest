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
