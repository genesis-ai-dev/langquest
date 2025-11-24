#!/bin/bash

# Cleanup script to disconnect zgrok before environment shutdown

echo "🛑 Cleaning up zgrok connections..."

# Try to find and kill zgrok processes
# First, try graceful shutdown by finding zgrok http processes
ZGROK_PIDS=$(pgrep -f "zgrok http" || true)

if [ -n "$ZGROK_PIDS" ]; then
  echo "Found zgrok processes: $ZGROK_PIDS"
  # Send SIGTERM for graceful shutdown
  kill -TERM $ZGROK_PIDS 2>/dev/null || true
  sleep 1
  # Force kill if still running
  kill -9 $ZGROK_PIDS 2>/dev/null || true
  echo "✅ Disconnected zgrok tunnels"
else
  echo "ℹ️  No active zgrok processes found"
fi

# Also try killing any remaining zgrok processes
pkill -f zgrok 2>/dev/null || true

echo "✅ Cleanup complete"

