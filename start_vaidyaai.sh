#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="/opt/homebrew/bin:$PATH"

echo "========================================================"
echo "🚀 Starting VaidyaAI Full-Stack Application"
echo "========================================================"

# Free any existing processes on ports 8000 and 3000
echo "1. Freeing ports 8000 and 3000..."
kill -9 $(lsof -ti:8000,3000) 2>/dev/null || true
sleep 1

# Start Backend (FastAPI + AI Agents)
echo "2. Starting Backend on http://127.0.0.1:8000..."
cd "$PROJECT_ROOT/backend"
"$PROJECT_ROOT/backend/.ga_venv/bin/python" -m uvicorn main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# Start Frontend (Next.js 14 Dashboard)
echo "3. Starting Frontend on http://localhost:3000..."
cd "$PROJECT_ROOT/frontend"
npm run dev -- -p 3000 &
FRONTEND_PID=$!

echo ""
echo "========================================================"
echo "✅ VaidyaAI Application Started Successfully!"
echo "   • Frontend: http://localhost:3000"
echo "   • Backend:  http://127.0.0.1:8000/health"
echo "   • Login:    http://localhost:3000/login (Phone: 9876543210)"
echo "========================================================"
echo "Press CTRL+C to stop both servers."

trap "echo 'Stopping servers...'; kill -9 $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; exit 0" INT TERM
wait
