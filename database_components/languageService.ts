import { eq, desc, and, SQL, asc } from 'drizzle-orm';
import { user, language } from '../db/drizzleSchema';
import { VersionedService } from './VersionedService';
import { 
  LanguageSelect, 
  LanguageInsert, 
  LanguageWithRelations,
  NewLanguageData,
  LanguageUpdate 
} from './types';
import { db } from '../db/database';

export class LanguageService extends VersionedService<
  typeof language,
  LanguageSelect,
  LanguageInsert
> {
  constructor() {
    super(language);
  }

  async getUiReadyLanguages(): Promise<LanguageSelect[]> {
    const subquery = this.getLatestVersionsSubquery();
    
    const results = await db
      .select()
      .from(this.table)
      .innerJoin(
        subquery,
        and(
          eq(this.table.versionChainId, subquery.versionChainId),
          eq(this.table.versionNum, subquery.maxVersion)
        )
      )
      .where(eq(this.table.uiReady, true))
      .orderBy(this.getDefaultOrderBy());
  
    // Map to extract just the language data from each row
    return results.map(row => row.Language) as LanguageSelect[];
  }

  async getWithRelations(id: string): Promise<LanguageWithRelations | undefined> {
    const language = await this.findById(id);
    if (!language) return undefined;
  
    // Get the language with its creator
    const [result] = await db
      .select()
      .from(this.table)
      .where(eq(this.table.id, id))
      .leftJoin(user, eq(this.table.creatorId, user.id));
  
    // Get users who have this as their UI language
    const uiUsers = await db
      .select()
      .from(user)
      .where(eq(user.uiLanguageId, id));
  
    // Combine the results
    return {
      ...result.Language,
      creator: result.User ? result.User : undefined,
      uiUsers: uiUsers
    } as LanguageWithRelations;
  }

  async create(data: NewLanguageData): Promise<LanguageSelect> {
    await this.validateForCreate(data);
    return await super.createNew(data);
  }

  async update(id: string, data: LanguageUpdate): Promise<LanguageSelect> {
    await this.validateForUpdate(data);
    return await super.update(id, data);
  }

  protected getDefaultOrderBy(): SQL<unknown> {
    return asc(this.table.nativeName);
  }

  private async validateForCreate(data: NewLanguageData): Promise<void> {
    if (!data.nativeName?.trim() && !data.englishName?.trim()) {
      throw new Error('Either native name or English name is required');
    }
    if (data.iso639_3 && data.iso639_3.length !== 3) {
      throw new Error('ISO 639-3 code must be exactly 3 characters');
    }
  }

  private async validateForUpdate(data: LanguageUpdate): Promise<void> {
    if (data.nativeName === '' && data.englishName === '') {
      throw new Error('Cannot remove both native name and English name');
    }
    if (data.iso639_3 && data.iso639_3.length !== 3) {
      throw new Error('ISO 639-3 code must be exactly 3 characters');
    }
  }
}

export const languageService = new LanguageService();