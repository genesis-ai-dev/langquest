import { VersionedEntity } from '@/database_components/VersionedRepository';
import { VersionedRepository } from '@/database_components/VersionedRepository';

// Field Types
export type DevFieldType = 'text' | 'password' | 'dropdown' | 'switch' | 'relationList';

// Card Configuration
export interface CardConfig {
  title: string;
  subtitle: string;
  properties: string[];
}

// Details Section Configuration
export interface DetailsSectionConfig {
  title: string;
  fields: string[];
}

// Details Configuration
export interface DetailsConfig {
  sections: DetailsSectionConfig[];
}

// Field Configuration for Edit View
export interface EditFieldConfig {
  type: DevFieldType;
  required?: boolean;
  label?: string;
  placeholder?: string;
  source?: string; 
  // For dropdowns and other linked entity fields
  linkedEntity?: {
    repository: VersionedRepository<any>;
    displayField: string;
  };
  // For relation lists
  relationConfig?: {
    repository: VersionedRepository<any>;
    relationName: string;
    displayField: string;
  };
  // Returns error message or null if valid
  validation?: (value: unknown, context?: { isNew?: boolean }) => string | null; 
}

// Edit Configuration
export interface EditConfig {
  fields: Record<string, EditFieldConfig>;
}

// Complete Table Configuration
export interface TableConfig {
  repository: VersionedRepository<any>;
  card: CardConfig;
  details: DetailsConfig;
  edit: EditConfig;
}

// Complete Configuration for all tables
export interface DevTableConfigs {
  [tableName: string]: TableConfig;
}

// Props for shared components
export interface DevCardProps<T extends VersionedEntity> {
  entity: T;
  config: CardConfig;
  onSelect: (entity: T) => void;
}

export interface DevDetailsProps<T extends VersionedEntity> {
  entity: T;
  config: TableConfig;
  onClose: () => void;
  onUpdate: () => void;
}

export interface DevEditProps<T extends VersionedEntity> {
  entity: Partial<T>;
  config: TableConfig;
  isNew?: boolean;
  onSave: () => void;
  onClose: () => void;
}