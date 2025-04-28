import { eq } from 'drizzle-orm';
// import { db } from '../db/database';
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
  async getProfileByUserId(id: string): Promise<Profile | null> {
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
    ui_language_id: string;
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

      // Update profile with username and ui_language_id
      const { error: profileError } = await supabaseConnector.client
        .from('profile')
        .update({
          username: input.credentials.username,
          ui_language_id: input.ui_language_id,
          terms_accepted: input.terms_accepted ?? false,
          terms_version: input.terms_version ?? null
        })
        .eq('id', updateData.user.id);

      if (profileError) throw profileError;

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
    ui_language_id?: string;
    // avatar?: string;
    password?: string;
    terms_accepted?: boolean;
    terms_version?: string;
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
        ...(data.ui_language_id && { ui_language_id: data.ui_language_id }),
        // ...(data.avatar && { avatar: data.avatar }),
        ...(data.terms_accepted !== undefined && {
          terms_accepted: data.terms_accepted
        }),
        ...(data.terms_version && { terms_version: data.terms_version })
      };

      console.log('Updating profile with data:', updateData);

      // Update profile in Supabase
      const { data: updatedProfile, error: profileError } =
        await supabaseConnector.client
          .from('profile')
          .update(updateData)
          .eq('id', data.id)
          .select()
          .single<Profile>();

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
}

export const profileService = new ProfileService();
