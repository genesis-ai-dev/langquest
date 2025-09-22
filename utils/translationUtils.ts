import type { language } from '@/db/drizzleSchema';
import { language as languageTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import type { SupportedLanguage } from '@/services/localizations';
import { localizations } from '@/services/localizations';
import { hybridFetch } from '@/views/new/useHybridData';
import { toMergeCompilableQuery } from '@/utils/dbUtils';
import type { User } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';

type Language = typeof language.$inferSelect;

export class TranslationUtils {
  static currentLanguage: SupportedLanguage = 'english';

  static async initialize(currentUser: User | null) {
    try {
      if (!currentUser) return;

      // Get UI language from user metadata or profile
      const uiLanguageId = currentUser.user_metadata.ui_language_id;
      if (!uiLanguageId) return;

      // Use hybridFetch directly
      const languages = await hybridFetch<Language>({
        offlineQuery: toMergeCompilableQuery(
          system.db.query.language.findMany({
            where: eq(languageTable.id, uiLanguageId),
            limit: 1
          })
        ),
        cloudQueryFn: async () => {
          const { data, error } = await system.supabaseConnector.client
            .from('language')
            .select('*')
            .eq('id', uiLanguageId)
            .overrideTypes<Language[]>();
          if (error) throw error;
          return data;
        }
      });

      const language = languages[0];
      if (language?.english_name) {
        this.currentLanguage =
          language.english_name.toLowerCase() as SupportedLanguage;
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Error initializing TranslationUtils:', errorMessage);
    }
  }

  static t(key: string, substitutions?: Record<string, string>): string {
    // Access the translation by key first, then by language
    const translationEntry =
      key in localizations
        ? (localizations[key as keyof typeof localizations] as Partial<
            Record<SupportedLanguage, string>
          > & { english?: string })
        : undefined;

    const translation =
      translationEntry?.[this.currentLanguage] ??
      translationEntry?.english ??
      key;

    if (!substitutions) return translation;

    let formattedMessage = translation;
    for (const placeholder in substitutions) {
      if (Object.prototype.hasOwnProperty.call(substitutions, placeholder)) {
        const value = substitutions[placeholder] ?? '';
        formattedMessage = formattedMessage.replace(
          new RegExp(`\\{${placeholder}\\}`, 'g'),
          value
        );
      }
    }

    return formattedMessage;
  }
}
