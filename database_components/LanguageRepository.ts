import { VersionedRepository, VersionedEntity } from './VersionedRepository';

// Move interface to separate types file later
export interface Language extends VersionedEntity {
  nativeName: string;
  englishName: string;
  iso639_3: string | null;
  uiReady: boolean;
  creator: string;
}

export class LanguageRepository extends VersionedRepository<Language> {
  protected tableName = 'Language';
  protected columns = ['nativeName', 'englishName', 'iso639_3', 'uiReady', 'creator'];

  // Additional language-specific method using new base class methods
  async getUiReady(): Promise<Language[]> {
    const db = await this.getDatabase();
    try {
      const statement = await db.prepareAsync(`
        SELECT l1.* 
        FROM ${this.tableName} l1
        INNER JOIN (
          SELECT versionChainId, MAX(versionNum) as maxVersion
          FROM ${this.tableName}
          GROUP BY versionChainId
        ) l2 
        ON l1.versionChainId = l2.versionChainId 
        AND l1.versionNum = l2.maxVersion
        WHERE l1.uiReady = 1
        ORDER BY ${this.getDefaultOrderBy()}
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
    if (!lang.nativeName?.trim()) {
      throw new Error('Native name is required');
    }
    if (!lang.englishName?.trim()) {
      throw new Error('English name is required');
    }
    if (lang.iso639_3 && lang.iso639_3.length !== 3) {
      throw new Error('ISO 639-3 code must be exactly 3 characters');
    }
  }

  protected getDefaultOrderBy(): string {
    return 'nativeName';
  }

  protected getDependencyChecks(id: string): string[] {
    return [
      `SELECT COUNT(*) as count FROM User WHERE uiLanguage = $id`,
      `SELECT COUNT(*) as count FROM Project WHERE sourceLanguage = $id`,
      `SELECT COUNT(*) as count FROM Project WHERE targetLanguage = $id`
    ];
  }
}