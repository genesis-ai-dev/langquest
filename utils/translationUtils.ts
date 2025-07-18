import { getLanguageById } from '@/hooks/db/useLanguages';
import type { SupportedLanguage } from '@/services/localizations';
import { localizations } from '@/services/localizations';
import type { User } from '@supabase/supabase-js';

export class TranslationUtils {
  static currentLanguage: SupportedLanguage = 'english';

  static async initialize(currentUser: User | null) {
    try {
      if (!currentUser) return;

      // Get UI language from user metadata or profile
      const uiLanguageId = currentUser.user_metadata?.ui_language_id;
      if (!uiLanguageId) return;

      const language = await getLanguageById(uiLanguageId);
      if (language?.english_name) {
        this.currentLanguage =
          language.english_name.toLowerCase() as SupportedLanguage;
      }
    } catch (error) {
      console.error('Error initializing TranslationUtils:', error);
    }
  }

  static t(key: string, substitutions?: Record<string, string>): string {
    const translation = localizations[this.currentLanguage]?.[key] || key;

    if (!substitutions) return translation;

    let formattedMessage = translation;
    for (const [placeholder, value] of Object.entries(substitutions)) {
      formattedMessage = formattedMessage.replace(
        new RegExp(`\\{${placeholder}\\}`, 'g'),
        value
      );
    }

    return formattedMessage;
  }
}
