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

/**
Generates a UNION (or UNION ALL) between the provided SQL and its localized variant
(where table identifiers are suffixed with `_local`).

If the provided SQL already targets `_local` tables exclusively, this function will try to
produce the non-local (remote) variant and union those instead to avoid duplicates.

Examples:
  unionWithLocal(`SELECT * FROM project`)
  => `(SELECT * FROM project) UNION (SELECT * FROM project_local)`

  unionWithLocal(`SELECT * FROM project_local`)
  => `(SELECT * FROM project) UNION (SELECT * FROM project_local)`
*/
export function unionWithLocal(
  sql: string,
  options?: {
    operator?: 'UNION' | 'UNION ALL';
    suffix?: string;
    sourceColumn?: {
      enabled?: boolean;
      alias?: string; // avoid clashing with app-level 'source' field
      mainLabel?: string;
      localLabel?: string;
    };
  }
): string {
  if (!sql) return sql;

  const operator = options?.operator ?? 'UNION';
  const suffix = options?.suffix ?? '_local';
  const addSource = options?.sourceColumn?.enabled ?? true;
  const sourceAlias = options?.sourceColumn?.alias ?? 'table_source';
  const mainLabel = options?.sourceColumn?.mainLabel ?? 'main';
  const localLabel = options?.sourceColumn?.localLabel ?? 'local';

  // Remove trailing semicolons and surrounding whitespace
  const trimmed = sql.trim().replace(/;+\s*$/, '');
  const localized = rewriteSqlToLocal(trimmed, suffix);

  // If localization produced no change, attempt to create a base (non-local) variant
  if (normalizeSql(trimmed) === normalizeSql(localized)) {
    const base = rewriteSqlFromLocalToBase(trimmed, suffix);
    if (normalizeSql(base) === normalizeSql(trimmed)) {
      // Could not derive a distinct counterpart; return the original SQL unchanged
      return trimmed;
    }
    const left = addSource
      ? wrapSelectWithSource(base, mainLabel, sourceAlias)
      : base;
    const right = addSource
      ? wrapSelectWithSource(trimmed, localLabel, sourceAlias)
      : trimmed;
    return `${left} ${operator} ${right}`;
  }

  const left = addSource
    ? wrapSelectWithSource(trimmed, mainLabel, sourceAlias)
    : trimmed;
  const right = addSource
    ? wrapSelectWithSource(localized, localLabel, sourceAlias)
    : localized;

  return `${left} ${operator} ${right}`;
}

// Reverse of rewriteSqlToLocal for common DML tokens
function rewriteSqlFromLocalToBase(sql: string, suffix = '_local') {
  if (!sql) return sql;

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
    const escapedSuffix = escapeRegExp(suffix);

    // Optional schema prefix like public. or main.
    const schemaPrefix = `(?:[A-Za-z_][A-Za-z0-9_]*[.])?`;
    const joinToken = `(?:LEFT|RIGHT|FULL|INNER|OUTER|CROSS)\\s+JOIN|JOIN`;

    // FROM|UPDATE|JOIN with unquoted identifiers
    const simpleDml = new RegExp(
      `\\b(FROM|UPDATE|${joinToken})\\s+(${schemaPrefix})(${escapedBase}${escapedSuffix})\\b`,
      'gi'
    );
    result = result.replace(
      simpleDml,
      (_m, kw: string, schema: string) => `${kw} ${schema}${baseName}`
    );

    // Double-quoted identifiers
    const simpleDmlQuoted = new RegExp(
      `\\b(FROM|UPDATE|${joinToken})\\s+(${schemaPrefix})"(${escapedBase}${escapedSuffix})"`,
      'gi'
    );
    result = result.replace(
      simpleDmlQuoted,
      (_m, kw: string, schema: string) => `${kw} ${schema}"${baseName}"`
    );

    // Backticked identifiers
    const simpleDmlBacktick = new RegExp(
      `\\b(FROM|UPDATE|${joinToken})\\s+(${schemaPrefix})\?` + `\?\?`,
      'gi'
    );
    // For backticks, construct explicitly to avoid escape confusion
    const simpleDmlBacktickExplicit = new RegExp(
      `\\b(FROM|UPDATE|${joinToken})\\s+(${schemaPrefix})\\(${escapedBase}${escapedSuffix})\\`,
      'gi'
    );
    result = result.replace(
      simpleDmlBacktickExplicit,
      (_m, kw: string, schema: string) => `${kw} ${schema}\${baseName}\`
    );

    // Bracketed identifiers
    const simpleDmlBracket = new RegExp(
      `\\b(FROM|UPDATE|${joinToken})\\s+(${schemaPrefix})\\[(${escapedBase}${escapedSuffix})\\]`,
      'gi'
    );
    result = result.replace(
      simpleDmlBracket,
      (_m, kw: string, schema: string) => `${kw} ${schema}[${baseName}]`
    );

    // INSERT INTO / DELETE FROM — unquoted
    const compoundDml = new RegExp(
      `\\b(INSERT\\s+INTO|DELETE\\s+FROM)\\s+(${schemaPrefix})(${escapedBase}${escapedSuffix})\\b`,
      'gi'
    );
    result = result.replace(
      compoundDml,
      (_m, kw: string, schema: string) => `${kw} ${schema}${baseName}`
    );

    // INSERT/DELETE — double-quoted
    const compoundDmlQuoted = new RegExp(
      `\\b(INSERT\\s+INTO|DELETE\\s+FROM)\\s+(${schemaPrefix})"(${escapedBase}${escapedSuffix})"`,
      'gi'
    );
    result = result.replace(
      compoundDmlQuoted,
      (_m, kw: string, schema: string) => `${kw} ${schema}"${baseName}"`
    );

    // INSERT/DELETE — backticked
    const compoundDmlBacktick = new RegExp(
      `\\b(INSERT\\s+INTO|DELETE\\s+FROM)\\s+(${schemaPrefix})\\(${escapedBase}${escapedSuffix})\\`,
      'gi'
    );
    result = result.replace(
      compoundDmlBacktick,
      (_m, kw: string, schema: string) => `${kw} ${schema}\${baseName}\`
    );

    // INSERT/DELETE — bracketed
    const compoundDmlBracket = new RegExp(
      `\\b(INSERT\\s+INTO|DELETE\\s+FROM)\\s+(${schemaPrefix})\\[(${escapedBase}${escapedSuffix})\\]`,
      'gi'
    );
    result = result.replace(
      compoundDmlBracket,
      (_m, kw: string, schema: string) => `${kw} ${schema}[${baseName}]`
    );
  }

  return result;
}

function normalizeSql(input: string): string {
  return input
    .trim()
    .replace(/;+\s*$/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

// Wrap an arbitrary SELECT-like SQL into a subquery and append a literal source column
function wrapSelectWithSource(
  sql: string,
  label: string,
  alias: string
): string {
  const cleaned = sql.trim().replace(/;+\s*$/, '');
  // Use a derived table to avoid meddling with the original SELECT list
  // SELECT sub.* , 'label' AS alias FROM (cleaned) AS sub
  const labelEscaped = label.replace(/'/g, "''");
  return `SELECT sub.* , '${labelEscaped}' AS ${alias} FROM (${cleaned}) AS sub`;
}
