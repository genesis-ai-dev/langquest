import { AppConfig } from '@/db/supabase/AppConfig';
import { createClient } from '@supabase/supabase-js';

/**
 * Lightweight Supabase client using only the public anon key.
 * No auth session management, no AsyncStorage, no PowerSync dependency.
 * Safe to use before system.init() — designed for pre-auth gates
 * that need to fetch public data (e.g. language list for terms screen).
 */
export const supabaseAnon = createClient(
  AppConfig.supabaseUrl!,
  AppConfig.supabaseAnonKey!
);
