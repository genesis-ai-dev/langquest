/*
 Generates _local duplicates for all sqliteTable definitions in db/drizzleSchema.ts.
 - Outputs to a separate drizzleSchemaLocal.ts file
 - Creates simple table clones with _local suffix in table names
 - Updates all table references to also use _local suffix
 - Includes relations as well
 - Idempotent: replaces the entire output file

 Usage: npx tsx ./scripts/generate-local-tables.ts
*/
import fs from 'node:fs';
import path from 'node:path';
import * as schema from '../db/drizzleSchema';

const ROOT = process.cwd();
const SCHEMA_PATH = path.join(ROOT, 'db', 'drizzleSchema.ts');
const OUTPUT_PATH = path.join(ROOT, 'db', 'drizzleSchemaLocal.ts');

function main() {
  // Get all exported names from the schema
  const exportedNames = Object.keys(schema);

  console.log('Found exports:', exportedNames);

  // Read the original schema file
  const originalContent = fs.readFileSync(SCHEMA_PATH, 'utf8');
  let schemaContent = originalContent;

  // Classify exports by kind for precise rewrites
  const kindByName: Record<string, 'table' | 'view' | 'relations' | 'other'> =
    {};
  exportedNames.forEach((name) => {
    const tableRe = new RegExp(
      `export const\\s+${escapeRegExp(name)}\\s*=\\s*sqliteTable\\s*\\(`
    );
    const viewRe = new RegExp(
      `export const\\s+${escapeRegExp(name)}\\s*=\\s*sqliteView\\s*\\(`
    );
    const relRe = new RegExp(
      `export const\\s+${escapeRegExp(name)}\\s*=\\s*relations\\s*\\(`
    );
    if (tableRe.test(originalContent)) kindByName[name] = 'table';
    else if (viewRe.test(originalContent)) kindByName[name] = 'view';
    else if (relRe.test(originalContent)) kindByName[name] = 'relations';
    else kindByName[name] = 'other';
  });

  // 1) Rename exported constants: tables/views/others -> name_local; relations -> <base>_localRelations
  exportedNames.forEach((name) => {
    const exportDeclRe = new RegExp(
      `export const\\s+${escapeRegExp(name)}\\s*=`,
      'g'
    );
    if (kindByName[name] === 'relations') {
      const baseName = name.replace(/Relations$/, '');
      schemaContent = schemaContent.replace(
        exportDeclRe,
        `export const ${baseName}_localRelations =`
      );
    } else {
      schemaContent = schemaContent.replace(
        exportDeclRe,
        `export const ${name}_local =`
      );
    }
  });

  // 2) Update sqliteTable/sqliteView declared string names (with whitespace/quote handling)
  exportedNames.forEach((name) => {
    if (kindByName[name] === 'table') {
      const tableNameRe = new RegExp(
        `sqliteTable\\s*\\(\\s*(["'])${escapeRegExp(name)}\\1`,
        'g'
      );
      schemaContent = schemaContent.replace(tableNameRe, (m: string) =>
        m.replace(name, `${name}_local`)
      );
    }
    if (kindByName[name] === 'view') {
      const viewNameRe = new RegExp(
        `sqliteView\\s*\\(\\s*(["'])${escapeRegExp(name)}\\1`,
        'g'
      );
      schemaContent = schemaContent.replace(viewNameRe, (m: string) =>
        m.replace(name, `${name}_local`)
      );
    }
  });

  // 3) Rewrite references including relations root and one/many targets
  exportedNames.forEach((name) => {
    // name. -> name_local.
    const dotRefRe = new RegExp(`\\b${escapeRegExp(name)}\\.`, 'g');
    schemaContent = schemaContent.replace(dotRefRe, `${name}_local.`);

    // .references(() => name.
    const refFnRe = new RegExp(
      `\\.references\\(\\(\\) =>\\s*${escapeRegExp(name)}\\.`,
      'g'
    );
    schemaContent = schemaContent.replace(
      refFnRe,
      `.references(() => ${name}_local.`
    );

    // relations(name, ...)
    const relationsHeadRe = new RegExp(
      `\\brelations\\(\\s*${escapeRegExp(name)}\\b`,
      'g'
    );
    schemaContent = schemaContent.replace(
      relationsHeadRe,
      `relations(${name}_local`
    );

    // one(name, ...)/many(name, ...)
    const oneManyRe = new RegExp(
      `\\b(one|many)\\(\\s*${escapeRegExp(name)}\\b`,
      'g'
    );
    schemaContent = schemaContent.replace(
      oneManyRe,
      (_m: string, fn: string) => `${fn}(${name}_local`
    );
  });

  // 3b) Targeted alias assignment rewrite: export const A_local = B  ->  export const A_local = B_local
  schemaContent = schemaContent.replace(
    /export const\s+([A-Za-z0-9_]+)_local\s*=\s*([A-Za-z0-9_]+)/g,
    (match: string, _lhs: string, rhs: string) => {
      if (exportedNames.includes(rhs)) {
        return match.replace(
          new RegExp(`=\\s*${escapeRegExp(rhs)}\\b`),
          `= ${rhs}_local`
        );
      }
      return match;
    }
  );

  // 4) Also fix table identifiers inside raw SQL view bodies
  const tableNames = exportedNames.filter((n) => kindByName[n] === 'table');
  tableNames.forEach((name) => {
    const simpleDmlRe = new RegExp(
      `\\b(FROM|JOIN|UPDATE)\\s+${escapeRegExp(name)}\\b`,
      'g'
    );
    schemaContent = schemaContent.replace(
      simpleDmlRe,
      (_m: string, kw: string) => `${kw} ${name}_local`
    );

    const compoundDmlRe = new RegExp(
      `\\b(INSERT\\s+INTO|DELETE\\s+FROM)\\s+${escapeRegExp(name)}\\b`,
      'g'
    );
    schemaContent = schemaContent.replace(
      compoundDmlRe,
      (_m: string, kw: string) => `${kw} ${name}_local`
    );
  });

  // Create the output file with proper header
  const output = [
    '// AUTO-GENERATED FILE. DO NOT EDIT.',
    '// Generated by scripts/generate-local-tables.ts',
    '// Creates _local table variants for offline sync',
    '',
    schemaContent
  ].join('\n');

  fs.writeFileSync(OUTPUT_PATH, output, 'utf8');
  console.log(
    `Generated ${exportedNames.length} local definitions in drizzleSchemaLocal.ts`
  );
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main();
