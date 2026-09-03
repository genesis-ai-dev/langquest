import { reports_local } from '../db/drizzleSchemaLocal';
import { system } from '../db/powersync/system';

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
}

export const reportService = new ReportService();
