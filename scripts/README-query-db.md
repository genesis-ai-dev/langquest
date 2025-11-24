# Query Local Supabase Database

This script allows you to easily query your local Supabase database tables.

## Prerequisites

1. **Start Supabase locally:**
   ```bash
   npm run supabase start
   ```

2. **Verify Supabase is running:**
   ```bash
   npm run supabase status
   ```

## Usage

### List all tables
```bash
npm run query-db -- --list
```

### Query a table by name
```bash
# Get all rows from a table
npm run query-db profile

# Limit results
npm run query-db profile 10
```

### Execute custom SQL queries
```bash
# Simple SELECT query
npm run query-db "SELECT * FROM profile LIMIT 5"

# COUNT query
npm run query-db "SELECT COUNT(*) FROM profile"

# Query with WHERE clause
npm run query-db "SELECT * FROM profile WHERE active = true"
```

### Get help
```bash
npm run query-db -- --help
```

## Available Tables

Based on your schema, you have the following tables:
- `asset`
- `asset_content_link`
- `asset_download`
- `asset_tag_link`
- `language`
- `profile`
- `project`
- `project_download`
- `quest`
- `quest_asset_link`
- `quest_download`
- `quest_tag_link`
- `tag`
- `translation`
- `vote`
- `blocked_users`
- `blocked_content`
- `reports`

## Examples

```bash
# List all profiles
npm run query-db profile

# Get first 5 languages
npm run query-db language 5

# Count translations
npm run query-db "SELECT COUNT(*) as total FROM translation"

# Find active projects
npm run query-db "SELECT * FROM project WHERE active = true"
```

## Troubleshooting

**Error: Cannot connect to database**
- Make sure Supabase is running: `npm run supabase start`
- Check Docker is running: `sudo docker ps`

**Error: psql not found**
- The script will automatically use Docker to access psql
- Make sure Docker has proper permissions

## Alternative: Using Supabase Studio

You can also query your database using the Supabase Studio web interface:
1. Start Supabase: `npm run supabase start`
2. Open http://localhost:54323 in your browser
3. Navigate to "SQL Editor" or "Table Editor"
