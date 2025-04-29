import { and, eq } from 'drizzle-orm';
import { reports } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

export type Report = typeof reports.$inferSelect;

const { db } = system;

export class ReportService {
  async createReport(data: typeof reports.$inferInsert) {
    const [newReport] = await db
      .insert(reports)
      .values({
        record_id: data.record_id,
        record_table: data.record_table,
        reporter_id: data.reporter_id,
        reason: data.reason,
        details: data.details ?? ''
      })
      .returning();

    return newReport;
  }

  async hasUserReported(
    record_id: string,
    record_table: string,
    reporter_id: string
  ) {
    console.log('reports', await db.query.reports.findMany());
    const existingReport = await db.query.reports.findFirst({
      where: and(
        eq(reports.record_id, record_id),
        eq(reports.record_table, record_table),
        eq(reports.reporter_id, reporter_id)
      )
    });
    console.log('existingReport', existingReport);

    return !!existingReport;
  }
}

export const reportService = new ReportService();
