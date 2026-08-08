#!/bin/bash
# Quick setup script for local development
# This script automates the initial setup process

set -e

echo "🚀 LangQuest Local Development Setup"
echo "====================================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop: https://www.docker.com/get-started"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v18 or higher."
    exit 1
fi

echo "✅ Prerequisites met"
echo ""

# Install dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi
echo ""

# Generate .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo "📝 Generating .env.local from template..."
    npm run generate-env
    echo "✅ .env.local created"
    echo ""
    echo "⚠️  IMPORTANT: Update .env.local with your Supabase credentials:"
    echo "   1. Run: npx supabase start"
    echo "   2. Run: npx supabase status"
    echo "   3. Update EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    echo ""
else
    echo "✅ .env.local already exists"
fi
echo ""

# Check if Supabase is running
if docker ps | grep -q "supabase"; then
    echo "✅ Supabase is already running"
else
    echo "📦 Starting Supabase (this may take a few minutes the first time)..."
    echo "   Run this manually: npx supabase start"
    echo ""
fi

echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Start Supabase: npx supabase start"
echo "  2. Update .env.local with credentials from: npx supabase status"
echo "  3. Start services: npm run env:start"
echo "  4. Run the app: npm run android (or ios/web)"
echo ""
echo "For detailed instructions, see: ../SETUP.md"

