#!/bin/bash
set -e

echo "🚀 Starting Render build process..."

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
npm install --legacy-peer-deps

# Build frontend
echo "🏗️ Building frontend..."
npm run build

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend && npm install --legacy-peer-deps

echo "✅ Build completed successfully!"
