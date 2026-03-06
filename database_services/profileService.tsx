import { eq } from 'drizzle-orm';
// import { db } from '../db/database';
import { profile_synced } from '@/db/drizzleSchemaSynced';
import { profile } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

export type Profile = typeof profile.$inferSelect;

const { supabaseConnector, db } = system;

// Debug flag
const DEBUG = false;

// Custom debug function
function debug(...args: unknown[]) {
  // eslint-disable-next-line
  if (DEBUG) {
    console.log('[DEBUG userService]', ...args);
  }
}

export class ProfileService {
  async getProfileByUserId(id: string) {
    debug('Getting user by ID:', id);
    const results = await db.select().from(profile).where(eq(profile.id, id));
    return results[0];
  }

  async validateCredentials(credentials: { email: string; password: string }) {
    try {
      // 1. Sign in with existing credentials
      const { user } = await supabaseConnector.login(
        credentials.email,
        credentials.password
      );

      // 2. Fetch the profile data directly from Supabase
      const { data: profile, error: profileError } =
        await supabaseConnector.client
          .from('profile')
          .select()
          .eq('id', user.id)
          .single<Profile>();

      if (profileError) {
        console.log('Profile fetch error:', profileError);
        return null;
      }

      return profile; // Return the same format as createNew
    } catch (error) {
      console.error('Login error:', error);
      return null;
    }
  }

  async createNew(input: {
    credentials: {
      username: string;
      email: string;
      password: string;
    };
    ui_languoid_id?: string;
    terms_accepted?: boolean;
    terms_version?: string;
  }) {
    try {
      // Update the anonymous user with email and password
      const { data: updateData, error: updateError } =
        await supabaseConnector.client.auth.updateUser({
          email: input.credentials.email,
          password: input.credentials.password
        });

      if (updateError) throw updateError;

      // Update profile with username and ui_languoid_id
      const profileUpdate: Record<string, unknown> = {
        username: input.credentials.username,
        terms_accepted: input.terms_accepted ?? false,
        terms_version: input.terms_version ?? null
      };

      if (input.ui_languoid_id) {
        profileUpdate.ui_languoid_id = input.ui_languoid_id;
      }

      const { error: profileError } = await supabaseConnector.client
        .from('profile')
        .update(profileUpdate)
        .eq('id', updateData.user.id);

      if (profileError) throw profileError;

      // Update auth metadata with ui_languoid_id
      if (input.ui_languoid_id) {
        await supabaseConnector.client.auth.updateUser({
          data: {
            ui_languoid_id: input.ui_languoid_id
          }
        });
      }

      // Fetch the complete profile
      const { data: profile, error: fetchError } =
        await supabaseConnector.client
          .from('profile')
          .select()
          .eq('id', updateData.user.id)
          .single<Profile>();

      if (fetchError) throw fetchError;

      return profile; // Just return the profile
    } catch (error) {
      console.error('Error in createNew:', error);
      throw error;
    }
  }

  async updateProfile(data: {
    id: string;
    ui_languoid_id?: string;
    // avatar?: string;
    password?: string;
    terms_accepted?: boolean;
    terms_accepted_at?: string;
  }): Promise<Profile | null> {
    try {
      // Update auth if password is changing
      if (data.password) {
        const { error: updateError } =
          await supabaseConnector.client.auth.updateUser({
            password: data.password
          });
        if (updateError) throw updateError;
      }

      // Update profile data
      const updateData: Partial<Profile> = {
        // ...(data.avatar && { avatar: data.avatar }),
        ...(data.terms_accepted !== undefined && {
          terms_accepted: data.terms_accepted
        }),
        ...(data.terms_accepted_at && {
          terms_accepted_at: data.terms_accepted_at
        })
      };

      if (data.ui_languoid_id) {
        updateData.ui_languoid_id = data.ui_languoid_id;
      }

      console.log('Updating profile with data:', updateData);

      // Update profile in Supabase
      const { data: updatedProfile, error: profileError } =
        await supabaseConnector.client
          .from('profile')
          .update(updateData)
          .eq('id', data.id)
          .select()
          .single<Profile>();

      // Update auth metadata with ui_languoid_id
      if (data.ui_languoid_id) {
        await supabaseConnector.client.auth.updateUser({
          data: {
            ui_languoid_id: data.ui_languoid_id
          }
        });
      }

      if (profileError) {
        console.error('Error updating profile:', profileError);
        throw profileError;
      }

      console.log('Profile updated successfully:', updatedProfile);
      return updatedProfile;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  async deleteAccount(userId: string): Promise<void> {
    try {
      debug('Soft deleting account for user:', userId);

      // Simply set active = false (soft delete)
      const { error: profileError } = await supabaseConnector.client
        .from('profile')
        .update({ active: false })
        .eq('id', userId);

      if (profileError) {
        console.error('Error soft deleting profile:', profileError);
        throw profileError;
      }

      debug('Account soft deleted successfully for user:', userId);
    } catch (error) {
      console.error('Error soft deleting account:', error);
      throw error;
    }
  }

  async restoreAccount(userId: string): Promise<void> {
    try {
      debug('Restoring account for user:', userId);

      // Set active = true to restore account
      await system.db
        .update(profile_synced)
        .set({ active: true })
        .where(eq(profile_synced.id, userId));

      debug('Account restored successfully for user:', userId);
    } catch (error) {
      console.error('Error restoring account:', error);
      throw error;
    }
  }
}

export const profileService = new ProfileService();
