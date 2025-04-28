import { translations } from '@/services/translations';
import { languageService } from '@/database_services/languageService';
import { SupportedLanguage } from '@/services/translations';

export class TranslationUtils {
  private static currentLanguage: SupportedLanguage = 'english';

  static async initialize() {
    try {
      const language = await languageService.getLanguageById('1'); // Default language ID
      if (language?.english_name) {
        this.currentLanguage =
          language.english_name.toLowerCase() as SupportedLanguage;
      }
    } catch (error) {
      console.error('Error initializing translations:', error);
    }
  }

  static t(key: keyof typeof translations): string {
    if (!translations[key]) {
      console.warn(`Translation key "${key}" not found`);
      return key;
    }
    return (
      translations[key][this.currentLanguage] || translations[key]['english']
    );
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
