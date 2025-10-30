import { and, eq } from 'drizzle-orm';
import { reports_local } from '../db/drizzleSchemaLocal';
import { system } from '../db/powersync/system';

export type Report = typeof reports_local.$inferSelect;

const { db } = system;

export class ReportService {
  async createReport(data: typeof reports_local.$inferInsert) {
    const [newReport] = await db
      .insert(reports_local)
      .values({
        record_id: data.record_id,
        record_table: data.record_table,
        reporter_id: data.reporter_id,
        reason: data.reason,
        details: data.details ?? ''
      })
      .returning();

    return newReport!;
  }

  async hasUserReported(
    record_id: string,
    record_table: string,
    reporter_id: string
  ) {
    const allReports = await db
      .select()
      .from(reports_local)
      .where(
        and(
          eq(reports_local.record_id, record_id),
          eq(reports_local.record_table, record_table),
          eq(reports_local.reporter_id, reporter_id)
        )
      )
      .limit(1);
    console.log('existingReport', allReports[0]);

    return allReports.length > 0;
  }
}

export const reportService = new ReportService();
