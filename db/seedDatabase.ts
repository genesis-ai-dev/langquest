// import { db } from './database';
import { user, language, project, quest, tag, quest_tag_link, asset, asset_tag_link, quest_asset_link, vote, translation } from './drizzleSchema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { system } from './powersync/system';
global.Buffer = require('buffer').Buffer;

const wipeFirst: boolean = false;
const db = system.db;

async function seedTags() {
  const tagData = [
    { name: 'Book:Romans', version_chain_id: randomUUID() },
    { name: 'Chapter:1', version_chain_id: randomUUID() },
    { name: 'Chapter:2', version_chain_id: randomUUID() },
    { name: 'Author:Paul', version_chain_id: randomUUID() },
    { name: 'Difficulty:Easy', version_chain_id: randomUUID() },
    { name: 'Difficulty:Medium', version_chain_id: randomUUID() },
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
        version_chain_id: data.version_chain_id,
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
    .where(eq(project.version_chain_id, 'project-1-chain'))
    .get();

  const project2 = await db
    .select()
    .from(project)
    .where(eq(project.version_chain_id, 'project-2-chain'))
    .get();

  const questData = [
    {
      name: 'Romans Chapter 1 Translation',
      description: 'Translate the first chapter of Romans from Spanish to English',
      project_id: project1?.id,
      version_chain_id: randomUUID(),
      tags: ['Book:Romans', 'Chapter:1', 'Author:Paul', 'Difficulty:Easy']
    },
    {
      name: 'Romans Chapter 2 Translation',
      description: 'Translate the second chapter of Romans from Spanish to English',
      project_id: project1?.id,
      version_chain_id: randomUUID(),
      tags: ['Book:Romans', 'Chapter:2', 'Author:Paul', 'Difficulty:Medium']
    },
    {
      name: 'Romanos Capítulo 1',
      description: 'Translate the first chapter of Romans from English to Spanish',
      project_id: project2?.id,
      version_chain_id: randomUUID(),
      tags: ['Book:Romans', 'Chapter:1', 'Author:Paul', 'Difficulty:Easy']
    },
    {
      name: 'Romanos Capítulo 2',
      description: 'Translate the second chapter of Romans from English to Spanish',
      project_id: project2?.id,
      version_chain_id: randomUUID(),
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

    if (!existingQuest && data.project_id) {
      const [newQuest] = await db.insert(quest).values({
        rev: 1,
        name: data.name,
        description: data.description,
        project_id: data.project_id,
        version_chain_id: data.version_chain_id,
      }).returning();

      // Add quest-tag relationships
      for (const tagName of data.tags) {
        const relatedTag = tags.find(t => t.name === tagName);
        if (relatedTag) {
          await db.insert(quest_tag_link).values({
            quest_id: newQuest.id,
            tag_id: relatedTag.id,
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
    .where(eq(language.english_name, 'English'))
    .limit(1);

  const [spanish] = await db
    .select()
    .from(language)
    .where(eq(language.english_name, 'Spanish'))
    .limit(1);

  // Get all quests
  const quests = await db.select().from(quest);
  
  const assetData = [
    {
      name: 'Romans 1 English Text',
      source_language_id: english.id,
      text: 'Paul, a servant of Christ Jesus, called to be an apostle...',
      quest_id: quests[0].id,
      version_chain_id: randomUUID(),
      tags: ['Book:Romans', 'Chapter:1', 'Type:Text']
    },
    {
      name: 'Romans 2 English Text',
      source_language_id: english.id,
      text: 'You, therefore, have no excuse, you who pass judgment on someone else...',
      quest_id: quests[1].id,
      version_chain_id: randomUUID(),
      tags: ['Book:Romans', 'Chapter:2', 'Type:Text']
    },
    {
      name: 'Romanos 1 Spanish Text',
      source_language_id: spanish.id,
      text: 'Pablo, siervo de Jesucristo, llamado a ser apóstol...',
      quest_id: quests[2].id,
      version_chain_id: randomUUID(),
      tags: ['Book:Romans', 'Chapter:1', 'Type:Text']
    },
    {
      name: 'Romanos 2 Spanish Text',
      source_language_id: spanish.id,
      text: 'Por lo tanto, no tienes excusa tú que juzgas a otros...',
      quest_id: quests[3].id,
      version_chain_id: randomUUID(),
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
        source_language_id: data.source_language_id,
        text: data.text,
        images: [],
        audio: [],
        version_chain_id: data.version_chain_id,
      }).returning();

      // Add asset-tag relationships
      for (const tagName of data.tags) {
        const relatedTag = tags.find(t => t.name === tagName);
        if (relatedTag) {
          await db.insert(asset_tag_link).values({
            asset_id: newAsset.id,
            tag_id: relatedTag.id,
          });
        }
      }

      // Add quest-asset relationship
      await db.insert(quest_asset_link).values({
        quest_id: data.quest_id,
        asset_id: newAsset.id,
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
    .where(eq(language.english_name, 'English'))
    .limit(1);

  const [spanish] = await db
    .select()
    .from(language)
    .where(eq(language.english_name, 'Spanish'))
    .limit(1);

  // Get a user for creator
  const [sampleUser] = await db.select().from(user).limit(1);
  if (!sampleUser) return;

  const translationData = [
    {
      asset_id: assets.find(a => a.name === 'Romans 1 English Text')?.id,
      target_language_id: spanish.id,
      text: 'Pablo, un siervo de Jesucristo, llamado a ser apóstol...',
      audio: [],
      creator_id: sampleUser.id,
      version_chain_id: randomUUID(),
    },
    {
      asset_id: assets.find(a => a.name === 'Romans 2 English Text')?.id,
      target_language_id: spanish.id,
      text: 'Por lo tanto, no tienes excusa, oh hombre...',
      audio: [],
      creator_id: sampleUser.id,
      version_chain_id: randomUUID(),
    },
    {
      asset_id: assets.find(a => a.name === 'Romans 1 Spanish Text')?.id,
      target_language_id: english.id,
      text: 'Paul, a servant of Christ Jesus, called to be an apostle...',
      audio: [],
      creator_id: sampleUser.id,
      version_chain_id: randomUUID(),
    },
    {
      asset_id: assets.find(a => a.name === 'Romans 2 Spanish Text')?.id,
      target_language_id: english.id,
      text: 'Therefore you have no excuse, O man...',
      audio: [],
      creator_id: sampleUser.id,
      version_chain_id: randomUUID(),
    },
  ];

  for (const data of translationData) {
    if (!data.asset_id) continue;

    const existingTranslation = await db
      .select()
      .from(translation)
      .where(eq(translation.asset_id, data.asset_id))
      .get();

      if (!existingTranslation && data.asset_id) {  // Add this check
        const [newTranslation] = await db.insert(translation).values({
          rev: 1,
          asset_id: data.asset_id,  // Now guaranteed to be defined
          target_language_id: data.target_language_id,
          text: data.text,
          audio: data.audio,
          creator_id: data.creator_id,
          version_chain_id: data.version_chain_id,
        }).returning();

      console.log(`Translation for asset ${data.asset_id} seeded successfully`);

      // Add some sample votes for each translation
      await seedVotesForTranslation(newTranslation.id, sampleUser.id);
    }
  }
}

async function seedVotesForTranslation(translation_id: string, userId: string) {
  const voteData = [
    {
      translation_id,
      polarity: 'up',
      comment: 'Great translation!',
      creator_id: userId,
      version_chain_id: randomUUID(),
    },
    {
      translation_id,
      polarity: 'down',
      comment: 'Could be improved',
      creator_id: userId,
      version_chain_id: randomUUID(),
    },
  ];

  for (const data of voteData) {
    const existingVote = await db
      .select()
      .from(vote)
      .where(eq(vote.translation_id, data.translation_id))
      .get();

    if (!existingVote) {
      await db.insert(vote).values({
        rev: 1,
        ...data,
      });
      console.log(`Vote for translation ${data.translation_id} seeded successfully`);
    }
  }
}

export async function seedDatabase() {
  try {
    if (wipeFirst) {
      // Delete all data in reverse order of dependencies
      await db.delete(vote);
      await db.delete(translation);
      await db.delete(asset_tag_link);
      await db.delete(quest_asset_link);
      await db.delete(asset_tag_link);
      await db.delete(quest_tag_link);
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
      .where(eq(language.english_name, 'English'))
      .get();

    let english;
    if (!existingEnglish) {
      // Insert English if it doesn't exist
      [english] = await db.insert(language).values({
        rev: 1,
        native_name: 'English',
        english_name: 'English',
        iso639_3: 'eng',
        ui_ready: true,
        version_chain_id: randomUUID(),
      }).returning();
      console.log('English language seeded successfully');
    } else {
      english = existingEnglish;
    }

    // Check if Spanish already exists
    const existingSpanish = await db
      .select()
      .from(language)
      .where(eq(language.english_name, 'Spanish'))
      .get();

    let spanish;
    if (!existingSpanish) {
      // Insert Spanish if it doesn't exist
      [spanish] = await db.insert(language).values({
        rev: 1,
        native_name: 'Español',
        english_name: 'Spanish',
        iso639_3: 'spa',
        ui_ready: true,
        version_chain_id: randomUUID(),
      }).returning();
      console.log('Spanish language seeded successfully');
    } else {
      spanish = existingSpanish;
    }

    // Check if projects exist
    const existingProject1 = await db
      .select()
      .from(project)
      .where(eq(project.version_chain_id, 'project-1-chain'))
      .get();

    if (!existingProject1) {
      await db.insert(project).values({
        rev: 1,
        name: 'English Learning Basics',
        description: 'Basic English learning materials for Spanish speakers',
        source_language_id: spanish.id,
        target_language_id: english.id,
        version_chain_id: 'project-1-chain',
      });
      console.log('Project 1 seeded successfully');
    }

    const existingProject2 = await db
      .select()
      .from(project)
      .where(eq(project.version_chain_id, 'project-2-chain'))
      .get();

    if (!existingProject2) {
      await db.insert(project).values({
        rev: 1,
        name: 'Spanish for Beginners',
        description: 'Learn Spanish from English',
        source_language_id: english.id,
        target_language_id: spanish.id,
        version_chain_id: 'project-2-chain',
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