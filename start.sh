#!/bin/bash

echo "🚀 Starting P2P File Sharing App"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Function to check if a port is in use
check_port() {
    lsof -i :$1 &> /dev/null
    return $?
}

# Start signaling server
echo "📡 Starting signaling server..."
cd signaling-server

if [ ! -d "node_modules" ]; then
    echo "📦 Installing signaling server dependencies..."
    npm install
fi

if check_port 3001; then
    echo "⚠️  Port 3001 is already in use. Killing existing process..."
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Start server in background
npm start &
SERVER_PID=$!
echo "✅ Signaling server started (PID: $SERVER_PID)"

# Start frontend
echo "🌐 Starting frontend..."
cd ../p2p-share

if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

if check_port 3000; then
    echo "⚠️  Port 3000 is already in use. Killing existing process..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Start frontend in background  
npm run dev &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"

# Wait a moment for services to start
sleep 3

echo ""
echo "🎉 P2P File Sharing App is ready!"
echo ""
echo "📋 Quick Start:"
echo "   1. Open: http://localhost:3000"
echo "   2. Click 'Create New Room'"
echo "   3. Copy the room URL and open in another browser tab/window"
echo "   4. As host: select a file to share"
echo "   5. As peer: accept the file and watch the download!"
echo ""
echo "🔗 Useful Links:"
echo "   • Frontend: http://localhost:3000"
echo "   • Server Health: http://localhost:3001/health"
echo "   • Server Stats: http://localhost:3001/stats"
echo ""
echo "📝 Logs:"
echo "   • Frontend logs will appear below"
echo "   • Server logs: check signaling-server terminal"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $SERVER_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    echo "✅ Services stopped"
    exit 0
}

# Setup signal handlers
trap cleanup SIGINT SIGTERM

echo "⚡ Ready! Press Ctrl+C to stop all services"
echo ""

# Wait for frontend process (this keeps script running)
wait $FRONTEND_PID