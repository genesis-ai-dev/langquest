import { languoid as languoidTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import type { SupportedLanguage } from '@/services/localizations';
import { localizations } from '@/services/localizations';
import { hybridFetch } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { User } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';

export class TranslationUtils {
  static currentLanguage: SupportedLanguage = 'english';

  static async initialize(currentUser: User | null) {
    try {
      if (!currentUser) return;

      // Get UI language from user metadata - use ui_languoid_id
      const uiLanguoidId = currentUser.user_metadata.ui_languoid_id;
      if (!uiLanguoidId) return;

      // Use hybridFetch directly to get languoid
      const languoids = await hybridFetch<typeof languoidTable.$inferSelect>({
        offlineQuery: toCompilableQuery(
          system.db.query.languoid.findMany({
            where: eq(languoidTable.id, uiLanguoidId),
            limit: 1
          })
        ),
        cloudQueryFn: async () => {
          const { data, error } = await system.supabaseConnector.client
            .from('languoid')
            .select('*')
            .eq('id', uiLanguoidId)
            .overrideTypes<(typeof languoidTable.$inferSelect)[]>();
          if (error) throw error;
          return data;
        }
      });

      const languoidData = languoids[0];
      if (languoidData?.name) {
        this.currentLanguage =
          languoidData.name.toLowerCase() as SupportedLanguage;
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
