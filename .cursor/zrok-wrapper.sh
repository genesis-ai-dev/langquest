#!/bin/bash

# Wrapper script for zgrok that ensures cleanup on exit
# Shares multiple URLs: Supabase API (54321) and local dev server (8080)

# Array to store background process IDs
PIDS=()

# Function to cleanup zgrok on exit
cleanup() {
  echo ""
  echo "🛑 Cleaning up zgrok tunnels..."
  
  # Kill all background zgrok processes
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done
  
  sleep 0.5
  
  # Force kill any remaining zgrok processes
  pkill -f "zgrok http" 2>/dev/null || true
  sleep 0.2
  pkill -9 -f "zgrok http" 2>/dev/null || true
  
  echo "✅ zgrok disconnected"
  exit 0
}

# Set up trap to call cleanup on script exit
trap cleanup EXIT INT TERM

# Share Supabase API (port 54321)
echo "🌐 Starting tunnel for Supabase API (port 54321)..."
zgrok http 54321 2>&1 | sed 's/^/[Port 54321] /' &
PIDS+=($!)

# Share local dev server (port 8080)
echo "🌐 Starting tunnel for local dev server (port 8080)..."
zgrok http 8080 2>&1 | sed 's/^/[Port 8080] /' &
PIDS+=($!)

echo ""
echo "═══════════════════════════════════════════════════════"
echo "🔗 ZGROK TUNNELS STARTED"
echo "═══════════════════════════════════════════════════════"
echo "📡 Look for 'Forwarding:' lines above to see public URLs"
echo "📡 Each tunnel will show its public URL once established"
echo "═══════════════════════════════════════════════════════"
echo ""

# Wait for all background processes
wait

