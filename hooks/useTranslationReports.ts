import { useReports } from './useReports';

export const useTranslationReports = (
  translationId: string,
  reporterId?: string
) => {
  return useReports(translationId, 'translations', reporterId);
};
