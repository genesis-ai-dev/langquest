import { eq } from 'drizzle-orm';
// import { db } from '../db/database';
import { profile, language, translation, vote } from '../db/drizzleSchema';
import { hashPassword } from '../utils/passwordUtils';
import { randomUUID } from 'expo-crypto';
import { aliasedTable } from 'drizzle-orm';
import { system } from '../db/powersync/system';
import { Session } from '@supabase/supabase-js';

export type User = typeof profile.$inferSelect;

const{ supabaseConnector, db}  = system;

export class UserService {

  async getUserById(id: string): Promise<User | null> {
    const results = await db
      .select()
      .from(profile)
      .where(eq(profile.id, id));
    return results[0];
  }

  async validateCredentials(credentials: {username: string, password: string}) {
  try {
    // 1. Sign in with existing credentials
    const { data, error: signInError } = await supabaseConnector.client.auth.signInWithPassword({
      email: credentials.username,
      password: credentials.password
    });

    if (signInError) {
      console.log('Sign in error:', signInError);
      return null;
    }

    if (!data.user) {
      console.log('No user data returned from sign in');
      return null;
    }

    // 2. Fetch the profile data directly from Supabase
    const { data: profile, error: profileError } = await supabaseConnector.client
      .from('profile')
      .select()
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.log('Profile fetch error:', profileError);
      return null;
    }

    return profile;  // Return the same format as createNew
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