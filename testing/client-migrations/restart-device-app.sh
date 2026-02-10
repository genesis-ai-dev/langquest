#!/bin/bash

# Script to close and optionally restart an app in iOS Simulator or Android Emulator
# Auto-detects platform and uses appropriate commands
# Usage: ./testing/client-migrations/restart-device-app.sh [action] [platform]
#   action: "close" (default) or "restart"
#   platform: Optional override ("ios" or "android"). If not provided, auto-detects.
#             iOS is checked first, then Android if iOS not available.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
ACTION="${1:-close}"
PLATFORM_OVERRIDE="${2:-}"  # Optional platform override
BASE_BUNDLE_ID="com.etengenesis.langquest"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Go up two levels: testing/client-migrations -> testing -> project root
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Get app variant and dev server IP from .env.local
APP_VARIANT=""
EXPO_DEV_SERVER_IP=""
EXPO_DEV_SERVER_PORT="${EXPO_DEV_SERVER_PORT:-8081}"  # Default Metro port (8081)

if [ -f "$PROJECT_ROOT/.env.local" ]; then
    APP_VARIANT=$(grep "^EXPO_PUBLIC_APP_VARIANT=" "$PROJECT_ROOT/.env.local" | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
    # Extract IP from any URL in .env.local (SUPABASE_URL, POWERSYNC_URL, etc.)
    EXPO_DEV_SERVER_IP=$(grep -E "(SUPABASE_URL|POWERSYNC_URL|EXPO.*URL)" "$PROJECT_ROOT/.env.local" | head -1 | sed -E 's/.*:\/\/([0-9.]+):.*/\1/' | head -1)
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

# Detect platform (iOS checked first, then Android)
PLATFORM=""
if [ -n "$PLATFORM_OVERRIDE" ]; then
    # Use override if provided
    PLATFORM="$PLATFORM_OVERRIDE"
    echo -e "${YELLOW}Using platform override: ${PLATFORM}${NC}"
elif command -v xcrun &> /dev/null && xcrun simctl list devices | grep -qi "booted"; then
    # Check iOS first (more common for development)
    PLATFORM="ios"
elif command -v adb &> /dev/null && adb devices | grep -q "device$"; then
    # Fallback to Android if iOS not available
    PLATFORM="android"
else
    echo -e "${RED}Error: No booted iOS simulator or Android emulator found${NC}"
    echo "Please start an iOS simulator or Android emulator first"
    exit 1
fi

# Validate platform override
if [ -n "$PLATFORM_OVERRIDE" ] && [ "$PLATFORM_OVERRIDE" != "ios" ] && [ "$PLATFORM_OVERRIDE" != "android" ]; then
    echo -e "${RED}Error: Invalid platform override: ${PLATFORM_OVERRIDE}${NC}"
    echo "Platform must be 'ios' or 'android'"
    exit 1
fi

echo -e "${GREEN}Detected platform: ${PLATFORM}${NC}"

# Warn if both platforms are available but override wasn't used
if [ -z "$PLATFORM_OVERRIDE" ]; then
    IOS_AVAILABLE=false
    ANDROID_AVAILABLE=false
    if command -v xcrun &> /dev/null && xcrun simctl list devices | grep -qi "booted"; then
        IOS_AVAILABLE=true
    fi
    if command -v adb &> /dev/null && adb devices | grep -q "device$"; then
        ANDROID_AVAILABLE=true
    fi
    if [ "$IOS_AVAILABLE" = true ] && [ "$ANDROID_AVAILABLE" = true ]; then
        echo -e "${YELLOW}⚠️  Both iOS and Android devices detected. Using ${PLATFORM}.${NC}"
        echo -e "${YELLOW}   To override, specify platform as second argument: $0 [action] [ios|android]${NC}"
    fi
fi

if [ "$PLATFORM" = "ios" ]; then
    # iOS Simulator
    echo -e "${YELLOW}Using bundle ID: $APP_BUNDLE_ID (variant: ${APP_VARIANT:-production})${NC}"
    
    # Find booted simulator UUID
    BOOTED_SIM=$(xcrun simctl list devices | grep -i "booted" | head -1 | grep -oE '[A-F0-9-]{36}' | head -1)
    
    if [ -z "$BOOTED_SIM" ]; then
        echo -e "${RED}Error: No booted iOS simulator found${NC}"
        echo "Please start an iOS simulator first"
        exit 1
    fi
    
    echo -e "${GREEN}Found booted simulator: ${BOOTED_SIM}${NC}"
    
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

elif [ "$PLATFORM" = "android" ]; then
    # Android Emulator/Device
    echo -e "${YELLOW}Using package: $APP_BUNDLE_ID (variant: ${APP_VARIANT:-production})${NC}"
    
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
    
    # Check if app is installed
    if ! adb shell pm list packages | grep -q "$APP_BUNDLE_ID"; then
        echo -e "${RED}Error: App not found for package: $APP_BUNDLE_ID${NC}"
        echo "Make sure the app is installed on the emulator/device"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Found installed app: $APP_BUNDLE_ID${NC}"
    
    # Terminate the app
    echo -e "${YELLOW}Terminating app: $APP_BUNDLE_ID${NC}"
    adb shell am force-stop "$APP_BUNDLE_ID" 2>/dev/null && echo -e "${GREEN}✓ App terminated${NC}" || echo -e "${YELLOW}App was not running (this is OK)${NC}"
    
    # Wait for termination
    sleep 2
    
    # Restart the app if requested
    if [ "$ACTION" = "restart" ]; then
        echo -e "${YELLOW}Restarting app...${NC}"
        
        # For development variant, use Expo development client deep link
        if [ "$APP_VARIANT" = "development" ] && [ -n "$EXPO_DEV_SERVER_IP" ]; then
            # Construct Expo dev client deep link
            DEV_SERVER_URL="http://${EXPO_DEV_SERVER_IP}:${EXPO_DEV_SERVER_PORT}"
            DEEP_LINK="exp+langquest://expo-development-client/?url=$(echo "$DEV_SERVER_URL" | sed 's/:/%3A/g' | sed 's/\//%2F/g')"
            
            echo -e "${YELLOW}Using Expo dev client deep link: $DEEP_LINK${NC}"
            if adb shell am start -a android.intent.action.VIEW -d "$DEEP_LINK" "$APP_BUNDLE_ID" 2>/dev/null; then
                echo -e "${GREEN}✓ App restarted via Expo dev client deep link!${NC}"
            else
                echo -e "${YELLOW}Deep link failed, falling back to regular launch...${NC}"
                # Fall through to regular launch
            fi
        fi
        
        # Regular launch (fallback or non-development variant)
        if [ "$APP_VARIANT" != "development" ] || [ -z "$EXPO_DEV_SERVER_IP" ] || [ $? -ne 0 ]; then
            # Get the main activity from the app
            # The activity is on the line that contains the package name and activity
            MAIN_ACTIVITY=$(adb shell "cmd package resolve-activity --brief $APP_BUNDLE_ID" | grep -E "^[^ ]+/.+$" | head -1 | cut -d'/' -f2)
            
            if [ -z "$MAIN_ACTIVITY" ]; then
                echo -e "${YELLOW}Could not determine main activity, trying default launch...${NC}"
                if adb shell monkey -p "$APP_BUNDLE_ID" -c android.intent.category.LAUNCHER 1 2>/dev/null; then
                    echo -e "${GREEN}✓ App restarted successfully!${NC}"
                else
                    echo -e "${RED}Error: Could not restart app${NC}"
                    echo -e "${YELLOW}Please manually launch the app from the emulator/device.${NC}"
                    exit 1
                fi
            else
                if adb shell am start -n "$APP_BUNDLE_ID/$MAIN_ACTIVITY" 2>/dev/null; then
                    echo -e "${GREEN}✓ App restarted successfully!${NC}"
                else
                    echo -e "${RED}Error: Could not restart app${NC}"
                    echo -e "${YELLOW}Please manually launch the app from the emulator/device.${NC}"
                    exit 1
                fi
            fi
        fi
    fi
fi

