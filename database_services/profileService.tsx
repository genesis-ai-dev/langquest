import { eq } from 'drizzle-orm';
// import { db } from '../db/database';
import { profile } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

export type Profile = typeof profile.$inferSelect;

const { supabaseConnector } = system;

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
  async updateProfile(data: {
    id: string;
    ui_language_id?: string; // Deprecated, use ui_languoid_id
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

      // Update profile data - prefer ui_languoid_id over ui_language_id
      const updateData: Partial<Profile> = {
        // ...(data.avatar && { avatar: data.avatar }),
        ...(data.terms_accepted !== undefined && {
          terms_accepted: data.terms_accepted
        }),
        ...(data.terms_accepted_at && {
          terms_accepted_at: data.terms_accepted_at
        })
      };

      // Prefer ui_languoid_id over ui_language_id
      if (data.ui_languoid_id) {
        updateData.ui_languoid_id = data.ui_languoid_id;
      } else if (data.ui_language_id) {
        // Backward compatibility: still accept ui_language_id
        updateData.ui_language_id = data.ui_language_id;
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

      // Update auth metadata with ui_languoid_id (prefer over ui_language_id)
      if (data.ui_languoid_id) {
        await supabaseConnector.client.auth.updateUser({
          data: {
            ui_languoid_id: data.ui_languoid_id
          }
        });
      } else if (data.ui_language_id) {
        // Backward compatibility
        await supabaseConnector.client.auth.updateUser({
          data: {
            ui_language_id: data.ui_language_id
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
        .update(profile)
        .set({ active: true })
        .where(eq(profile.id, userId));

      debug('Account restored successfully for user:', userId);
    } catch (error) {
      console.error('Error restoring account:', error);
      throw error;
    }
  }
}

export const profileService = new ProfileService();
