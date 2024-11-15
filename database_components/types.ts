import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { language, user } from '../db/drizzleSchema';

// Base types from schema
export type BaseSelect = {
  id: string;
  rev: number;
  createdAt: string | null;
  lastUpdated: string | null;
};

export type BaseInsert = Omit<BaseSelect, 'id' | 'createdAt' | 'lastUpdated'>;

export type VersionedSelect = BaseSelect & {
  versionChainId: string;
  versionNum: number;
};

export type VersionedInsert = BaseInsert & {
  versionChainId: string;
  versionNum: number;
};

// Inferred types from schema
export type LanguageSelect = InferSelectModel<typeof language>;
export type LanguageInsert = InferInsertModel<typeof language>;
export type UserSelect = InferSelectModel<typeof user>;
export type UserInsert = InferInsertModel<typeof user>;

// Entity types with relationships
export interface LanguageWithRelations extends LanguageSelect {
  creator?: UserSelect | null;
  uiUsers?: UserSelect[];
}

export interface UserWithRelations extends UserSelect {
  uiLanguage?: Partial<LanguageSelect>;
  createdLanguages?: Array<Partial<LanguageSelect>>;
}

// Types for creating new entities
export type NewLanguageData = Omit<
    LanguageInsert, 
    keyof VersionedInsert | 'creatorId'
>;

export type NewUserData = Omit<
    UserInsert,
    keyof VersionedInsert | 'achievements'
>;

// Types for updates
export type LanguageUpdate = Partial<NewLanguageData>;
export type UserUpdate = Partial<NewUserData>;