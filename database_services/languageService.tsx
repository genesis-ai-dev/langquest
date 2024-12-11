import { eq } from 'drizzle-orm';
import { db } from '../db/database';
import { language } from '../db/drizzleSchema';

export class LanguageService {
  async getUiReadyLanguages() {
    return await db
      .select()
      .from(language)
      .where(eq(language.uiReady, true));
  }

  
  async getAllLanguages() {
    return await db
      .select()
      .from(language);
  }
}

export const languageService = new LanguageService();