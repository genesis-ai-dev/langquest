import { getLocalizedBookName } from '@/constants/bibleBookNames';
import { useLocalization } from '@/hooks/useLocalization';

/**
 * Hook to get a function that returns localized book names.
 * Useful when you need to localize multiple books without multiple hook calls.
 *
 * @returns Function that takes a bookId and returns localized name/abbreviation
 *
 * @example
 * const getBookName = useBibleBookNameGetter();
 * const genesis = getBookName('gen');
 * const exodus = getBookName('exo');
 */
export function useBibleBookNameGetter() {
  const { currentLanguage } = useLocalization();

  return (bookId: string) => {
    // For English, preserve original behavior of uppercase book ID
    if (currentLanguage === 'english') {
      const localized = getLocalizedBookName(bookId, currentLanguage);
      return { name: localized.name, abbrev: bookId.toUpperCase() };
    }
    return getLocalizedBookName(bookId, currentLanguage);
  };
}
