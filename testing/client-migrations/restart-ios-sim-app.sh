#!/bin/bash

# Script to close and optionally restart an app in iOS Simulator
# Usage: ./testing/client-migrations/restart-ios-sim-app.sh [action]
#   action: "close" (default) or "restart"

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default action
ACTION="${1:-close}"
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

# Find booted simulator UUID
BOOTED_SIM=$(xcrun simctl list devices | grep -i "booted" | head -1 | grep -oE '[A-F0-9-]{36}' | head -1)

if [ -z "$BOOTED_SIM" ]; then
    echo -e "${RED}Error: No booted iOS simulator found${NC}"
    echo "Please start an iOS simulator first"
    exit 1
fi

echo -e "${GREEN}Found booted simulator: ${BOOTED_SIM}${NC}"
echo -e "${YELLOW}Using bundle ID: $APP_BUNDLE_ID (variant: ${APP_VARIANT:-production})${NC}"

# Check if app is installed
if ! xcrun simctl listapps "$BOOTED_SIM" 2>/dev/null | grep -q "\"$APP_BUNDLE_ID\""; then
    echo -e "${RED}Error: App not found for bundle ID: $APP_BUNDLE_ID${NC}"
    echo "Make sure the app is installed on the simulator"
    exit 1
fi

echo -e "${GREEN}✓ Found installed app: $APP_BUNDLE_ID${NC}"

# Terminate the app
echo -e "${YELLOW}Terminating app: $APP_BUNDLE_ID${NC}"
xcrun simctl terminate "$BOOTED_SIM" "$APP_BUNDLE_ID" 2>/dev/null && echo -e "${GREEN}✓ App terminated${NC}" || echo -e "${YELLOW}App was not running (this is OK)${NC}"

# Wait for termination
sleep 2

# Restart the app if requested
if [ "$ACTION" = "restart" ]; then
    echo -e "${YELLOW}Restarting app...${NC}"
    if xcrun simctl launch "$BOOTED_SIM" "$APP_BUNDLE_ID" 2>/dev/null; then
        echo -e "${GREEN}✓ App restarted successfully!${NC}"
    else
        echo -e "${RED}Error: Could not restart app${NC}"
        echo -e "${YELLOW}Please manually launch the app from the simulator.${NC}"
        exit 1
    fi
fi

