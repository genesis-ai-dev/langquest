#!/bin/bash

# Wrapper script for zrok that ensures cleanup on exit
# Shares multiple URLs: Supabase API (54321), Supabase Studio (54323), PowerSync (8000), and Expo web (8081)

# Array to store background process IDs
PIDS=()

# Function to cleanup zrok on exit
cleanup() {
  echo ""
  echo "🛑 Cleaning up zrok tunnels..."
  
  # Kill all background zrok processes
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done
  
  sleep 0.5
  
  # Force kill any remaining zrok processes
  pkill -f "zrok share" 2>/dev/null || true
  sleep 0.2
  pkill -9 -f "zrok share" 2>/dev/null || true
  
  echo "✅ zrok disconnected"
  exit 0
}

# Set up trap to call cleanup on script exit
trap cleanup EXIT INT TERM

# Share Supabase API (port 54321)
echo "🌐 Starting tunnel for Supabase API (port 54321)..."
zrok share public --unique-name "langquest-supabase" http://localhost:54321 2>&1 | sed 's/^/[Port 54321] /' &
PIDS+=($!)

# Share Supabase Studio (port 54323)
echo "🌐 Starting tunnel for Supabase Studio (port 54323)..."
zrok share public --unique-name "langquest-supabase-studio" http://localhost:54323 2>&1 | sed 's/^/[Port 54323] /' &
PIDS+=($!)

# Share PowerSync (port 8000)
echo "🌐 Starting tunnel for PowerSync (port 8000)..."
zrok share public --unique-name "langquest-powersync" http://localhost:8000 2>&1 | sed 's/^/[Port 8000] /' &
PIDS+=($!)

# Share Expo web (port 8081)
echo "🌐 Starting tunnel for Expo web (port 8081)..."
zrok share public --unique-name "langquest-expo-web" http://localhost:8081 2>&1 | sed 's/^/[Port 8081] /' &
PIDS+=($!)

echo ""
echo "═══════════════════════════════════════════════════════"
echo "🔗 ZROK TUNNELS STARTED"
echo "═══════════════════════════════════════════════════════"
echo "📡 Look for public URLs above for each service"
echo "📡 Each tunnel will show its public URL once established"
echo "═══════════════════════════════════════════════════════"
echo ""

# Wait for all background processes
wait

