#!/bin/bash
# Script to build and test the LiveKit recording template

# Stop script on error
set -e

echo "===== Building and Testing PMarena Recording Template ====="

# Step 1: Install dependencies
echo "Installing dependencies..."
npm install

# Step 2: Build the template
echo "Building template..."
npm run build

# Step 3: Start the development server
echo "Starting development server..."
echo "The server will start at http://localhost:3030"
echo "Press Ctrl+C after testing to stop the server"
echo ""
echo "=== TESTING INSTRUCTIONS ==="
echo "1. Open a browser and navigate to:"
echo "   http://localhost:3030/?url=wss://your-livekit-server.com&token=YOUR_TOKEN&layout=grid"
echo ""
echo "2. Replace the URL and token with valid LiveKit credentials"
echo ""
echo "3. Check that:"
echo "   - Participants with cameras off show their identity information"
echo "   - Screen shares are displayed properly when present"
echo "   - The 'START_RECORDING' message appears in the browser console"
echo "============================="
echo ""

# Start the development server
npm run start 