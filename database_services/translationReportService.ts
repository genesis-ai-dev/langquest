import { reasonOptions } from '@/components/ReportTranslationModal';
import { translation_reports } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

export type TranslationReport = typeof translation_reports.$inferSelect;

const { db } = system;

export class TranslationReportService {
  async createReport(data: {
    translation_id: string;
    reporter_id: string;
    reason: (typeof reasonOptions)[number];
    details?: string;
  }) {
    const [newReport] = await db
      .insert(translation_reports)
      .values({
        translation_id: data.translation_id,
        reporter_id: data.reporter_id,
        reason: data.reason,
        details: data.details || ''
      })
      .returning();

    return newReport;
  }
}

export const translationReportService = new TranslationReportService();
