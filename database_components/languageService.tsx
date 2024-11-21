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
}

export const languageService = new LanguageService();