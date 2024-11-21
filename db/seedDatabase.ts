import { db } from './database';
import { language, project } from './drizzleSchema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';

export async function seedDatabase() {
  try {
    // Check if English already exists
    const existingEnglish = await db
      .select()
      .from(language)
      .where(eq(language.englishName, 'English'))
      .get();

    let english;
    if (!existingEnglish) {
      // Insert English if it doesn't exist
      [english] = await db.insert(language).values({
        rev: 1,
        nativeName: 'English',
        englishName: 'English',
        iso639_3: 'eng',
        uiReady: true,
        versionChainId: randomUUID(),
      }).returning();
      console.log('English language seeded successfully');
    } else {
      english = existingEnglish;
    }

    // Check if Spanish already exists
    const existingSpanish = await db
      .select()
      .from(language)
      .where(eq(language.englishName, 'Spanish'))
      .get();

    let spanish;
    if (!existingSpanish) {
      // Insert Spanish if it doesn't exist
      [spanish] = await db.insert(language).values({
        rev: 1,
        nativeName: 'Español',
        englishName: 'Spanish',
        iso639_3: 'spa',
        uiReady: true,
        versionChainId: randomUUID(),
      }).returning();
      console.log('Spanish language seeded successfully');
    } else {
      spanish = existingSpanish;
    }

    // Check if projects exist
    const existingProject1 = await db
      .select()
      .from(project)
      .where(eq(project.versionChainId, 'project-1-chain'))
      .get();

    if (!existingProject1) {
      await db.insert(project).values({
        rev: 1,
        name: 'English Learning Basics',
        description: 'Basic English learning materials for Spanish speakers',
        sourceLanguageId: spanish.id,
        targetLanguageId: english.id,
        versionChainId: 'project-1-chain',
      });
      console.log('Project 1 seeded successfully');
    }

    const existingProject2 = await db
      .select()
      .from(project)
      .where(eq(project.versionChainId, 'project-2-chain'))
      .get();

    if (!existingProject2) {
      await db.insert(project).values({
        rev: 1,
        name: 'Spanish for Beginners',
        description: 'Learn Spanish from English',
        sourceLanguageId: english.id,
        targetLanguageId: spanish.id,
        versionChainId: 'project-2-chain',
      });
      console.log('Project 2 seeded successfully');
    }

  } catch (error) {
    console.error('Error seeding database:', error);
  }
}