import * as SQLite from 'expo-sqlite';
import { BaseRepository, BaseEntity } from './BaseRepository';

export interface Language extends BaseEntity {
  nativeName: string;
  englishName: string;
  iso639_3: string | null;
  uiReady: boolean;
  creator: string;
}

export class LanguageRepository extends BaseRepository<Language> {
  protected tableName = 'Language';
  protected columns = ['nativeName', 'englishName', 'iso639_3', 'uiReady', 'creator'];

  // Additional language-specific method
  async getUiReady(): Promise<Language[]> {
    const db = await this.getDatabase();
    try {
      const statement = await db.prepareAsync(`
        SELECT l1.* 
        FROM Language l1
        INNER JOIN (
          SELECT versionChainId, MAX(versionNum) as maxVersion
          FROM Language
          GROUP BY versionChainId
        ) l2 
        ON l1.versionChainId = l2.versionChainId 
        AND l1.versionNum = l2.maxVersion
        WHERE l1.uiReady = 1
        ORDER BY l1.nativeName
      `);

      try {
        const result = await statement.executeAsync();
        return await result.getAllAsync() as Language[];
      } finally {
        await statement.finalizeAsync();
      }
    } finally {
      await db.closeAsync();
    }
  }

  protected async validateForInsert(lang: Partial<Language>): Promise<void> {
    if (!lang.nativeName || !lang.englishName) {
      throw new Error('Native name and English name are required');
    }
  }

  protected getDefaultOrderBy(): string {
    return 'nativeName';
  }

  protected getDependencyChecks(id: string): string[] {
    return [
      `SELECT COUNT(*) as count FROM User WHERE uiLanguage = '${id}'`,
      `SELECT COUNT(*) as count FROM Project WHERE sourceLanguage = '${id}'`,
      `SELECT COUNT(*) as count FROM Project WHERE targetLanguage = '${id}'`
    ];
  }
}