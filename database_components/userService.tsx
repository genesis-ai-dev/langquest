import { eq } from 'drizzle-orm';
import { db } from '../db/database';
import { user, language, translation, vote } from '../db/drizzleSchema';
import { hashPassword } from '../utils/passwordUtils';
import { randomUUID } from 'expo-crypto';
import { aliasedTable } from 'drizzle-orm';

export type UserWithRelations = typeof user.$inferSelect & {
  uiLanguage: typeof language.$inferSelect;
  translations: (typeof translation.$inferSelect)[];
  votes: (typeof vote.$inferSelect)[];
};

export class UserService {
  async getUserById(userId: string): Promise<UserWithRelations | null> {
    const uiLanguage = aliasedTable(language, 'uiLanguage');
  
    const result = await db
      .select({
        // User fields
        id: user.id,
        rev: user.rev,
        createdAt: user.createdAt,
        lastUpdated: user.lastUpdated,
        versionChainId: user.versionChainId,
        username: user.username,
        password: user.password,
        uiLanguageId: user.uiLanguageId,
        // Related fields
        uiLanguage: {
          id: uiLanguage.id,
          rev: uiLanguage.rev,
          createdAt: uiLanguage.createdAt,
          lastUpdated: uiLanguage.lastUpdated,
          versionChainId: uiLanguage.versionChainId,
          nativeName: uiLanguage.nativeName,
          englishName: uiLanguage.englishName,
          iso639_3: uiLanguage.iso639_3,
          uiReady: uiLanguage.uiReady,
          creatorId: uiLanguage.creatorId,
        },
        translations: translation,
        votes: vote,
      })
      .from(user)
      .leftJoin(uiLanguage, eq(uiLanguage.id, user.uiLanguageId))
      .leftJoin(translation, eq(translation.creatorId, user.id))
      .leftJoin(vote, eq(vote.creatorId, user.id))
      .where(eq(user.id, userId))
      .get();
  
    if (!result) return null;
  
    // Handle the case where uiLanguage might be null
    const userWithRelations: UserWithRelations = {
      id: result.id,
      rev: result.rev,
      createdAt: result.createdAt,
      lastUpdated: result.lastUpdated,
      versionChainId: result.versionChainId,
      username: result.username,
      password: result.password,
      uiLanguageId: result.uiLanguageId,
      uiLanguage: result.uiLanguage || {
        id: '',
        rev: 1,
        createdAt: '',
        lastUpdated: '',
        versionChainId: '',
        nativeName: null,
        englishName: null,
        iso639_3: null,
        uiReady: false,
        creatorId: null,
      },
      translations: result.translations ? [result.translations] : [],
      votes: result.votes ? [result.votes] : [],
    };
  
    return userWithRelations;
  }

  async validateCredentials(username: string, password: string): Promise<UserWithRelations | null> {
    const hashedPassword = await hashPassword(password);
    const foundUser = await db
      .select()
      .from(user)
      .where(eq(user.username, username))
      .get();
    
    if (foundUser?.password === hashedPassword) {
      // Return full user object with relations
      return this.getUserById(foundUser.id);
    }
    return null;
  }

  async createNew(data: {
    username: string;
    password: string;
    uiLanguageId: string;
  }) {
    const hashedPassword = await hashPassword(data.password);
    const [newUser] = await db
      .insert(user)
      .values({
        versionChainId: randomUUID(),
        username: data.username,
        password: hashedPassword,
        uiLanguageId: data.uiLanguageId,
        rev: 1,
      })
      .returning();
    
    return newUser;
  }
}

export const userService = new UserService();