/*
Utility to rewrite raw SQL strings to reference _local table names.

Usage:
  import { rewriteSqlToLocal } from '@/utils/sqlLocalize';

  const sql = `SELECT * FROM project JOIN quest ON quest.project_id = project.id`;
  const localized = rewriteSqlToLocal(sql);

Notes:
- Rewrites standalone table identifiers in common DML clauses: FROM, JOIN, UPDATE, INSERT INTO, DELETE FROM
- Handles optional schema prefixes (e.g. public.project), and quoted identifiers ("project", `project`, [project])
- Skips already-suffixed identifiers to avoid double-suffixing
*/

import * as localTables from '@/db/drizzleSchemaLocal';

export function rewriteSqlToLocal(sql: string, suffix = '_local') {
  if (!sql) return sql;

  // Derive base table/view names from drizzleSchemaLocal exports by stripping the suffix
  const localKeys = Object.keys(localTables).filter(
    (k) => k.endsWith(suffix) && !k.endsWith(`_localRelations`)
  );
  if (localKeys.length === 0) return sql;

  const baseNames = localKeys.map((k) =>
    k.replace(new RegExp(`${escapeRegExp(suffix)}$`), '')
  );

  let result = sql;

  for (const baseName of baseNames) {
    const escapedBase = escapeRegExp(baseName);

    // Optional schema prefix like public. or main.
    const schemaPrefix = `(?:[A-Za-z_][A-Za-z0-9_]*[.])?`;

    // Support qualified joins like LEFT JOIN, INNER JOIN, etc.
    const joinToken = `(?:LEFT|RIGHT|FULL|INNER|OUTER|CROSS)\\s+JOIN|JOIN`;

    // Unquoted identifiers: FROM|UPDATE|[QUALIFIED] JOIN <schema?>baseName
    const simpleDml = new RegExp(
      `\\b(FROM|UPDATE|${joinToken})\\s+(${schemaPrefix})(${escapedBase})(?!${escapeRegExp(
        suffix
      )})\\b`,
      'gi'
    );
    result = result.replace(
      simpleDml,
      (_m, kw: string, schema: string) => `${kw} ${schema}${baseName}${suffix}`
    );

    // Double-quoted identifiers: "baseName"
    const simpleDmlQuoted = new RegExp(
      `\\b(FROM|UPDATE|${joinToken})\\s+(${schemaPrefix})"(${escapedBase})"`,
      'gi'
    );
    result = result.replace(
      simpleDmlQuoted,
      (_m, kw: string, schema: string) =>
        `${kw} ${schema}"${baseName}${suffix}"`
    );

    // Backticked identifiers: `baseName`
    const simpleDmlBacktick = new RegExp(
      `\\b(FROM|UPDATE|${joinToken})\\s+(${schemaPrefix})\`(${escapedBase})\``,
      'gi'
    );
    result = result.replace(
      simpleDmlBacktick,
      (_m, kw: string, schema: string) =>
        `${kw} ${schema}\`${baseName}${suffix}\``
    );

    // Bracketed identifiers: [baseName]
    const simpleDmlBracket = new RegExp(
      `\\b(FROM|UPDATE|${joinToken})\\s+(${schemaPrefix})\\[(${escapedBase})\\]`,
      'gi'
    );
    result = result.replace(
      simpleDmlBracket,
      (_m, kw: string, schema: string) =>
        `${kw} ${schema}[${baseName}${suffix}]`
    );

    // INSERT INTO / DELETE FROM — unquoted
    const compoundDml = new RegExp(
      `\\b(INSERT\\s+INTO|DELETE\\s+FROM)\\s+(${schemaPrefix})(${escapedBase})(?!${escapeRegExp(
        suffix
      )})\\b`,
      'gi'
    );
    result = result.replace(
      compoundDml,
      (_m, kw: string, schema: string) => `${kw} ${schema}${baseName}${suffix}`
    );

    // INSERT/DELETE — double-quoted
    const compoundDmlQuoted = new RegExp(
      `\\b(INSERT\\s+INTO|DELETE\\s+FROM)\\s+(${schemaPrefix})"(${escapedBase})"`,
      'gi'
    );
    result = result.replace(
      compoundDmlQuoted,
      (_m, kw: string, schema: string) =>
        `${kw} ${schema}"${baseName}${suffix}"`
    );

    // INSERT/DELETE — backticked
    const compoundDmlBacktick = new RegExp(
      `\\b(INSERT\\s+INTO|DELETE\\s+FROM)\\s+(${schemaPrefix})\`(${escapedBase})\``,
      'gi'
    );
    result = result.replace(
      compoundDmlBacktick,
      (_m, kw: string, schema: string) =>
        `${kw} ${schema}\`${baseName}${suffix}\``
    );

    // INSERT/DELETE — bracketed
    const compoundDmlBracket = new RegExp(
      `\\b(INSERT\\s+INTO|DELETE\\s+FROM)\\s+(${schemaPrefix})\\[(${escapedBase})\\]`,
      'gi'
    );
    result = result.replace(
      compoundDmlBracket,
      (_m, kw: string, schema: string) =>
        `${kw} ${schema}[${baseName}${suffix}]`
    );
  }

  return result;
}

export function createSqlLocalizer(suffix = '_local'): (sql: string) => string {
  return (sql: string) => rewriteSqlToLocal(sql, suffix);
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
