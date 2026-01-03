#!/bin/bash

# Script to consolidate SQLite database changes into a single file
# Checkpoints WAL changes into main database while keeping WAL journal mode
# Usage: ./consolidate-db.sh [database-file]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

DB_FILE="${1:-1.0-test-cases.db}"

if [ ! -f "$DB_FILE" ]; then
    echo -e "${RED}Error: Database file not found: $DB_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}Consolidating database: $DB_FILE${NC}"

# Get initial size
INITIAL_SIZE=$(stat -f%z "$DB_FILE" 2>/dev/null || stat -c%s "$DB_FILE" 2>/dev/null || echo "0")
echo -e "${GREEN}Initial database size: $(numfmt --to=iec-i --suffix=B $INITIAL_SIZE 2>/dev/null || echo "${INITIAL_SIZE} bytes")${NC}"

# Define WAL/SHM file paths before any operations
WAL_FILE="${DB_FILE}-wal"
SHM_FILE="${DB_FILE}-shm"

# Checkpoint WAL to merge all changes into main database
echo -e "${YELLOW}Checkpointing WAL...${NC}"
sqlite3 "$DB_FILE" << 'EOF'
-- Checkpoint WAL to merge all changes into main database
PRAGMA wal_checkpoint(FULL);
EOF

# Ensure WAL mode is maintained (don't switch to DELETE)
echo -e "${YELLOW}Ensuring WAL journal mode...${NC}"
JOURNAL_MODE=$(sqlite3 "$DB_FILE" "PRAGMA journal_mode=WAL;" 2>/dev/null)
echo -e "${GREEN}Journal mode: $JOURNAL_MODE${NC}"
if [ "$JOURNAL_MODE" != "wal" ]; then
    echo -e "${YELLOW}Warning: Journal mode is $JOURNAL_MODE, expected WAL${NC}"
fi

# Vacuum to optimize and ensure single file
echo -e "${YELLOW}Running VACUUM...${NC}"
sqlite3 "$DB_FILE" << 'EOF'
VACUUM;
EOF

# Close any database connections by waiting a moment
sleep 0.5

# Remove WAL and SHM files if they exist (after all SQLite operations)
echo -e "${YELLOW}Removing WAL and SHM files...${NC}"
if [ -f "$WAL_FILE" ]; then
    echo -e "${YELLOW}Removing WAL file: $WAL_FILE${NC}"
    rm -f "$WAL_FILE"
fi

if [ -f "$SHM_FILE" ]; then
    echo -e "${YELLOW}Removing SHM file: $SHM_FILE${NC}"
    rm -f "$SHM_FILE"
fi

# Verify WAL/SHM files were removed (check filesystem, don't open database)
if [ -f "$WAL_FILE" ] || [ -f "$SHM_FILE" ]; then
    echo -e "${RED}Error: WAL or SHM files still exist after removal${NC}"
    [ -f "$WAL_FILE" ] && echo "  - $WAL_FILE"
    [ -f "$SHM_FILE" ] && echo "  - $SHM_FILE"
    exit 1
else
    echo -e "${GREEN}✓ WAL and SHM files successfully removed${NC}"
fi

# Get final size
FINAL_SIZE=$(stat -f%z "$DB_FILE" 2>/dev/null || stat -c%s "$DB_FILE" 2>/dev/null || echo "0")
echo -e "${GREEN}Final database size: $(numfmt --to=iec-i --suffix=B $FINAL_SIZE 2>/dev/null || echo "${FINAL_SIZE} bytes")${NC}"

# Verify database integrity (this will recreate WAL/SHM temporarily, but we'll remove them again)
echo -e "${YELLOW}Verifying database integrity...${NC}"
INTEGRITY_CHECK=$(sqlite3 "$DB_FILE" "PRAGMA integrity_check;" 2>/dev/null)
if [ "$INTEGRITY_CHECK" = "ok" ]; then
    echo -e "${GREEN}✓ Database integrity check passed${NC}"
else
    echo -e "${RED}✗ Database integrity check failed: $INTEGRITY_CHECK${NC}"
    exit 1
fi

# Remove WAL/SHM files again after integrity check (they may have been recreated)
sleep 0.5
if [ -f "$WAL_FILE" ]; then
    rm -f "$WAL_FILE"
fi
if [ -f "$SHM_FILE" ]; then
    rm -f "$SHM_FILE"
fi

echo ""
echo -e "${GREEN}✓ Database consolidation complete!${NC}"
echo -e "${GREEN}WAL changes have been checkpointed into the main database file.${NC}"
echo -e "${GREEN}Database remains in WAL journal mode (WAL files will be recreated when opened).${NC}"

