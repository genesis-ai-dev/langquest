import { eq } from 'drizzle-orm';
import { language } from '../db/drizzleSchema';

// Lazy getter to break circular dependency
const getDb = async () => {
  // Dynamic import to break the circular dependency
  const systemModule = await import('../db/powersync/system');
  return systemModule.system.db;
};

export class LanguageService {
  async getUiReadyLanguages() {
    const db = await getDb();
    return await db.query.language.findMany({
      where: eq(language.ui_ready, true)
    });
  }

  async getLanguageById(id: string) {
    const db = await getDb();
    return (
      (await db.query.language.findFirst({
        where: eq(language.id, id)
      })) ?? null
    );
  }

  async getAllLanguages() {
    const db = await getDb();
    return await db.query.language.findMany();
  }
}

export const languageService = new LanguageService();
