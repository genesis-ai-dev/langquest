// Helper function to escape CSV fields
export function escapeCsvField(field: string | null | undefined): string {
  if (field === null || field === undefined) return '';
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  const escaped = field.replace(/"/g, '""');
  if (
    escaped.includes(',') ||
    escaped.includes('"') ||
    escaped.includes('\n')
  ) {
    return `"${escaped}"`;
  }
  return escaped;
}
