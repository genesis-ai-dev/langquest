import { db } from './database';
import { user, language, project, quest, tag, questToTags, asset, assetToTags, questToAssets, vote, translation } from './drizzleSchema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { getAssetId } from '../utils/assetUtils';
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
      tags: ['Book:Romans', 'Chapter:1', 'Type:Text'],
      images: [
        getAssetId('asset_1'),
        getAssetId('asset_2'),
      ],
      audio: [
        getAssetId('audio_1'),
        getAssetId('audio_2'),
      ],
    },
    {
      name: 'Romans 2 English Text',
      sourceLanguageId: english.id,
      text: 'You, therefore, have no excuse, you who pass judgment on someone else...',
      questId: quests[1].id,
      versionChainId: randomUUID(),
      tags: ['Book:Romans', 'Chapter:2', 'Type:Text'],
      images: [
        getAssetId('asset_3'),
        getAssetId('asset_4'),
      ],
      audio: [
        getAssetId('audio_2'),
        getAssetId('audio_3'),
      ],
    },
    {
      name: 'Romanos 1 Spanish Text',
      sourceLanguageId: spanish.id,
      text: 'Pablo, siervo de Jesucristo, llamado a ser apóstol...',
      questId: quests[2].id,
      versionChainId: randomUUID(),
      tags: ['Book:Romans', 'Chapter:1', 'Type:Text'],
      images: [
        getAssetId('asset_4'),
        getAssetId('asset_5'),
      ],
      audio: [
        getAssetId('audio_3'),
        getAssetId('audio_4'),
      ],
    },
    {
      name: 'Romanos 2 Spanish Text',
      sourceLanguageId: spanish.id,
      text: 'Por lo tanto, no tienes excusa tú que juzgas a otros...',
      questId: quests[3].id,
      versionChainId: randomUUID(),
      tags: ['Book:Romans', 'Chapter:2', 'Type:Text'],
      images: [
        getAssetId('asset_2'),
        getAssetId('asset_6'),
      ],
      audio: [
        getAssetId('audio_5'),
        getAssetId('audio_1'),
      ],
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
        images: data.images,
        audio: data.audio,
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

async function seedTranslations() {
  // Get assets first
  const assets = await db.select().from(asset);
  
  // Get languages
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

  // Get a user for creator
  const [sampleUser] = await db.select().from(user).limit(1);
  if (!sampleUser) return;

  const translationData = [
    {
      assetId: assets.find(a => a.name === 'Romans 1 English Text')?.id,
      targetLanguageId: spanish.id,
      text: 'Pablo, un siervo de Jesucristo, llamado a ser apóstol...',
      audio: [],
      creatorId: sampleUser.id,
      versionChainId: randomUUID(),
    },
    {
      assetId: assets.find(a => a.name === 'Romans 2 English Text')?.id,
      targetLanguageId: spanish.id,
      text: 'Por lo tanto, no tienes excusa, oh hombre...',
      audio: [],
      creatorId: sampleUser.id,
      versionChainId: randomUUID(),
    },
    {
      assetId: assets.find(a => a.name === 'Romans 1 Spanish Text')?.id,
      targetLanguageId: english.id,
      text: 'Paul, a servant of Christ Jesus, called to be an apostle...',
      audio: [],
      creatorId: sampleUser.id,
      versionChainId: randomUUID(),
    },
    {
      assetId: assets.find(a => a.name === 'Romans 2 Spanish Text')?.id,
      targetLanguageId: english.id,
      text: 'Therefore you have no excuse, O man...',
      audio: [],
      creatorId: sampleUser.id,
      versionChainId: randomUUID(),
    },
  ];

  for (const data of translationData) {
    if (!data.assetId) continue;

    const existingTranslation = await db
      .select()
      .from(translation)
      .where(eq(translation.assetId, data.assetId))
      .get();

      if (!existingTranslation && data.assetId) {  // Add this check
        const [newTranslation] = await db.insert(translation).values({
          rev: 1,
          assetId: data.assetId,  // Now guaranteed to be defined
          targetLanguageId: data.targetLanguageId,
          text: data.text,
          audio: data.audio,
          creatorId: data.creatorId,
          versionChainId: data.versionChainId,
        }).returning();

      console.log(`Translation for asset ${data.assetId} seeded successfully`);

      // Add some sample votes for each translation
      await seedVotesForTranslation(newTranslation.id, sampleUser.id);
    }
  }
}

async function seedVotesForTranslation(translationId: string, userId: string) {
  const voteData = [
    {
      translationId,
      polarity: 'up',
      comment: 'Great translation!',
      creatorId: userId,
      versionChainId: randomUUID(),
    },
    {
      translationId,
      polarity: 'down',
      comment: 'Could be improved',
      creatorId: userId,
      versionChainId: randomUUID(),
    },
  ];

  for (const data of voteData) {
    const existingVote = await db
      .select()
      .from(vote)
      .where(eq(vote.translationId, data.translationId))
      .get();

    if (!existingVote) {
      await db.insert(vote).values({
        rev: 1,
        ...data,
      });
      console.log(`Vote for translation ${data.translationId} seeded successfully`);
    }
  }
}

export async function seedDatabase() {
  try {
    if (wipeFirst) {
      // Delete all data in reverse order of dependencies
      await db.delete(vote);
      await db.delete(translation);
      await db.delete(assetToTags);
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
    await seedTranslations();
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}