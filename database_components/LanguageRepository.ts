import { VersionedRepository, VersionedEntity } from './VersionedRepository';
import { User } from './UserRepository';
import { Relationship } from './BaseRepository';

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

  protected relationships: Record<string, Relationship<any>> = {
    uiUsers: {
      name: 'uiUsers',
      type: 'toMany',
      query: `
        SELECT u1.* 
        FROM User u1
        INNER JOIN (
          SELECT versionChainId, MAX(versionNum) as maxVersion
          FROM User
          GROUP BY versionChainId
        ) u2 
        ON u1.versionChainId = u2.versionChainId 
        AND u1.versionNum = u2.maxVersion
        WHERE u1.uiLanguage = $id
      `,
      updateQuery: {
        clear: `UPDATE User SET uiLanguage = NULL WHERE uiLanguage = $id`,
        add: `UPDATE User SET uiLanguage = $id WHERE id = $relatedId`
      }
    },
    sourceProjects: {
      name: 'sourceProjects',
      type: 'toMany',
      query: `
        SELECT p1.* 
        FROM Project p1
        INNER JOIN (
          SELECT versionChainId, MAX(versionNum) as maxVersion
          FROM Project
          GROUP BY versionChainId
        ) p2 
        ON p1.versionChainId = p2.versionChainId 
        AND p1.versionNum = p2.maxVersion
        WHERE p1.sourceLanguage = $id
      `,
      updateQuery: {
        clear: `UPDATE Project SET sourceLanguage = NULL WHERE sourceLanguage = $id`,
        add: `UPDATE Project SET sourceLanguage = $id WHERE id = $relatedId`
      }
    },
    targetProjects: {
      name: 'targetProjects',
      type: 'toMany',
      query: `
        SELECT p1.* 
        FROM Project p1
        INNER JOIN (
          SELECT versionChainId, MAX(versionNum) as maxVersion
          FROM Project
          GROUP BY versionChainId
        ) p2 
        ON p1.versionChainId = p2.versionChainId 
        AND p1.versionNum = p2.maxVersion
        WHERE p1.targetLanguage = $id
      `,
      updateQuery: {
        clear: `UPDATE Project SET targetLanguage = NULL WHERE targetLanguage = $id`,
        add: `UPDATE Project SET targetLanguage = $id WHERE id = $relatedId`
      }
    }
  };

  // Additional language-specific method using new base class methods
  // Outdated approach - updated register.tsx to use updated method
  async getUiReady(): Promise<Language[]> {
    return this.withConnection(async (db) => {
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
    });
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