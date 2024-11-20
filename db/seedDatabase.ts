import { db } from './database';
import { language } from './drizzleSchema';
import { eq } from 'drizzle-orm';

export async function seedEnglish() {
  try {
    // Check if English already exists
    const existingEnglish = await db
      .select()
      .from(language)
      .where(eq(language.englishName, 'English'))
      .get();

    if (!existingEnglish) {
      // Insert English if it doesn't exist
      await db.insert(language).values({
        rev: 1,
        nativeName: 'English',
        englishName: 'English',
        iso639_3: 'eng',
        uiReady: true,
        versionChainId: 'english-chain', // This will be the same as the generated ID
        versionNum: 1
      });
      console.log('English language seeded successfully');
    }
  } catch (error) {
    console.error('Error seeding English language:', error);
  }
}