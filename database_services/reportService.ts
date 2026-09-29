import { reports } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

export class ReportService {
  async createReport(data: typeof reports.$inferInsert) {
    const [newReport] = await system.db
      .insert(reports)
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
