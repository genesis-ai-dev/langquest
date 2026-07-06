import Airtable from 'airtable';

const AIRTABLE_API_KEY = Deno.env.get('AIRTABLE_API_KEY');
const AIRTABLE_BASE_ID = Deno.env.get('AIRTABLE_BASE_ID');
const AIRTABLE_TABLE_NAME = Deno.env.get('AIRTABLE_TABLE_NAME') ?? 'Feedback';

let airtableBase: Airtable.Base | null = null;
if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {
  const airtable = new Airtable({ apiKey: AIRTABLE_API_KEY });
  airtableBase = airtable.base(AIRTABLE_BASE_ID);
}

function escapeAirtableString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function deleteFeedbackFromAirtable(email: string | null) {
  if (!airtableBase || !email) {
    return { deleted: 0, skipped: true as const };
  }

  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return { deleted: 0, skipped: true as const };
  }

  const formula = `{email} = '${escapeAirtableString(normalized)}'`;
  const records = await airtableBase(AIRTABLE_TABLE_NAME)
    .select({ filterByFormula: formula })
    .all();

  let deleted = 0;
  for (const record of records) {
    await record.destroy();
    deleted += 1;
  }

  return { deleted, skipped: false as const };
}
