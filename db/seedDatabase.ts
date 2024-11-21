import { db } from './database';
import { user, language, project, quest, tag, questToTags, asset, assetToTags, questToAssets } from './drizzleSchema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
global.Buffer = require('buffer').Buffer;

const wipeFirst: boolean = false;

async function seedTags() {
  const tagData = [
    { name: 'Book:Romans', versionChainId: randomUUID() },
    { name: 'Chapter:1', versionChainId: randomUUID() },
    { name: 'Chapter:2', versionChainId: randomUUID() },
    { name: 'Author:Paul', versionChainId: randomUUID() },
    { name: 'Difficulty:Easy', versionChainId: randomUUID() },
    { name: 'Difficulty:Medium', versionChainId: randomUUID() },
  ];

  for (const data of tagData) {
    const existingTag = await db
      .select()
      .from(tag)
      .where(eq(tag.name, data.name))
      .get();

    if (!existingTag) {
      await db.insert(tag).values({
        rev: 1,
        name: data.name,
        versionChainId: data.versionChainId,
      });
      console.log(`Tag ${data.name} seeded successfully`);
    }
  }
}

async function seedQuests() {
  // Get projects first
  const project1 = await db
    .select()
    .from(project)
    .where(eq(project.versionChainId, 'project-1-chain'))
    .get();

  const project2 = await db
    .select()
    .from(project)
    .where(eq(project.versionChainId, 'project-2-chain'))
    .get();

  const questData = [
    {
      name: 'Romans Chapter 1 Translation',
      description: 'Translate the first chapter of Romans from Spanish to English',
      projectId: project1?.id,
      versionChainId: randomUUID(),
      tags: ['Book:Romans', 'Chapter:1', 'Author:Paul', 'Difficulty:Easy']
    },
    {
      name: 'Romans Chapter 2 Translation',
      description: 'Translate the second chapter of Romans from Spanish to English',
      projectId: project1?.id,
      versionChainId: randomUUID(),
      tags: ['Book:Romans', 'Chapter:2', 'Author:Paul', 'Difficulty:Medium']
    },
    {
      name: 'Romanos Capítulo 1',
      description: 'Translate the first chapter of Romans from English to Spanish',
      projectId: project2?.id,
      versionChainId: randomUUID(),
      tags: ['Book:Romans', 'Chapter:1', 'Author:Paul', 'Difficulty:Easy']
    },
    {
      name: 'Romanos Capítulo 2',
      description: 'Translate the second chapter of Romans from English to Spanish',
      projectId: project2?.id,
      versionChainId: randomUUID(),
      tags: ['Book:Romans', 'Chapter:2', 'Author:Paul', 'Difficulty:Medium']
    }
  ];

  // Get all tags
  const tags = await db.select().from(tag);

  for (const data of questData) {
    const existingQuest = await db
      .select()
      .from(quest)
      .where(eq(quest.name, data.name))
      .get();

    if (!existingQuest && data.projectId) {
      const [newQuest] = await db.insert(quest).values({
        rev: 1,
        name: data.name,
        description: data.description,
        projectId: data.projectId,
        versionChainId: data.versionChainId,
      }).returning();

      // Add quest-tag relationships
      for (const tagName of data.tags) {
        const relatedTag = tags.find(t => t.name === tagName);
        if (relatedTag) {
          await db.insert(questToTags).values({
            questId: newQuest.id,
            tagId: relatedTag.id,
          });
        }
      }
      console.log(`Quest ${data.name} seeded successfully`);
    }
  }
}

async function seedAssets() {
  const [english] = await db
    .select()
    .from(language)
    .where(eq(language.englishName, 'English'))
    .limit(1);

  const [spanish] = await db
    .select()
    .from(language)
    .where(eq(language.englishName, 'Spanish'))
    .limit(1);

  // Get all quests
  const quests = await db.select().from(quest);
  
  const assetData = [
    {
      name: 'Romans 1 English Text',
      sourceLanguageId: english.id,
      text: 'Paul, a servant of Christ Jesus, called to be an apostle...',
      questId: quests[0].id,
      versionChainId: randomUUID(),
      tags: ['Book:Romans', 'Chapter:1', 'Type:Text']
    },
    {
      name: 'Romans 2 English Text',
      sourceLanguageId: english.id,
      text: 'You, therefore, have no excuse, you who pass judgment on someone else...',
      questId: quests[1].id,
      versionChainId: randomUUID(),
      tags: ['Book:Romans', 'Chapter:2', 'Type:Text']
    },
    {
      name: 'Romanos 1 Spanish Text',
      sourceLanguageId: spanish.id,
      text: 'Pablo, siervo de Jesucristo, llamado a ser apóstol...',
      questId: quests[2].id,
      versionChainId: randomUUID(),
      tags: ['Book:Romans', 'Chapter:1', 'Type:Text']
    },
    {
      name: 'Romanos 2 Spanish Text',
      sourceLanguageId: spanish.id,
      text: 'Por lo tanto, no tienes excusa tú que juzgas a otros...',
      questId: quests[3].id,
      versionChainId: randomUUID(),
      tags: ['Book:Romans', 'Chapter:2', 'Type:Text']
    }
  ];

  // Get all tags
  const tags = await db.select().from(tag);

  for (const data of assetData) {
    const existingAsset = await db
      .select()
      .from(asset)
      .where(eq(asset.name, data.name))
      .get();

    if (!existingAsset) {
      const [newAsset] = await db.insert(asset).values({
        rev: 1,
        name: data.name,
        sourceLanguageId: data.sourceLanguageId,
        text: data.text,
        images: [],
        audio: [],
        versionChainId: data.versionChainId,
      }).returning();

      // Add asset-tag relationships
      for (const tagName of data.tags) {
        const relatedTag = tags.find(t => t.name === tagName);
        if (relatedTag) {
          await db.insert(assetToTags).values({
            assetId: newAsset.id,
            tagId: relatedTag.id,
          });
        }
      }

      // Add quest-asset relationship
      await db.insert(questToAssets).values({
        questId: data.questId,
        assetId: newAsset.id,
      });

      console.log(`Asset ${data.name} seeded successfully`);
    }
  }
}

export async function seedDatabase() {
  try {
    if (wipeFirst) {
      // Delete all data in reverse order of dependencies
      await db.delete(questToAssets);
      await db.delete(assetToTags);
      await db.delete(questToTags);
      await db.delete(asset);
      await db.delete(quest);
      await db.delete(tag);
      await db.delete(project);
      await db.delete(language);
      await db.delete(user);
      console.log('Database wiped successfully');
    }
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

    await seedTags();
    await seedQuests();
    await seedAssets();
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}