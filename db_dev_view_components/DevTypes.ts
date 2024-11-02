import { BaseEntity, BaseRepository } from '@/database_components/BaseRepository';
import { VersionedEntity, VersionedRepository } from '@/database_components/VersionedRepository';

// Repository type to handle both versioned and non-versioned repositories
export type EntityRepository<T extends BaseEntity> = BaseRepository<T> | VersionedRepository<T & VersionedEntity>;

// Relationship types
export type RelationType = 'toOne' | 'toMany' | 'manyToMany';

// Field path configuration for accessing and displaying entity data
export type FieldPath = {
  field: string;
  through?: {
    repository: EntityRepository<any>;
    displayField: string;
    relationship?: {
      type: RelationType;
      relationName: string;
      via?: {
        repository: EntityRepository<any>;
        fromField: string;
        toField: string;
        conditions?: Record<string, any>;
        extraFields?: string[];
        displayTemplate?: (entity: any, extraData: Record<string, any>) => string;
      };
      next?: FieldPath;
    };
  };
};

// UI Component Types for Edit View
export type DevFieldType = 
  | 'text' 
  | 'password' 
  | 'switch' 
  | 'entitySelect'  // Replaces 'dropdown'
  | 'relationList';

// Field Configuration for Edit View
export interface EditFieldConfig {
  type: DevFieldType;
  required?: boolean;
  label?: string;
  placeholder?: string;
  fieldPath: FieldPath;
  validation?: (value: unknown, context?: { isNew?: boolean }) => string | null;
}

// Card Configuration
export interface CardConfig {
  title: FieldPath;
  subtitle: FieldPath;
  properties: FieldPath[];
}

// Details Section Configuration
export interface DetailsSectionConfig {
  title: string;
  fields: FieldPath[];
}

// Details Configuration
export interface DetailsConfig {
  sections: DetailsSectionConfig[];
}

// Edit Configuration
export interface EditConfig {
  fields: Record<string, EditFieldConfig>;
}

// Complete Table Configuration
export interface TableConfig {
  repository: VersionedRepository<any>;  // Keep this as VersionedRepository for now
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
  config: TableConfig;
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
  isAddingVersion?: boolean;  // Added this as it seems to be used in the codebase
  onSave: () => void;
  onClose: () => void;
}

// Helper type to extract the entity type from a repository
export type EntityType<T> = T extends EntityRepository<infer E> ? E : never;