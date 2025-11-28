// env.d.ts

import '@supabase/auth-js';

declare module '@supabase/auth-js' {
  export interface UserMetadata extends UserMetadata {
    ui_language?: string;
    ui_language_id?: string;
    ui_languoid_id?: string;
    username?: string;
    terms_accepted?: boolean;
    terms_accepted_at?: string;
  }
}
