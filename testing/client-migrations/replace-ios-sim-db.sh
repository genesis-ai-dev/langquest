#!/bin/bash

# Script to find and replace the SQLite database in iOS Simulator
# Usage: ./testing/client-migrations/replace-ios-sim-db.sh [test-db-file]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default test database
TEST_DB="${1:-testing/client-migrations/1.0-test.db}"
BASE_BUNDLE_ID="com.etengenesis.langquest"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Get app variant from .env.local
APP_VARIANT=""
if [ -f "$PROJECT_ROOT/.env.local" ]; then
    APP_VARIANT=$(grep "^EXPO_PUBLIC_APP_VARIANT=" "$PROJECT_ROOT/.env.local" | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
fi

# Map variant to bundle ID suffix
case "$APP_VARIANT" in
    development)
        BUNDLE_ID_SUFFIX=".dev"
        ;;
    preview)
        BUNDLE_ID_SUFFIX=".preview"
        ;;
    production|"")
        BUNDLE_ID_SUFFIX=""
        ;;
    *)
        BUNDLE_ID_SUFFIX=""
        ;;
esac

APP_BUNDLE_ID="${BASE_BUNDLE_ID}${BUNDLE_ID_SUFFIX}"

echo -e "${YELLOW}Finding iOS Simulator database...${NC}"

# Find booted simulator UUID
BOOTED_SIM=$(xcrun simctl list devices | grep -i "booted" | head -1 | grep -oE '[A-F0-9-]{36}' | head -1)

if [ -z "$BOOTED_SIM" ]; then
    echo -e "${RED}Error: No booted iOS simulator found${NC}"
    echo "Please start an iOS simulator first"
    exit 1
fi

echo -e "${GREEN}Found booted simulator: ${BOOTED_SIM}${NC}"

# Find simulator data directory
SIM_DATA_DIR="$HOME/Library/Developer/CoreSimulator/Devices/$BOOTED_SIM/data"

if [ ! -d "$SIM_DATA_DIR" ]; then
    echo -e "${RED}Error: Simulator data directory not found: $SIM_DATA_DIR${NC}"
    exit 1
fi

# Find the database file directly (PowerSync stores it in Library/)
DB_PATH=$(find "$SIM_DATA_DIR/Containers/Data/Application" -name "sqlite.db" -type f 2>/dev/null | head -1)

if [ -z "$DB_PATH" ]; then
    echo -e "${YELLOW}Database not found, searching for app container...${NC}"
    echo -e "${YELLOW}Using bundle ID: $APP_BUNDLE_ID (variant: ${APP_VARIANT:-production})${NC}"
    
    FOUND=$(find "$SIM_DATA_DIR/Containers/Data/Application" -name "*.app" -type d 2>/dev/null | grep -i "$APP_BUNDLE_ID" | head -1)
    
    if [ -z "$FOUND" ]; then
        echo -e "${RED}Error: App container not found for bundle ID: $APP_BUNDLE_ID${NC}"
        echo "Make sure the app is installed on the simulator"
        exit 1
    fi
    
    APP_DATA_DIR=$(dirname "$FOUND")
    echo -e "${GREEN}Found app with bundle ID: $APP_BUNDLE_ID${NC}"
    
    # Try Library first (PowerSync default), then Documents
    LIBRARY_DIR="$APP_DATA_DIR/Library"
    DOCUMENTS_DIR="$APP_DATA_DIR/Documents"
    
    if [ -d "$LIBRARY_DIR" ]; then
        DB_PATH="$LIBRARY_DIR/sqlite.db"
    elif [ -d "$DOCUMENTS_DIR" ]; then
        DB_PATH="$DOCUMENTS_DIR/sqlite.db"
    else
        echo -e "${YELLOW}Creating Library directory...${NC}"
        mkdir -p "$LIBRARY_DIR"
        DB_PATH="$LIBRARY_DIR/sqlite.db"
    fi
else
    echo -e "${GREEN}Found existing database${NC}"
fi

DB_DIR=$(dirname "$DB_PATH")
DB_SHM="$DB_DIR/sqlite.db-shm"
DB_WAL="$DB_DIR/sqlite.db-wal"

echo -e "${GREEN}Database directory: $DB_DIR${NC}"

# Check if test database exists
if [ ! -f "$TEST_DB" ]; then
    echo -e "${RED}Error: Test database not found: $TEST_DB${NC}"
    exit 1
fi

echo -e "${GREEN}Test database: $TEST_DB${NC}"
echo -e "${GREEN}Target database: $DB_PATH${NC}"

# Close/terminate the app
echo -e "${YELLOW}Closing app...${NC}"
"$SCRIPT_DIR/restart-ios-sim-app.sh" close

# Copy test database
echo -e "${YELLOW}Replacing database...${NC}"
cp "$TEST_DB" "$DB_PATH"

# Handle WAL/SHM files - always remove if they don't exist in source
TEST_DB_SHM="${TEST_DB}-shm"
TEST_DB_WAL="${TEST_DB}-wal"

if [ -f "$TEST_DB_SHM" ]; then
    echo -e "${YELLOW}Copying WAL shared memory file...${NC}"
    cp "$TEST_DB_SHM" "$DB_SHM"
else
    # Always remove if not in source (even if doesn't exist in target)
    if [ -f "$DB_SHM" ]; then
        echo -e "${YELLOW}Removing existing WAL shared memory file (not in source)...${NC}"
    fi
    rm -f "$DB_SHM"
fi

if [ -f "$TEST_DB_WAL" ]; then
    echo -e "${YELLOW}Copying WAL file...${NC}"
    cp "$TEST_DB_WAL" "$DB_WAL"
else
    # Always remove if not in source (even if doesn't exist in target)
    if [ -f "$DB_WAL" ]; then
        echo -e "${YELLOW}Removing existing WAL file (not in source)...${NC}"
    fi
    rm -f "$DB_WAL"
fi

echo -e "${GREEN}✓ Database replaced successfully!${NC}"
echo -e "${GREEN}Database location: $DB_PATH${NC}"
