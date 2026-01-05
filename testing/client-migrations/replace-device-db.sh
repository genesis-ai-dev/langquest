#!/bin/bash

# Script to find and replace the SQLite database in iOS Simulator or Android Emulator
# Auto-detects platform and uses appropriate commands
# Usage: ./testing/client-migrations/replace-device-db.sh [test-db-file]

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
# Go up two levels: testing/client-migrations -> testing -> project root
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

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

# Detect platform
PLATFORM=""
if command -v adb &> /dev/null && adb devices | grep -q "device$"; then
    PLATFORM="android"
elif command -v xcrun &> /dev/null && xcrun simctl list devices | grep -qi "booted"; then
    PLATFORM="ios"
else
    echo -e "${RED}Error: No booted iOS simulator or Android emulator found${NC}"
    echo "Please start an iOS simulator or Android emulator first"
    exit 1
fi

echo -e "${GREEN}Detected platform: ${PLATFORM}${NC}"

# Check if test database exists
if [ ! -f "$TEST_DB" ]; then
    echo -e "${RED}Error: Test database not found: $TEST_DB${NC}"
    exit 1
fi

echo -e "${GREEN}Test database: $TEST_DB${NC}"

# Close/terminate the app
echo -e "${YELLOW}Closing app...${NC}"
"$SCRIPT_DIR/restart-device-app.sh" close

if [ "$PLATFORM" = "ios" ]; then
    # iOS Simulator path
    echo -e "${YELLOW}Finding iOS Simulator database...${NC}"
    
    # Find booted simulator UUID
    BOOTED_SIM=$(xcrun simctl list devices | grep -i "booted" | head -1 | grep -oE '[A-F0-9-]{36}' | head -1)
    
    if [ -z "$BOOTED_SIM" ]; then
        echo -e "${RED}Error: No booted iOS simulator found${NC}"
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
    echo -e "${GREEN}Target database: $DB_PATH${NC}"
    
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
        if [ -f "$DB_SHM" ]; then
            echo -e "${YELLOW}Removing existing WAL shared memory file (not in source)...${NC}"
        fi
        rm -f "$DB_SHM"
    fi
    
    if [ -f "$TEST_DB_WAL" ]; then
        echo -e "${YELLOW}Copying WAL file...${NC}"
        cp "$TEST_DB_WAL" "$DB_WAL"
    else
        if [ -f "$DB_WAL" ]; then
            echo -e "${YELLOW}Removing existing WAL file (not in source)...${NC}"
        fi
        rm -f "$DB_WAL"
    fi
    
    echo -e "${GREEN}✓ Database replaced successfully!${NC}"
    echo -e "${GREEN}Database location: $DB_PATH${NC}"

elif [ "$PLATFORM" = "android" ]; then
    # Android Emulator path
    echo -e "${YELLOW}Finding Android Emulator database...${NC}"
    
    # Check if adb is available
    if ! command -v adb &> /dev/null; then
        echo -e "${RED}Error: adb command not found. Please install Android SDK Platform Tools${NC}"
        exit 1
    fi
    
    # Check if device is connected
    if ! adb devices | grep -q "device$"; then
        echo -e "${RED}Error: No Android device/emulator connected${NC}"
        echo "Please start an Android emulator or connect a device"
        exit 1
    fi
    
    # Try to find database in common locations using run-as (for debuggable apps)
    # PowerSync typically stores databases in /data/data/{package}/files/ or /data/data/{package}/databases/
    DB_PATHS=(
        "/data/data/${APP_BUNDLE_ID}/files/sqlite.db"
        "/data/data/${APP_BUNDLE_ID}/databases/sqlite.db"
        "/data/data/${APP_BUNDLE_ID}/files/powersync.db"
        "/data/data/${APP_BUNDLE_ID}/databases/powersync.db"
    )
    
    DB_PATH=""
    for path in "${DB_PATHS[@]}"; do
        # Try run-as first (for debuggable apps), then fallback to regular test
        if adb shell "run-as $APP_BUNDLE_ID test -f $path" 2>/dev/null || adb shell "test -f $path" 2>/dev/null; then
            DB_PATH="$path"
            echo -e "${GREEN}Found database at: $DB_PATH${NC}"
            break
        fi
    done
    
    if [ -z "$DB_PATH" ]; then
        echo -e "${YELLOW}Database not found in common locations, using default path...${NC}"
        echo -e "${YELLOW}Using package: $APP_BUNDLE_ID (variant: ${APP_VARIANT:-production})${NC}"
        
        # Check if app is installed
        if ! adb shell pm list packages | grep -q "$APP_BUNDLE_ID"; then
            echo -e "${RED}Error: App not found for package: $APP_BUNDLE_ID${NC}"
            echo "Make sure the app is installed on the emulator/device"
            exit 1
        fi
        
        echo -e "${GREEN}Found app with package: $APP_BUNDLE_ID${NC}"
        
        # Use default PowerSync location
        DB_PATH="/data/data/${APP_BUNDLE_ID}/files/sqlite.db"
        
        # Create directory if it doesn't exist (using run-as for debuggable apps)
        adb shell "run-as $APP_BUNDLE_ID mkdir -p $(dirname "$DB_PATH")" 2>/dev/null || \
        adb shell "mkdir -p $(dirname "$DB_PATH")" 2>/dev/null || true
    fi
    
    echo -e "${GREEN}Target database: $DB_PATH${NC}"
    
    # Copy test database to device
    echo -e "${YELLOW}Replacing database...${NC}"
    
    # Try using run-as for debuggable apps (more reliable than adb push)
    # First, push to a temporary location accessible by adb and run-as
    TEMP_DB="/data/local/tmp/temp_sqlite.db"
    adb push "$TEST_DB" "$TEMP_DB" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        # Use run-as to copy from temp location to app's data directory
        echo -e "${YELLOW}Copying database using run-as (debuggable app)...${NC}"
        adb shell "run-as $APP_BUNDLE_ID cp $TEMP_DB $DB_PATH" 2>/dev/null
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Database replaced using run-as${NC}"
            # Clean up temp file
            adb shell "rm -f $TEMP_DB" 2>/dev/null || true
        else
            # Fallback to direct push (may require root or different permissions)
            echo -e "${YELLOW}run-as failed, trying direct push...${NC}"
            adb push "$TEST_DB" "$DB_PATH" 2>/dev/null || {
                echo -e "${RED}Error: Could not replace database. Try:${NC}"
                echo -e "${YELLOW}  1. Enable root access on emulator, or${NC}"
                echo -e "${YELLOW}  2. Manually copy database using Android Studio Device File Explorer${NC}"
                exit 1
            }
        fi
    else
        # Fallback: try direct push
        echo -e "${YELLOW}Trying direct push...${NC}"
        adb push "$TEST_DB" "$DB_PATH" 2>/dev/null || {
            echo -e "${RED}Error: Could not replace database. Try:${NC}"
            echo -e "${YELLOW}  1. Enable root access on emulator, or${NC}"
            echo -e "${YELLOW}  2. Manually copy database using Android Studio Device File Explorer${NC}"
            exit 1
        }
    fi
    
    # Set proper permissions using run-as
    adb shell "run-as $APP_BUNDLE_ID chmod 664 $DB_PATH" 2>/dev/null || adb shell "chmod 664 $DB_PATH" 2>/dev/null || true
    
    # Handle WAL/SHM files
    TEST_DB_SHM="${TEST_DB}-shm"
    TEST_DB_WAL="${TEST_DB}-wal"
    DB_SHM="${DB_PATH}-shm"
    DB_WAL="${DB_PATH}-wal"
    
    if [ -f "$TEST_DB_SHM" ]; then
        echo -e "${YELLOW}Copying WAL shared memory file...${NC}"
        TEMP_SHM="/data/local/tmp/temp_sqlite.db-shm"
        adb push "$TEST_DB_SHM" "$TEMP_SHM" 2>/dev/null && \
        adb shell "run-as $APP_BUNDLE_ID cp $TEMP_SHM $DB_SHM" 2>/dev/null || \
        adb push "$TEST_DB_SHM" "$DB_SHM" 2>/dev/null
        adb shell "run-as $APP_BUNDLE_ID chmod 664 $DB_SHM" 2>/dev/null || adb shell "chmod 664 $DB_SHM" 2>/dev/null || true
        adb shell "rm -f $TEMP_SHM" 2>/dev/null || true
    else
        adb shell "run-as $APP_BUNDLE_ID rm -f $DB_SHM" 2>/dev/null || adb shell "rm -f $DB_SHM" 2>/dev/null || true
    fi
    
    if [ -f "$TEST_DB_WAL" ]; then
        echo -e "${YELLOW}Copying WAL file...${NC}"
        TEMP_WAL="/data/local/tmp/temp_sqlite.db-wal"
        adb push "$TEST_DB_WAL" "$TEMP_WAL" 2>/dev/null && \
        adb shell "run-as $APP_BUNDLE_ID cp $TEMP_WAL $DB_WAL" 2>/dev/null || \
        adb push "$TEST_DB_WAL" "$DB_WAL" 2>/dev/null
        adb shell "run-as $APP_BUNDLE_ID chmod 664 $DB_WAL" 2>/dev/null || adb shell "chmod 664 $DB_WAL" 2>/dev/null || true
        adb shell "rm -f $TEMP_WAL" 2>/dev/null || true
    else
        adb shell "run-as $APP_BUNDLE_ID rm -f $DB_WAL" 2>/dev/null || adb shell "rm -f $DB_WAL" 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✓ Database replaced successfully!${NC}"
    echo -e "${GREEN}Database location: $DB_PATH${NC}"
fi

