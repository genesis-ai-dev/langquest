import { getCurrentUser } from '@/contexts/AuthProvider';
import { getLanguageById } from '@/hooks/db/useLanguages';
import type { SupportedLanguage } from '@/services/localizations';
import { localizations } from '@/services/localizations';

export class TranslationUtils {
  private static currentLanguage: SupportedLanguage = 'english';

  static async initialize() {
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) return;
      const language = await getLanguageById(currentUser.ui_language_id ?? '');
      if (language?.english_name) {
        this.currentLanguage =
          language.english_name.toLowerCase() as SupportedLanguage;
      }
    } catch (error) {
      console.error('Error initializing localizations:', error);
    }
  }

  static t(key: keyof typeof localizations) {
    const localization = localizations[key];
    return localization[this.currentLanguage];
  }

  static formatMessage(
    message: string,
    params: Record<string, string>
  ): string {
    let formattedMessage = message;
    for (const [key, value] of Object.entries(params)) {
      formattedMessage = formattedMessage.replace(`{${key}}`, value);
    }
    return formattedMessage;
  }
}
