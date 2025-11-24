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

# Function to start zgrok and capture URL
start_zgrok() {
    local port=$1
    local name=$2
    local log_file="/tmp/zgrok-${port}.log"
    
    echo "🌐 Sharing ${name} (port ${port})..."
    zgrok http ${port} > "${log_file}" 2>&1 &
    local pid=$!
    PIDS+=($pid)
    
    # Wait a moment for tunnel to establish and extract URL
    sleep 2
    if [ -f "${log_file}" ]; then
        local url=$(grep -m1 "Public URL:" "${log_file}" 2>/dev/null | sed 's/.*Public URL:[[:space:]]*//' | tr -d '\r\n')
        if [ -n "$url" ]; then
            echo "   ✅ ${name}: ${url}"
        fi
    fi
}

# Share Supabase API (port 54321)
start_zgrok 54321 "Supabase API"

# Share local dev server (port 8080)
start_zgrok 8080 "Dev Server"

# Wait for all background processes
echo ""
echo "✅ All zgrok tunnels started. Press Ctrl+C to stop."
echo ""
wait

