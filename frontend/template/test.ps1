# PowerShell script to build and test the LiveKit recording template

Write-Host "===== Building and Testing PMarena Recording Template =====" -ForegroundColor Green

# Step 1: Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install

# Step 2: Build the template
Write-Host "Building template..." -ForegroundColor Cyan
npm run build

# Step 3: Start the development server
Write-Host "Starting development server..." -ForegroundColor Green
Write-Host "The server will start at http://localhost:3030"
Write-Host "Press Ctrl+C after testing to stop the server"
Write-Host ""
Write-Host "=== TESTING INSTRUCTIONS ===" -ForegroundColor Yellow
Write-Host "1. Open a browser and navigate to:"
Write-Host "   http://localhost:3030/?url=wss://your-livekit-server.com&token=YOUR_TOKEN&layout=grid" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Replace the URL and token with valid LiveKit credentials"
Write-Host ""
Write-Host "3. Check that:" -ForegroundColor Yellow
Write-Host "   - Participants with cameras off show their identity information"
Write-Host "   - Screen shares are displayed properly when present"
Write-Host "   - The 'START_RECORDING' message appears in the browser console"
Write-Host "=============================" -ForegroundColor Yellow
Write-Host ""

# Start the development server
npm run start 