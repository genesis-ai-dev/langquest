import { getLocalizedBookName } from '@/constants/bibleBookNames';
import { useLocalization } from '@/hooks/useLocalization';

/**
 * Hook to get localized Bible book name and abbreviation.
 * Automatically uses the current UI language.
 *
 * For English, returns the uppercase book ID (e.g., "GEN", "EXO") to match
 * the original display behavior. For other languages, returns localized abbreviations.
 *
 * @param bookId - The book ID (e.g., 'gen', 'exo', 'mat')
 * @returns Object with localized name and abbreviation
 *
 * @example
 * const { name, abbrev } = useBibleBookName('gen');
 * // In English: { name: 'Genesis', abbrev: 'GEN' }
 * // In Nepali: { name: 'उत्पत्ति', abbrev: 'उत्प' }
 */
export function useBibleBookName(bookId: string) {
  const { currentLanguage } = useLocalization();

  // For English, preserve original behavior of uppercase book ID
  if (currentLanguage === 'english') {
    const localized = getLocalizedBookName(bookId, currentLanguage);
    return { name: localized.name, abbrev: bookId.toUpperCase() };
  }

  return getLocalizedBookName(bookId, currentLanguage);
}

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
