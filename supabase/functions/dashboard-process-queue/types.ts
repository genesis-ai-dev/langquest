export type ProjectTemplate = 'unstructured' | 'bible' | 'fia';

export type JsonRecord = Record<string, unknown>;

export interface MemberStats {
  questsCreated: number;
  assetsCreated: number;
}

export interface DashboardSubquestItem {
  name: string | null;
  creatorsId: string[];
  languoids: string[];
  itemsExpected: number;
  itemsCompleted: number;
  totalVersions: number;
  totalAssets: number;
  totalTranscriptions: number;
  totalTranslations: number;
  totalAssetsWithTranscription: number;
  totalAssetsWithTranslation: number;
  totalImages: number;
  totalText: number;
  totalAudio: number;
}

export interface DashboardQuestItem {
  name: string | null;
  questCompleted: boolean;
  totalSubquestsCreated: number;
  totalSubquestsExpected: number;
  totalSubquestsCompleted: number;
  totalAssets: number;
  languoids: string[];
  creatorsId: string[];
  subquests: DashboardSubquestItem[];
}

export interface DashboardJsonPayload {
  members: Record<string, MemberStats>;
  quests: Record<string, DashboardQuestItem>;
}

export interface DashboardMetrics {
  total_quests: number;
  total_subquests: number;
  expected_quests: number;
  total_assets: number;
  total_quests_versions: number;
  completed_quests: number;
  completed_subquests: number;
  inactive_quests: number;
  inactive_assets: number;
  assets_with_text: number;
  assets_with_audio: number;
  assets_with_image: number;
  assets_with_transcription: number;
  assets_with_translation: number;
  total_source_languages: number;
  total_target_languages: number;
  total_members: number;
  total_owners: number;
  dashboard_json: DashboardJsonPayload;
}

export interface ProjectBaseInfo {
  project_id: string;
  project_status: 'active' | 'inactive';
  template: ProjectTemplate;
}

export interface ProjectDashboardPayload
  extends ProjectBaseInfo, DashboardMetrics {}

export interface ProjectDashboardContext {
  project: JsonRecord;
  quests: JsonRecord[];
  assets: JsonRecord[];
  assetContentLinks: JsonRecord[];
  questAssetLinks: JsonRecord[];
  profileProjectLinks: JsonRecord[];
  projectLanguageLinks: JsonRecord[];
  templateStructureRows: JsonRecord[];
}
