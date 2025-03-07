import { eq } from 'drizzle-orm';
// import { db } from '../db/database';
import { language } from '../db/drizzleSchema';

import { system } from '../db/powersync/system';

const db = system.db;

export class LanguageService {
  async getUiReadyLanguages() {
    return await db.query.language.findMany({
      where: eq(language.ui_ready, true)
    });
  }

  async getLanguageById(id: string) {
    return (
      (await db.query.language.findFirst({
        where: eq(language.id, id)
      })) ?? null
    );
  }

  async getAllLanguages() {
    return await db.query.language.findMany();
  }
}

export const languageService = new LanguageService();
