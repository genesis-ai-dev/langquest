import { eq } from 'drizzle-orm';
// import { db } from '../db/database';
import { profile, language, translation, vote } from '../db/drizzleSchema';
import { hashPassword } from '../utils/passwordUtils';
import { randomUUID } from 'expo-crypto';
import { aliasedTable } from 'drizzle-orm';
import { system } from '../db/powersync/system';
import { Session } from '@supabase/supabase-js';


export type UserWithRelations = typeof profile.$inferSelect & {
  ui_language: typeof language.$inferSelect;
  translations: (typeof translation.$inferSelect)[];
  votes: (typeof vote.$inferSelect)[];
};

const{ supabaseConnector, db}  = system;

export class UserService {
  async getUserById(userId: string): Promise<UserWithRelations | null> {
    const ui_language = aliasedTable(language, 'ui_language');
  
    const result = await db
      .select({
        // User fields
        id: profile.id,
        rev: profile.rev,
        created_at: profile.created_at,
        last_updated: profile.last_updated,
        version_chain_id: profile.version_chain_id,
        username: profile.username,
        password: profile.password,
        ui_language_id: profile.ui_language_id,
        // Related fields
        ui_language: {
          id: ui_language.id,
          rev: ui_language.rev,
          created_at: ui_language.created_at,
          last_updated: ui_language.last_updated,
          version_chain_id: ui_language.version_chain_id,
          native_name: ui_language.native_name,
          english_name: ui_language.english_name,
          iso639_3: ui_language.iso639_3,
          ui_ready: ui_language.ui_ready,
          creator_id: ui_language.creator_id,
        },
        translations: translation,
        votes: vote,
      })
      .from(profile)
      .leftJoin(ui_language, eq(ui_language.id, profile.ui_language_id))
      .leftJoin(translation, eq(translation.creator_id, profile.id))
      .leftJoin(vote, eq(vote.creator_id, profile.id))
      .where(eq(profile.id, userId))
      .get();
  
    if (!result) return null;
  
    // Handle the case where ui_language might be null
    const userWithRelations: UserWithRelations = {
      id: result.id,
      rev: result.rev,
      created_at: result.created_at,
      last_updated: result.last_updated,
      version_chain_id: result.version_chain_id,
      username: result.username,
      password: result.password,
      ui_language_id: result.ui_language_id,
      ui_language: result.ui_language || {
        id: '',
        rev: 1,
        created_at: '',
        last_updated: '',
        version_chain_id: '',
        native_name: null,
        english_name: null,
        iso639_3: null,
        ui_ready: false,
        creator_id: null,
      },
      translations: result.translations ? [result.translations] : [],
      votes: result.votes ? [result.votes] : [],
    };
  
    return userWithRelations;
  }

  async validateCredentials(credentials: {username: string, password: string}): Promise<UserWithRelations | null> {
    console.log('Validating credentials for user:', credentials.username);
    
    const hashedPassword = await hashPassword(credentials.password);
    console.log('Password hashed successfully');
    
    console.log('Querying local database for profile');
    const foundUser = await db
      .select()
      .from(profile)
      .where(eq(profile.username, credentials.username))
      .get();
      
    console.log('Local profile found:', !!foundUser);
    
    try {
      console.log('Attempting Supabase login');
      await supabaseConnector.login(credentials.username, credentials.password);
      console.log('Supabase login successful');
    } catch (ex: any) {
      console.error('Supabase login failed:', ex);
      return null;
    }
    
    if (foundUser?.password === hashedPassword) {
      console.log('Local password validation successful');
      // Return full user object with relations
      const userWithRelations = await this.getUserById(foundUser.id);
      console.log('Retrieved user with relations:', !!userWithRelations);
      return userWithRelations;
    }
    
    console.log('Password validation failed');
    return null;
  }

  async createNew(input: {
    credentials: {
      username: string;
      password: string;
    };
    ui_language_id: string;
  }) {
    const hashedPassword = await hashPassword(input.credentials.password);
    const [newUser] = await db
      .insert(profile)
      .values({
        version_chain_id: randomUUID(),
        username: input.credentials.username,
        password: hashedPassword,
        ui_language_id: input.ui_language_id,
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