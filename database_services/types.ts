export interface LayerStatus {
  visible: boolean;
  active: boolean;
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
