import { eq } from 'drizzle-orm';
import { db } from '../db/database';
import { language } from '../db/drizzleSchema';
import type { Language } from '../types/schema';

export type { Language };

export class LanguageService {
  static async getUiReadyLanguages() {
    return await db
      .select()
      .from(language)
      .where(eq(language.uiReady, true))
      .orderBy(language.nativeName);
  }

  static async create(languageData: {
    rev: number;
    nativeName: string;
    englishName: string;
    iso639_3: string;
    versionChainId: string;
    versionNum: number;
    uiReady: boolean;
    creatorId: string;
  }) {
    const [newLanguage] = await db
      .insert(language)
      .values(languageData)
      .returning();
    
    return newLanguage;
  }
}