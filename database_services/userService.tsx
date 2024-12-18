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
    try {
        // First authenticate with Supabase
        const { data, error } = await supabaseConnector.client.auth.signInWithPassword({
            email: credentials.username,
            password: credentials.password
        });
        
        if (error) throw error;
        if (!data.user) return null;
        
        // Then get the profile data
        const userWithRelations = await this.getUserById(data.user.id);
        return userWithRelations;
    } catch (error) {
        console.error('Login error:', error);
        return null;
    }
  }

  async createNew(input: {
    credentials: { username: string; password: string; };
    ui_language_id: string;
  }) {
    try {
        // Update the anonymous user with email and password
        const { data: updateData, error: updateError } = await supabaseConnector.client.auth.updateUser({
            email: input.credentials.username,
            password: input.credentials.password
        });
        
        if (updateError) throw updateError;
        if (!updateData.user) throw new Error('No user returned from update');

        // Update ui_language_id in profile
        const { error: langError } = await supabaseConnector.client
            .from('profile')
            .update({ ui_language_id: input.ui_language_id })
            .eq('id', updateData.user.id);

        if (langError) throw langError;

        // Fetch the complete profile
        const { data: profile, error: profileError } = await supabaseConnector.client
            .from('profile')
            .select()
            .eq('id', updateData.user.id)
            .single();

        if (profileError) throw profileError;

        return profile;  // Just return the profile
    } catch (error) {
        console.error('Error in createNew:', error);
        throw error;
    }
  }
}

export const userService = new UserService();