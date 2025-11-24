#!/usr/bin/env tsx
/**
 * Script to query local Supabase database tables
 * 
 * Usage:
 *   npm run query-db <table_name> [limit]
 *   npm run query-db profile 10
 *   npm run query-db "SELECT * FROM profile LIMIT 5"
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

function executeQuery(query: string): string {
  const tempFile = join(tmpdir(), `query-${Date.now()}.sql`);
  
  try {
    writeFileSync(tempFile, query);
    
    // Try to use psql from Docker container first
    // Check if Supabase container is running
    let containerName = '';
    try {
      const containers = execSync('sudo docker ps --format "{{.Names}}"', { encoding: 'utf-8' });
      const supabaseContainers = containers.split('\n').filter(name => name.includes('supabase') && name.includes('db'));
      if (supabaseContainers.length > 0) {
        containerName = supabaseContainers[0];
      }
    } catch {
      // Docker check failed, try direct connection
    }
    
    if (containerName) {
      // Use psql from within the Docker container
      const result = execSync(
        `sudo docker exec -i ${containerName} psql -U postgres -d postgres -f - < "${tempFile}"`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      return result;
    } else {
      // Try direct psql connection (might work if psql is installed)
      try {
        const DB_URL = 'postgresql://postgres:postgres@localhost:54322/postgres';
        const result = execSync(
          `psql "${DB_URL}" -f "${tempFile}"`,
          { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
        );
        return result;
      } catch (psqlError: any) {
        throw new Error('Cannot connect to database. Make sure Supabase is running: npm run supabase start');
      }
    }
  } catch (error: any) {
    // Check if it's a connection error
    if (error.message.includes('connection') || 
        error.message.includes('could not connect') ||
        error.message.includes('Cannot connect')) {
      throw new Error('Cannot connect to database. Make sure Supabase is running: npm run supabase start');
    }
    throw new Error(`Failed to execute query: ${error.message}`);
  } finally {
    // Clean up temp file
    try {
      unlinkSync(tempFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

function queryDatabase(query: string, limit?: number) {
  console.log('🔍 Querying local Supabase database...\n');
  
  // If it's just a table name, construct a SELECT query
  let finalQuery = query;
  if (!query.toUpperCase().includes('SELECT') && 
      !query.toUpperCase().includes('INSERT') && 
      !query.toUpperCase().includes('UPDATE') && 
      !query.toUpperCase().includes('DELETE') &&
      !query.toUpperCase().includes('WITH')) {
    // It's a table name - need to get column names first
    const tableName = query;
    finalQuery = `SELECT * FROM ${tableName}`;
    if (limit) {
      finalQuery += ` LIMIT ${limit}`;
    }
  } else if (limit && !query.toUpperCase().includes('LIMIT')) {
    // Add limit if not present
    finalQuery += ` LIMIT ${limit}`;
  }
  
  console.log(`📊 Executing query:\n${finalQuery}\n`);
  
  try {
    const result = executeQuery(finalQuery);
    console.log(`📋 Results:\n${result}`);
    
    if (!result.trim()) {
      console.log('\n⚠️  No rows returned');
    }
  } catch (error: any) {
    console.error('❌ Error querying database:', error.message);
    if (!error.message.includes('Make sure Supabase is running')) {
      console.error('\n💡 Make sure Supabase is running: npm run supabase start');
    }
    process.exit(1);
  }
}

function listTables() {
  console.log('🔍 Listing tables in local Supabase database...\n');
  
  const query = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;
  
  try {
    const result = executeQuery(query);
    const tables = result.trim().split('\n').filter(Boolean);
    
    console.log('📋 Available tables:\n');
    tables.forEach((table, index) => {
      console.log(`  ${index + 1}. ${table}`);
    });
    
    if (tables.length === 0) {
      console.log('  No tables found');
    }
  } catch (error: any) {
    console.error('❌ Error listing tables:', error.message);
    if (!error.message.includes('Make sure Supabase is running')) {
      console.error('\n💡 Make sure Supabase is running: npm run supabase start');
    }
    process.exit(1);
  }
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
Usage:
  npm run query-db [options] [table_name|query] [limit]

Options:
  --list, -l              List all available tables
  --help, -h              Show this help message

Examples:
  npm run query-db --list
  npm run query-db profile
  npm run query-db profile 10
  npm run query-db "SELECT * FROM profile WHERE id = 'some-id'"
  npm run query-db "SELECT COUNT(*) FROM profile"
`);
  process.exit(0);
}

if (args[0] === '--list' || args[0] === '-l') {
  listTables();
} else {
  const query = args[0];
  const limit = args[1] ? parseInt(args[1], 10) : undefined;
  queryDatabase(query, limit);
}
