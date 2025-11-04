import { useHasUserReported } from './useReports';

export const useTranslationReports = (
  translationId: string,
  reporterId?: string
) => {
  if (!reporterId) {
    return { hasReported: false, isLoading: false };
  }

  return useHasUserReported(translationId, 'translations');
};
