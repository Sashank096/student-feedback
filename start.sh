#!/bin/bash
# ══════════════════════════════════════════════
# Campus Feedback Analyzer — Start Script
# Starts both Backend (ML API) and Frontend
# ══════════════════════════════════════════════

echo "🚀 Starting Campus Feedback Analyzer..."
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found. Please install Python 3.10+"
    exit 1
fi

# Check Node
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js 18+"
    exit 1
fi

# Check frontend .env
if [ ! -f "frontend/.env" ]; then
    echo "⚠️  frontend/.env not found!"
    echo "   Copy frontend/.env.example to frontend/.env and fill in your Supabase keys."
    exit 1
fi

# The ML API verifies Supabase access tokens before analyzing feedback.
if [ ! -f "backend/.env" ]; then
    echo "⚠️  backend/.env not found!"
    echo "   Copy backend/.env.example to backend/.env and fill in your Supabase values."
    exit 1
fi

# Install backend deps if needed
echo "📦 Checking backend dependencies..."
cd backend
pip install -r requirements.txt -q
cd ..

# Install frontend deps if needed
echo "📦 Checking frontend dependencies..."
cd frontend
npm install --silent
cd ..

echo ""
echo "✅ Starting ML Backend on http://localhost:8000 ..."
cd backend && python main.py &
BACKEND_PID=$!
cd ..

sleep 3

echo "✅ Starting React Frontend on http://localhost:5173 ..."
cd frontend && npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "══════════════════════════════════════"
echo "  🎓 Student Login  → http://localhost:5173"
echo "  🛡️ HOD/Admin Login → http://localhost:5173"
echo "  🤖 ML API Docs    → http://localhost:8000/docs"
echo "══════════════════════════════════════"
echo ""
echo "Press Ctrl+C to stop both servers."

# Wait and cleanup
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'; exit" INT
wait
