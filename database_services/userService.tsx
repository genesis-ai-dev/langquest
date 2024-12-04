import { eq } from 'drizzle-orm';
// import { db } from '../db/database';
import { user, language, translation, vote } from '../db/drizzleSchema';
import { hashPassword } from '../utils/passwordUtils';
import { randomUUID } from 'expo-crypto';
import { aliasedTable } from 'drizzle-orm';
import { system } from '../db/powersync/system';
import { Session } from '@supabase/supabase-js';


export type UserWithRelations = typeof user.$inferSelect & {
  uiLanguage: typeof language.$inferSelect;
  translations: (typeof translation.$inferSelect)[];
  votes: (typeof vote.$inferSelect)[];
};

const{ supabaseConnector, db}  = system;

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

  async validateCredentials(credentials: {username: string, password: string}): Promise<UserWithRelations | null> {
    const hashedPassword = await hashPassword(credentials.password);
    const foundUser = await db
      .select()
      .from(user)
      .where(eq(user.username, credentials.username))
      .get();
    try {
      await supabaseConnector.login(credentials.username, credentials.password);
    } catch (ex: any) {
      console.log(ex);
      return null;
    }
    if (foundUser?.password === hashedPassword) {
      // Return full user object with relations
      return this.getUserById(foundUser.id);
    }
    return null;
  }

  async createNew(input: {
    credentials: {
      username: string;
      password: string;
    };
    uiLanguageId: string;
  }) {
    const hashedPassword = await hashPassword(input.credentials.password);
    const [newUser] = await db
      .insert(user)
      .values({
        versionChainId: randomUUID(),
        username: input.credentials.username,
        password: hashedPassword,
        uiLanguageId: input.uiLanguageId,
        rev: 1,
      })
      .returning();
    
    const { data, error } = await supabaseConnector.client.auth.signUp({
      email: input.credentials.username,
      password: hashedPassword
    });
    if (error) {
      throw error;
    }
    const session = data.session;
    if (data.session) {
      supabaseConnector.client.auth.setSession(data.session);
    } 
    
    return {newUser, session};
  }
}

export const userService = new UserService();