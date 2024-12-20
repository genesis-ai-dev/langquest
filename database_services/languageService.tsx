import { eq } from 'drizzle-orm';
// import { db } from '../db/database';
import { language } from '../db/drizzleSchema';

import { system } from '../db/powersync/system';

const db = system.db;

export class LanguageService {
  async getUi_readyLanguages() {
    return await db
      .select()
      .from(language)
      .where(eq(language.ui_ready, true));
  }

  async getLanguageById(id: string) {
    const results = await db
      .select()
      .from(language)
      .where(eq(language.id, id));
    return results[0];
  }

  
  async getAllLanguages() {
    return await db
      .select()
      .from(language);
  }
}

export const languageService = new LanguageService();